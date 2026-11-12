import type { AudioApi, ControlName, DirectionControl, GameMeta, StorageApi } from '../../games/types';
import type { InputManager } from '../../core/input';
import { HoldRepeater } from './repeater';

interface HeldPointer {
  control: ControlName;
  source: string;
  button: HTMLButtonElement;
  repeater: HoldRepeater;
  longPressTimer: number | null;
  longPressFollowupTimer: number | null;
  longPressFired: boolean;
}

interface GesturePointer {
  x: number;
  y: number;
  startedAt: number;
  direction: DirectionControl | null;
  source: string;
  repeater: HoldRepeater;
  cellsMoved: number;
}

interface TouchControlsOptions {
  host: HTMLElement;
  stage: HTMLElement;
  root: HTMLElement;
  input: InputManager;
  meta: GameMeta;
  storage: StorageApi;
  audio: AudioApi;
  onRestart: () => void;
  onFirstInput: () => void;
}

const DIRECTIONS: Record<DirectionControl, { icon: string; label: string }> = {
  up: { icon: '↑', label: 'Move up' },
  down: { icon: '↓', label: 'Soft drop' },
  left: { icon: '←', label: 'Move left' },
  right: { icon: '→', label: 'Move right' },
};
const LETTERS: Record<'action' | 'secondary' | 'hold', string> = {
  action: 'A', secondary: 'B', hold: 'H',
};
const TAP_ACTION_GAMES = new Set([
  'serpent', 'block-stack', 'brick-smash', 'paddle-duel', 'brick-runner',
  'rock-blaster', 'star-defender', 'maze-muncher', 'road-hopper',
]);
const CONTROL_KEYS: ControlName[] = ['up', 'down', 'left', 'right', 'action', 'secondary', 'hold'];

export class TouchControls {
  private readonly heldPointers = new Map<number, HeldPointer>();
  private readonly gesturePointers = new Map<number, GesturePointer>();
  private readonly dialog: HTMLDialogElement;
  private readonly settingsButton: HTMLButtonElement;
  private destroyed = false;

  constructor(private readonly options: TouchControlsOptions) {
    this.dialog = this.createDialog();
    this.settingsButton = options.root.querySelector<HTMLButtonElement>('#open-settings')!;
    options.root.append(this.dialog);
    this.settingsButton.addEventListener('click', this.openSettings);
    options.host.addEventListener('pointerdown', this.onButtonDown);
    options.host.addEventListener('pointerup', this.onButtonRelease);
    options.host.addEventListener('pointercancel', this.onButtonRelease);
    options.host.addEventListener('lostpointercapture', this.onButtonRelease);
    options.host.addEventListener('pointerleave', this.onButtonLeave);
    options.host.addEventListener('contextmenu', this.preventContextMenu);
    options.stage.addEventListener('pointerdown', this.onGestureDown);
    options.stage.addEventListener('pointermove', this.onGestureMove);
    options.stage.addEventListener('pointerup', this.onGestureUp);
    options.stage.addEventListener('pointercancel', this.onGestureCancel);
    options.stage.addEventListener('contextmenu', this.preventContextMenu);
    window.addEventListener('blur', this.releaseAll);
    window.addEventListener('keydown', this.onKeyboardInput);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.render();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.releaseAll();
    const { host, stage, root } = this.options;
    this.settingsButton.removeEventListener('click', this.openSettings);
    host.removeEventListener('pointerdown', this.onButtonDown);
    host.removeEventListener('pointerup', this.onButtonRelease);
    host.removeEventListener('pointercancel', this.onButtonRelease);
    host.removeEventListener('lostpointercapture', this.onButtonRelease);
    host.removeEventListener('pointerleave', this.onButtonLeave);
    host.removeEventListener('contextmenu', this.preventContextMenu);
    stage.removeEventListener('pointerdown', this.onGestureDown);
    stage.removeEventListener('pointermove', this.onGestureMove);
    stage.removeEventListener('pointerup', this.onGestureUp);
    stage.removeEventListener('pointercancel', this.onGestureCancel);
    stage.removeEventListener('contextmenu', this.preventContextMenu);
    window.removeEventListener('blur', this.releaseAll);
    window.removeEventListener('keydown', this.onKeyboardInput);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    root.removeChild(this.dialog);
  }

