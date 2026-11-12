export class HoldRepeater {
  private initialTimer: number | null = null;
  private repeatTimer: number | null = null;

  start(onRepeat: () => void, initialDelay = 150, interval = 45): void {
    this.stop();
    this.initialTimer = window.setTimeout(() => {
      onRepeat();
      this.repeatTimer = window.setInterval(onRepeat, interval);
    }, initialDelay);
  }

  stop(): void {
    if (this.initialTimer !== null) window.clearTimeout(this.initialTimer);
    if (this.repeatTimer !== null) window.clearInterval(this.repeatTimer);
    this.initialTimer = null;
    this.repeatTimer = null;
  }
}
