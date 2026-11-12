import type { ControlName, InputApi } from '../games/types';

const CONTROL_KEYS: Record<string, ControlName> = {
  ArrowUp: 'up', KeyW: 'up', KeyI: 'up',
  ArrowDown: 'down', KeyS: 'down', KeyK: 'down',
  ArrowLeft: 'left', KeyA: 'left', KeyJ: 'left',
  ArrowRight: 'right', KeyD: 'right', KeyL: 'right',
  Space: 'action', Enter: 'action', KeyZ: 'action',
  KeyX: 'secondary', KeyF: 'secondary', ShiftLeft: 'secondary', ShiftRight: 'secondary',
  KeyC: 'hold',
};

export class InputManager implements InputApi {
  private readonly sources = new Map<ControlName, Set<string>>();
  private readonly downControls = new Set<ControlName>();
  private readonly pressedControls = new Set<ControlName>();
  private readonly pulseCounts = new Map<ControlName, number>();
  private active = false;
  private onPause: () => void = () => undefined;
  private onRestart: () => void = () => undefined;

  constructor() {
    window.addEventListener('keydown', this.handleKeyDown, { passive: false });
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.clear);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  setActive(active: boolean): void {
    this.active = active;
    if (!active) this.clear();
  }

  setShortcuts(onPause: () => void, onRestart: () => void): void {
    this.onPause = onPause;
    this.onRestart = onRestart;
  }

  down(control: ControlName): boolean {
    return this.downControls.has(control);
  }

  pressed(control: ControlName): boolean {
    return this.pressedControls.has(control);
  }

  setButton(control: ControlName, isDown: boolean): void {
    this.setSourceButton(control, 'legacy', isDown);
  }

  setSourceButton(control: ControlName, source: string, isDown: boolean): void {
    let holders = this.sources.get(control);
    if (!holders) {
      holders = new Set<string>();
      this.sources.set(control, holders);
    }
    if (isDown) {
      if (holders.has(source)) return;
      holders.add(source);
      if (!this.downControls.has(control)) this.pressedControls.add(control);
      this.downControls.add(control);
      return;
    }
    holders.delete(source);
    if (holders.size === 0) {
      this.sources.delete(control);
      this.downControls.delete(control);
    }
  }

  pulse(control: ControlName): void {
    this.pressedControls.add(control);
    this.pulseCounts.set(control, (this.pulseCounts.get(control) ?? 0) + 1);
  }

  finishFrame(): void {
    this.pressedControls.clear();
  }

  snapshot(): { down: ControlName[]; pressed: ControlName[]; pulses: Record<string, number> } {
    return { down: [...this.downControls], pressed: [...this.pressedControls], pulses: Object.fromEntries(this.pulseCounts) };
  }

  clear = (): void => {
    this.sources.clear();
    this.downControls.clear();
    this.pressedControls.clear();
  };

  destroy(): void {
    this.setActive(false);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.clear);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private handleVisibilityChange = (): void => {
    if (document.hidden) this.clear();
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.active) return;
    if (event.code === 'Escape' || event.code === 'KeyP') {
      event.preventDefault();
      if (!event.repeat) this.onPause();
      return;
    }
    if (event.code === 'KeyR') {
      event.preventDefault();
      if (!event.repeat) this.onRestart();
      return;
    }
    const control = CONTROL_KEYS[event.code];
    if (!control) return;
    event.preventDefault();
    this.setSourceButton(control, `key:${event.code}`, true);
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    const control = CONTROL_KEYS[event.code];
    if (control) this.setSourceButton(control, `key:${event.code}`, false);
  };
}
