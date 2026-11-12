import type { ControlName, InputApi } from '../games/types';

const CONTROL_KEYS: Record<string, ControlName> = {
  ArrowUp: 'up', KeyW: 'up', KeyI: 'up',
  ArrowDown: 'down', KeyS: 'down', KeyK: 'down',
  ArrowLeft: 'left', KeyA: 'left', KeyJ: 'left',
  ArrowRight: 'right', KeyD: 'right', KeyL: 'right',
  Space: 'action', Enter: 'action', KeyZ: 'action',
  KeyX: 'secondary', KeyF: 'secondary', ShiftLeft: 'secondary', ShiftRight: 'secondary',
};

export class InputManager implements InputApi {
  private readonly downControls = new Set<ControlName>();
  private readonly pressedControls = new Set<ControlName>();
  private active = false;
  private onPause: () => void = () => undefined;
  private onRestart: () => void = () => undefined;

  constructor() {
    window.addEventListener('keydown', this.handleKeyDown, { passive: false });
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.clear);
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
    if (isDown) {
      if (!this.downControls.has(control)) this.pressedControls.add(control);
      this.downControls.add(control);
    } else {
      this.downControls.delete(control);
    }
  }

  pulse(control: ControlName): void {
    this.pressedControls.add(control);
  }

  finishFrame(): void {
    this.pressedControls.clear();
  }

  clear = (): void => {
    this.downControls.clear();
    this.pressedControls.clear();
  };

  destroy(): void {
    this.setActive(false);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.clear);
  }

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
    if (!event.repeat) this.setButton(control, true);
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    const control = CONTROL_KEYS[event.code];
    if (control) this.setButton(control, false);
  };
}