  private settingBoolean(key: string, fallback = false): boolean {
    if (key === 'gestures') {
      const prior = this.options.meta.id === 'block-stack'
        ? true
        : this.options.storage.getBoolean('touch:gestures', fallback);
      return this.options.storage.getBoolean(`touch:${this.options.meta.id}:gestures`, prior);
    }
    return this.options.storage.getBoolean(`touch:${key}`, fallback);
  }

  private controlScheme(): 'buttons' | 'gestures' | 'both' {
    const { meta, storage } = this.options;
    if (meta.id === 'twenty48') return 'buttons';
    if (storage.getBoolean(`touch:${meta.id}:both`, false)) return 'both';
    return this.settingBoolean('gestures', false) ? 'gestures' : 'buttons';
  }

  private saveGesturePreference(scheme: 'buttons' | 'gestures' | 'both'): void {
    this.options.storage.setBoolean(`touch:${this.options.meta.id}:gestures`, scheme !== 'buttons');
    this.options.storage.setBoolean(`touch:${this.options.meta.id}:both`, scheme === 'both');
  }

  private render(): void {
    const { host, meta } = this.options;
    const scheme = this.controlScheme();
    const choices = [56, 64, 72];
    const storedSize = this.options.storage.getNumber('touch:size', 72);
    const requestedSize = choices.includes(storedSize) ? storedSize : 72;
    const availableWidth = this.options.root.clientWidth || host.parentElement?.clientWidth || innerWidth;
    const heightBudget = Math.min(innerHeight * .30, 224);
    const heightFit = Math.floor((heightBudget - 40) / 2);
    const directions = meta.touchControls.dpad;
    const actionCount = meta.touchControls.buttons.filter((control) => control !== 'hold' || this.settingBoolean('hold-piece', false)).length;
    const isLandscapeTouch = matchMedia('(orientation: landscape) and (max-height: 560px) and (max-width: 1000px)').matches;
    const columns = isLandscapeTouch ? (directions.includes('left') && directions.includes('right') ? 2 : 1)
      : directions.includes('left') && directions.includes('right') ? 2
        : 1;
    const gridGaps = Math.max(0, columns - 1) * 8;
    const maxByWidth = Math.floor((availableWidth - 32 - gridGaps - (actionCount ? 24 : 0)) / (columns + (actionCount ? 1.58 : 0)));
    const size = Math.max(56, Math.min(requestedSize, heightFit, maxByWidth));
    const opacity = Math.max(.45, Math.min(1, this.options.storage.getNumber('touch:opacity', .92)));
    const handed = this.settingBoolean('left-handed', false) ? 'left' : 'right';
    const dpadClass = directions.length === 4 ? 'pad-cross' :
      directions.includes('left') && directions.includes('right') && directions.includes('down') ? 'pad-three-way' :
      directions.includes('left') && directions.includes('right') && directions.includes('up') ? 'pad-three-way-up' :
      directions.includes('left') && directions.includes('right') ? 'pad-horizontal' :
      directions.includes('up') && directions.includes('down') ? 'pad-vertical' : 'pad-free';
    const optional = new Set(meta.touchControls.optionalButtons ?? []);
    const buttons = meta.touchControls.buttons.filter((control) => !optional.has(control) || this.optionalEnabled(control));
    const pad = directions.length ? `<div class="touch-zone touch-zone-pad"><div class="touch-pad ${dpadClass}" role="group" aria-label="Directional controls">${directions.map((direction) => `
      <button class="pad-${direction}" type="button" data-control="${direction}" data-testid="control-${direction}" aria-label="${DIRECTIONS[direction].label}">${DIRECTIONS[direction].icon}</button>`).join('')}
    </div></div>` : '';
    const actionButtons = buttons.length ? `<div class="touch-zone touch-zone-actions" role="group" aria-label="Action controls">${buttons.map((control, index) => {
      const label = meta.touchControls.labels[control] ?? (control === 'hold' ? 'Hold piece' : control === 'action' ? 'Action' : 'Secondary action');
      const letter = LETTERS[control];
      return `<div class="touch-key touch-key-${control}" style="--key-index:${index}"><button class="touch-button touch-${control}" type="button" data-control="${control}" data-testid="control-${control}" aria-label="${letter}: ${label}"><span>${letter}</span></button><span class="touch-label">${label}</span></div>`;
    }).join('')}</div>` : '';
    host.dataset.scheme = scheme;
    host.dataset.handed = handed;
    host.dataset.holdEnabled = String(this.settingBoolean('hold-piece', false) && meta.id === 'block-stack');
    host.dataset.hasDpad = String(directions.length > 0);
    host.dataset.hasActions = String(buttons.length > 0);
    host.style.setProperty('--touch-size', `${size}px`);
    host.style.setProperty('--touch-opacity', String(opacity));
    host.innerHTML = scheme === 'gestures' ? '' : `${pad}${actionButtons}`;
    const layout = this.options.root.querySelector<HTMLElement>('#game-layout');
    if (layout) layout.dataset.controlScheme = scheme;
    document.documentElement.dataset.touchScheme = scheme;
    const holdRow = this.dialog.querySelector<HTMLElement>('[data-setting-hold-row]');
    if (holdRow) holdRow.hidden = meta.id !== 'block-stack';
    const holdSetting = this.dialog.querySelector<HTMLInputElement>('#setting-hold');
    if (holdSetting) holdSetting.checked = this.settingBoolean('hold-piece', false);
    this.syncSettingsDialog();
  }

