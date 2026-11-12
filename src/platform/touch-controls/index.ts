import type { InputManager } from '../../core/input';
import type { ControlName, DirectionControl, GameMeta, StorageApi } from '../../games/types';
import { HoldRepeater } from './repeater';

interface HeldPointer {
  control: ControlName;
  source: string;
  button: HTMLButtonElement;
  repeater: HoldRepeater;
}

interface GesturePointer {
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  startedAt: number;
  direction: DirectionControl | null;
  source: string;
  repeater: HoldRepeater;
}

interface TouchControlsOptions {
  host: HTMLElement;
  stage: HTMLElement;
  root: HTMLElement;
  input: InputManager;
  meta: GameMeta;
  storage: StorageApi;
  onFirstInput: () => void;
}

const DIRECTIONS: Record<DirectionControl, { icon: string; label: string }> = {
  up: { icon: '↑', label: 'Move up' },
  down: { icon: '↓', label: 'Move down' },
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
    window.removeEventListener('blur', this.releaseAll);
    window.removeEventListener('keydown', this.onKeyboardInput);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    root.removeChild(this.dialog);
  }

  private settingBoolean(key: string, fallback = false): boolean {
    return this.options.storage.getBoolean(`touch:${key}`, fallback);
  }

  private settingNumber(key: string, fallback: number): number {
    return this.options.storage.getNumber(`touch:${key}`, fallback);
  }

  private isGestures(): boolean {
    return this.settingBoolean('gestures', false);
  }

  private render(): void {
    const { host, meta } = this.options;
    const gestures = this.isGestures();
    const requestedSize = [56, 60, 68].includes(this.settingNumber('size', 60)) ? this.settingNumber('size', 60) : 60;
    const availableWidth = this.options.root.clientWidth || host.parentElement?.clientWidth || innerWidth;
    const maximumFittingSize = Math.floor((availableWidth - 78) / 4);
    const size = Math.max(56, Math.min(requestedSize, maximumFittingSize));
    const opacity = Math.max(.45, Math.min(1, this.settingNumber('opacity', .92)));
    const handed = this.settingBoolean('left-handed', false) ? 'left' : 'right';
    const directions = meta.touchControls.dpad;
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
    host.dataset.scheme = gestures ? 'gestures' : 'buttons';
    host.dataset.handed = handed;
    host.dataset.holdEnabled = String(this.settingBoolean('hold-piece', false) && meta.id === 'block-stack');
    host.dataset.hasDpad = String(directions.length > 0);
    host.dataset.hasActions = String(buttons.length > 0);
    host.style.setProperty('--touch-size', `${size}px`);
    host.style.setProperty('--touch-opacity', String(opacity));
    host.innerHTML = `${pad}${actionButtons}${gestures ? '<span class="gesture-hint" aria-live="polite">Swipe to move · tap to act</span>' : ''}`;
    document.documentElement.dataset.touchScheme = gestures ? 'gestures' : 'buttons';
    if (meta.id === 'block-stack') {
      this.dialog.querySelector<HTMLElement>('[data-setting-hold-row]')!.hidden = false;
      this.dialog.querySelector<HTMLInputElement>('#setting-hold')!.checked = this.settingBoolean('hold-piece', false);
    } else {
      this.dialog.querySelector<HTMLElement>('[data-setting-hold-row]')!.hidden = true;
    }
    this.syncSettingsDialog();
  }

  private optionalEnabled(control: ControlName): boolean {
    if (control === 'hold') return this.settingBoolean('hold-piece', false);
    return true;
  }

  private createDialog(): HTMLDialogElement {
    const dialog = document.createElement('dialog');
    dialog.className = 'control-settings';
    dialog.setAttribute('aria-labelledby', 'settings-title');
    dialog.innerHTML = `<form method="dialog" class="settings-form">
      <div class="settings-heading"><div><p class="settings-kicker">Arcade controls</p><h2 id="settings-title">Play settings</h2></div><button class="settings-close" value="close" aria-label="Close settings">×</button></div>
      <label class="setting-row"><span><strong>Control scheme</strong><small>Choose how to play on touch screens.</small></span><select id="setting-gestures" data-testid="setting-gestures"><option value="false">Buttons</option><option value="true">Gestures</option></select></label>
      <label class="setting-row"><span><strong>Button size</strong><small>Small, medium or large; adapts on narrow screens.</small></span><select id="setting-size" data-testid="setting-size"><option value="56">Small</option><option value="60">Medium</option><option value="68">Large</option></select></label>
      <label class="setting-row"><span><strong>Left-handed layout</strong><small>Swap the direction pad and action keys.</small></span><input id="setting-left-handed" type="checkbox" data-testid="setting-left-handed"></label>
      <label class="setting-row"><span><strong>Haptics</strong><small>Vibrate briefly when a control is pressed.</small></span><input id="setting-haptics" type="checkbox" data-testid="setting-haptics"></label>
      <label class="setting-row setting-slider"><span><strong>Control opacity</strong><small>Adjust how visible the buttons are.</small></span><input id="setting-opacity" type="range" min="45" max="100" step="5" data-testid="setting-opacity"></label>
      <label class="setting-row" data-setting-hold-row hidden><span><strong>Hold piece slot</strong><small>Show the Hold key and save one Block Stack piece.</small></span><input id="setting-hold" type="checkbox" data-testid="setting-hold"></label>
      <div class="settings-divider"></div>
      <label class="setting-row"><span><strong>CRT effect</strong><small>Scan lines and screen glow.</small></span><input id="setting-crt" type="checkbox" data-testid="setting-crt"></label>
      <label class="setting-row"><span><strong>Sound</strong><small>Arcade sound effects.</small></span><input id="setting-sound" type="checkbox" data-testid="setting-sound"></label>
      <p class="settings-footnote">Changes are saved on this device.</p>
    </form>`;
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.querySelector<HTMLSelectElement>('#setting-gestures')!.addEventListener('change', (event) => {
      this.options.storage.setBoolean('touch:gestures', (event.currentTarget as HTMLSelectElement).value === 'true');
      this.render();
    });
    dialog.querySelector<HTMLSelectElement>('#setting-size')!.addEventListener('change', (event) => {
      this.options.storage.setNumber('touch:size', Number((event.currentTarget as HTMLSelectElement).value));
      this.render();
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
    dialog.querySelector<HTMLInputElement>('#setting-crt')!.addEventListener('change', () => {
      document.querySelector<HTMLButtonElement>('#crt-toggle')?.click();
      this.syncSettingsDialog();
    });
    dialog.querySelector<HTMLInputElement>('#setting-sound')!.addEventListener('change', () => {
      document.querySelector<HTMLButtonElement>('#sound-toggle')?.click();
      this.syncSettingsDialog();
    });
    return dialog;
  }

  private syncSettingsDialog(): void {
    const { storage } = this.options;
    this.dialog.querySelector<HTMLSelectElement>('#setting-gestures')!.value = String(this.isGestures());
    this.dialog.querySelector<HTMLSelectElement>('#setting-size')!.value = String(this.settingNumber('size', 60));
    this.dialog.querySelector<HTMLInputElement>('#setting-left-handed')!.checked = this.settingBoolean('left-handed', false);
    this.dialog.querySelector<HTMLInputElement>('#setting-haptics')!.checked = this.settingBoolean('haptics', true);
    this.dialog.querySelector<HTMLInputElement>('#setting-opacity')!.value = String(Math.round(this.settingNumber('opacity', .92) * 100));
    this.dialog.querySelector<HTMLInputElement>('#setting-crt')!.checked = storage.getBoolean('crt', true);
    const sound = document.querySelector<HTMLButtonElement>('#sound-toggle');
    this.dialog.querySelector<HTMLInputElement>('#setting-sound')!.checked = sound?.getAttribute('aria-pressed') === 'true';
    this.dialog.querySelector<HTMLInputElement>('#setting-hold')!.checked = this.settingBoolean('hold-piece', false);
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
    const repeater = new HoldRepeater();
    this.heldPointers.set(event.pointerId, { control, source, button, repeater });
    this.options.input.setSourceButton(control, source, true);
    button.classList.add('is-pressed');
    try { button.setPointerCapture?.(event.pointerId); } catch { /* synthetic events do not own browser pointer capture */ }
    if (control === 'left' || control === 'right' || control === 'down' || control === 'up') {
      const delay = 150;
      const interval = control === 'down' ? 30 : control === 'left' || control === 'right' ? 45 : 50;
      repeater.start(() => this.options.input.pulse(control), delay, interval);
    }
    this.options.onFirstInput();
    if (this.settingBoolean('haptics', true)) navigator.vibrate?.(10);
  };

  private onButtonRelease = (event: PointerEvent): void => {
    this.releasePointer(event.pointerId);
  };

  private onButtonLeave = (event: PointerEvent): void => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-control]');
    if (button && !button.hasPointerCapture?.(event.pointerId)) this.releasePointer(event.pointerId);
  };

  private releasePointer(pointerId: number): void {
    const held = this.heldPointers.get(pointerId);
    if (!held) return;
    held.repeater.stop();
    this.options.input.setSourceButton(held.control, held.source, false);
    this.heldPointers.delete(pointerId);
    if (![...this.heldPointers.values()].some((entry) => entry.control === held.control)) held.button.classList.remove('is-pressed');
    if (held.button.hasPointerCapture?.(pointerId)) held.button.releasePointerCapture(pointerId);
  }

  private onGestureDown = (event: PointerEvent): void => {
    if (!this.isGestures() || this.options.meta.id === 'twenty48' || event.button !== 0) return;
    const source = `gesture:${event.pointerId}`;
    this.gesturePointers.set(event.pointerId, {
      x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY,
      startedAt: performance.now(), direction: null, source, repeater: new HoldRepeater(),
    });
    this.options.onFirstInput();
  };

  private onGestureMove = (event: PointerEvent): void => {
    const gesture = this.gesturePointers.get(event.pointerId);
    if (!gesture) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    const direction: DirectionControl | null = Math.abs(dx) > Math.abs(dy) && Math.abs(dx) >= 28
      ? dx < 0 ? 'left' : 'right'
      : dy >= 28 ? 'down' : dy <= -28 ? 'up' : null;
    if (!direction) return;
    if (gesture.direction !== direction) {
      this.releaseGestureDirection(gesture);
      gesture.direction = direction;
      this.options.input.setSourceButton(direction, gesture.source, true);
      const interval = direction === 'down' ? 30 : direction === 'left' || direction === 'right' ? 45 : 50;
      gesture.repeater.start(() => this.options.input.pulse(direction), 150, interval);
    }
    const distance = direction === 'left' || direction === 'right' ? Math.abs(event.clientX - gesture.lastX) : Math.abs(event.clientY - gesture.lastY);
    if (distance >= 28) this.options.input.pulse(direction);
    gesture.lastX = event.clientX;
    gesture.lastY = event.clientY;
  };

  private onGestureUp = (event: PointerEvent): void => {
    const gesture = this.gesturePointers.get(event.pointerId);
    if (!gesture) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    const duration = performance.now() - gesture.startedAt;
    if (Math.abs(dx) < 28 && Math.abs(dy) < 28 && duration < 350 && TAP_ACTION_GAMES.has(this.options.meta.id)) {
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
    for (const pointerId of [...this.heldPointers.keys()]) this.releasePointer(pointerId);
    for (const pointerId of [...this.gesturePointers.keys()]) this.releaseGesture(pointerId);
    this.options.input.clear();
  };

  private preventContextMenu = (event: Event): void => event.preventDefault();
}