  private optionalEnabled(control: ControlName): boolean {
    if (control === 'hold') return this.settingBoolean('hold-piece', false);
    return true;
  }

  private createDialog(): HTMLDialogElement {
    const dialog = document.createElement('dialog');
    dialog.className = 'control-settings game-menu-sheet';
    dialog.setAttribute('aria-labelledby', 'settings-title');
    dialog.innerHTML = `<form method="dialog" class="settings-form">
      <div class="settings-heading"><div><h2 id="settings-title">Game menu</h2><p>Controls and play settings</p></div><button class="settings-close" value="close" aria-label="Close menu">×</button></div>
      <label class="setting-row"><span><strong>Controls</strong><small>Choose buttons, gestures, or both where supported.</small></span><select id="setting-gestures" data-testid="setting-gestures"><option value="buttons">Buttons</option><option value="gestures">Gestures</option><option value="both">Both</option></select></label>
      <label class="setting-row"><span><strong>Button size</strong><small>Adjust touch target size.</small></span><select id="setting-size" data-testid="setting-size"><option value="56">Small</option><option value="64">Medium</option><option value="72">Large</option></select></label>
      <label class="setting-row"><span><strong>Repeat speed</strong><small>Delay and repeat rate for held directions.</small></span><select id="setting-repeat" data-testid="setting-repeat"><option value="slow">S · Slow</option><option value="medium">M · Medium</option><option value="fast">F · Fast</option></select></label>
      <label class="setting-row"><span><strong>Left-handed layout</strong><small>Swap the direction pad and action keys.</small></span><input id="setting-left-handed" type="checkbox" data-testid="setting-left-handed"></label>
      <label class="setting-row"><span><strong>Haptics</strong><small>Brief vibration when a control is pressed.</small></span><input id="setting-haptics" type="checkbox" data-testid="setting-haptics"></label>
      <label class="setting-row setting-slider"><span><strong>Control opacity</strong><small>Adjust how visible the buttons are.</small></span><input id="setting-opacity" type="range" min="45" max="100" step="5" data-testid="setting-opacity"></label>
      <label class="setting-row" data-setting-hold-row hidden><span><strong>Hold piece slot</strong><small>Show the Hold key and save one Block Stack piece.</small></span><input id="setting-hold" type="checkbox" data-testid="setting-hold"></label>
      <div class="settings-divider"></div>
      <label class="setting-row"><span><strong>CRT</strong><small>Scan lines and screen glow.</small></span><input id="setting-crt" type="checkbox" data-testid="setting-crt"></label>
      <label class="setting-row"><span><strong>Sound</strong><small>Arcade sound effects.</small></span><input id="setting-sound" type="checkbox" data-testid="setting-sound"></label>
      <button class="settings-restart" id="settings-restart" data-testid="settings-restart" type="button">Restart game</button>
      <p class="settings-footnote">Changes are saved on this device.</p>
    </form>`;
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.querySelector<HTMLSelectElement>('#setting-gestures')!.addEventListener('change', (event) => {
      this.saveGesturePreference((event.currentTarget as HTMLSelectElement).value as 'buttons' | 'gestures' | 'both');
      this.render();
    });
    dialog.querySelector<HTMLSelectElement>('#setting-size')!.addEventListener('change', (event) => {
      this.options.storage.setNumber('touch:size', Number((event.currentTarget as HTMLSelectElement).value));
      this.render();
    });
    dialog.querySelector<HTMLSelectElement>('#setting-repeat')!.addEventListener('change', (event) => {
      this.options.storage.setNumber(`touch:${this.options.meta.id}:repeat`, ({ slow: 0, medium: 1, fast: 2 } as const)[(event.currentTarget as HTMLSelectElement).value as 'slow' | 'medium' | 'fast']);
      this.syncSettingsDialog();
    });
    dialog.querySelector<HTMLInputElement>('#setting-left-handed')!.addEventListener('change', (event) => {
      this.options.storage.setBoolean('touch:left-handed', (event.currentTarget as HTMLInputElement).checked);
      this.render();
    });
    dialog.querySelector<HTMLInputElement>('#setting-haptics')!.addEventListener('change', (event) => {
      this.options.storage.setBoolean('touch:haptics', (event.currentTarget as HTMLInputElement).checked);
    });
    dialog.querySelector<HTMLInputElement>('#setting-opacity')!.addEventListener('input', (event) => {
      this.options.storage.setNumber('touch:opacity', Number((event.currentTarget as HTMLInputElement).value) / 100);
      this.render();
    });
    dialog.querySelector<HTMLInputElement>('#setting-hold')!.addEventListener('change', (event) => {
      this.options.storage.setBoolean('touch:hold-piece', (event.currentTarget as HTMLInputElement).checked);
      this.render();
    });
    dialog.querySelector<HTMLInputElement>('#setting-crt')!.addEventListener('change', (event) => {
      const enabled = (event.currentTarget as HTMLInputElement).checked;
      this.options.storage.setBoolean('crt', enabled);
      document.documentElement.dataset.crt = enabled ? 'on' : 'off';
    });
    dialog.querySelector<HTMLInputElement>('#setting-sound')!.addEventListener('change', (event) => {
      this.options.audio.setMuted(!(event.currentTarget as HTMLInputElement).checked);
    });
    dialog.querySelector<HTMLButtonElement>('#settings-restart')!.addEventListener('click', () => {
      dialog.close();
      this.options.onRestart();
    });
    return dialog;
  }

  private syncSettingsDialog(): void {
    const { storage } = this.options;
    const controls = this.dialog.querySelector<HTMLSelectElement>('#setting-gestures')!;
    controls.value = this.controlScheme();
    for (const option of controls.options) option.disabled = this.options.meta.id === 'twenty48' && option.value !== 'buttons';
    const size = storage.getNumber('touch:size', 72);
    this.dialog.querySelector<HTMLSelectElement>('#setting-size')!.value = String([56, 64, 72].includes(size) ? size : 72);
    const repeat = storage.getNumber(`touch:${this.options.meta.id}:repeat`, 1);
    this.dialog.querySelector<HTMLSelectElement>('#setting-repeat')!.value = repeat === 0 ? 'slow' : repeat === 2 ? 'fast' : 'medium';
    this.dialog.querySelector<HTMLInputElement>('#setting-left-handed')!.checked = this.settingBoolean('left-handed', false);
    this.dialog.querySelector<HTMLInputElement>('#setting-haptics')!.checked = this.settingBoolean('haptics', true);
    this.dialog.querySelector<HTMLInputElement>('#setting-opacity')!.value = String(Math.round(this.options.storage.getNumber('touch:opacity', .92) * 100));
    this.dialog.querySelector<HTMLInputElement>('#setting-crt')!.checked = storage.getBoolean('crt', true);
    this.dialog.querySelector<HTMLInputElement>('#setting-sound')!.checked = !this.options.audio.muted;
    const holdSetting = this.dialog.querySelector<HTMLInputElement>('#setting-hold');
    if (holdSetting) holdSetting.checked = this.settingBoolean('hold-piece', false);
  }

  private isGestures(): boolean {
    return this.controlScheme() !== 'buttons';
  }

  private repeatProfile(): { delay: number; interval: number } {
    const choice = this.options.storage.getNumber(`touch:${this.options.meta.id}:repeat`, 1);
    if (choice === 0) return { delay: 220, interval: 70 };
    if (choice === 2) return { delay: 90, interval: 26 };
    return { delay: 140, interval: 40 };
  }

  private openSettings = (): void => {
    this.syncSettingsDialog();
    this.dialog.showModal();
  };

  private onButtonDown = (event: PointerEvent): void => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-control]');
    if (!button || !this.options.host.contains(button)) return;
    event.preventDefault();
    const control = button.dataset.control as ControlName;
    if (!CONTROL_KEYS.includes(control)) return;
    if (this.heldPointers.has(event.pointerId)) return;
    const source = `pointer:${event.pointerId}`;
    const held: HeldPointer = { control, source, button, repeater: new HoldRepeater(), longPressTimer: null, longPressFollowupTimer: null, longPressFired: false };
    this.heldPointers.set(event.pointerId, held);
    this.options.input.setSourceButton(control, source, true);
    button.classList.add('is-pressed');
    try { button.setPointerCapture?.(event.pointerId); } catch { /* Synthetic events do not own browser pointer capture. */ }
    if (control === 'left' || control === 'right' || control === 'down' || control === 'up') {
      const profile = this.repeatProfile();
      const interval = control === 'down' ? 30 : profile.interval;
      held.repeater.start(() => this.options.input.pulse(control), profile.delay, interval);
    }
    if (control === 'action' && this.options.meta.id === 'block-stack') {
      held.longPressTimer = window.setTimeout(() => {
        if (!this.heldPointers.has(event.pointerId)) return;
        held.longPressFired = true;
        this.options.input.pulse('action');
        held.longPressFollowupTimer = window.setTimeout(() => this.options.input.pulse('action'), 45);
      }, 380);
    }
    this.options.onFirstInput();
    if (this.settingBoolean('haptics', true)) navigator.vibrate?.(8);
  };

  private onButtonRelease = (event: PointerEvent): void => {
    this.releasePointer(event.pointerId, event.type !== 'pointerup');
  };

  private onButtonLeave = (event: PointerEvent): void => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-control]');
    if (button && !button.hasPointerCapture?.(event.pointerId)) this.releasePointer(event.pointerId, true);
  };

  private releasePointer(pointerId: number, cancelled = false): void {
    const held = this.heldPointers.get(pointerId);
    if (!held) return;
    if (held.longPressTimer !== null) window.clearTimeout(held.longPressTimer);
    if (cancelled && held.longPressFollowupTimer !== null) window.clearTimeout(held.longPressFollowupTimer);
    held.repeater.stop();
    this.options.input.setSourceButton(held.control, held.source, false);
    this.heldPointers.delete(pointerId);
    if (![...this.heldPointers.values()].some((entry) => entry.control === held.control)) held.button.classList.remove('is-pressed');
    if (held.button.hasPointerCapture?.(pointerId)) held.button.releasePointerCapture(pointerId);
  }

  private gestureStep(): number {
    if (this.options.meta.id !== 'block-stack') return 28;
    return Math.max(24, this.options.stage.clientWidth / 10);
  }

  private onGestureDown = (event: PointerEvent): void => {
    if (!this.isGestures() || this.options.meta.id === 'twenty48' || event.button !== 0) return;
    const source = `gesture:${event.pointerId}`;
    this.gesturePointers.set(event.pointerId, {
      x: event.clientX, y: event.clientY, startedAt: performance.now(), direction: null,
      source, repeater: new HoldRepeater(), cellsMoved: 0,
    });
    this.options.onFirstInput();
  };

  private onGestureMove = (event: PointerEvent): void => {
    const gesture = this.gesturePointers.get(event.pointerId);
    if (!gesture) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    const step = this.gestureStep();
    const direction: DirectionControl | null = Math.abs(dx) > Math.abs(dy) && Math.abs(dx) >= step
      ? dx < 0 ? 'left' : 'right'
      : dy >= step ? 'down' : dy <= -step ? 'up' : null;
    if (!direction) return;
    if (gesture.direction !== direction) {
      this.releaseGestureDirection(gesture);
      gesture.direction = direction;
      gesture.cellsMoved = 1;
      this.options.input.setSourceButton(direction, gesture.source, true);
      this.options.input.pulse(direction);
      const profile = this.repeatProfile();
      gesture.repeater.start(() => this.options.input.pulse(direction), profile.delay, direction === 'down' ? 30 : profile.interval);
    }
    const distance = direction === 'left' || direction === 'right' ? Math.abs(dx) : Math.abs(dy);
    const crossedCells = Math.floor((distance + 1) / step);
    while (gesture.cellsMoved < crossedCells) {
      this.options.input.pulse(direction);
      gesture.cellsMoved += 1;
    }
  };

  private onGestureUp = (event: PointerEvent): void => {
    const gesture = this.gesturePointers.get(event.pointerId);
    if (!gesture) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    const duration = performance.now() - gesture.startedAt;
    if (Math.abs(dx) < 18 && Math.abs(dy) < 18 && duration < 350 && TAP_ACTION_GAMES.has(this.options.meta.id)) {
      this.options.input.pulse('action');
    } else if (Math.abs(dy) >= 55 && dy > 0 && duration < 280 && this.options.meta.touchControls.hardDropOnFlick) {
      this.options.input.pulse('secondary');
    } else if (!gesture.direction && Math.abs(dx) + Math.abs(dy) >= 28) {
      const direction: DirectionControl = Math.abs(dx) > Math.abs(dy) ? dx < 0 ? 'left' : 'right' : dy < 0 ? 'up' : 'down';
      this.options.input.pulse(direction);
    }
    this.releaseGesture(event.pointerId);
  };

  private onGestureCancel = (event: PointerEvent): void => this.releaseGesture(event.pointerId);

  private releaseGestureDirection(gesture: GesturePointer): void {
    if (!gesture.direction) return;
    gesture.repeater.stop();
    this.options.input.setSourceButton(gesture.direction, gesture.source, false);
    gesture.direction = null;
  }

  private releaseGesture(pointerId: number): void {
    const gesture = this.gesturePointers.get(pointerId);
    if (!gesture) return;
    this.releaseGestureDirection(gesture);
    this.gesturePointers.delete(pointerId);
  }

  private onVisibilityChange = (): void => {
    if (document.hidden) this.releaseAll();
  };

  private onKeyboardInput = (event: KeyboardEvent): void => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) {
      this.options.onFirstInput();
    }
  };

  private releaseAll = (): void => {
    for (const pointerId of [...this.heldPointers.keys()]) this.releasePointer(pointerId, true);
    for (const pointerId of [...this.gesturePointers.keys()]) this.releaseGesture(pointerId);
    this.options.input.clear();
  };

  private preventContextMenu = (event: Event): void => event.preventDefault();
}
