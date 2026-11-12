import type { Game, GameStatus } from '../games/types';
import type { InputManager } from './input';

const STEP = 1 / 60;
const MAX_STEPS = 8;

export class FixedGameLoop {
  private frameId = 0;
  private running = false;
  private lastTime = 0;
  private accumulator = 0;

  constructor(
    private readonly game: Game,
    private readonly input: InputManager,
    private readonly status: () => GameStatus,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = 0;
    this.frameId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frameId);
    this.accumulator = 0;
  }

  private frame = (timestamp: number): void => {
    if (!this.running) return;
    if (this.lastTime === 0) this.lastTime = timestamp;
    const elapsed = Math.min((timestamp - this.lastTime) / 1000, 0.2);
    this.lastTime = timestamp;
    this.accumulator = Math.min(this.accumulator + elapsed, STEP * MAX_STEPS);

    let steps = 0;
    while (this.accumulator >= STEP && steps < MAX_STEPS) {
      const current = this.status();
      if (current === 'ready' || current === 'playing') this.game.update(STEP);
      else this.input.finishFrame();
      this.input.finishFrame();
      this.accumulator -= STEP;
      steps += 1;
    }

    if (steps === 0 && (this.status() === 'paused' || this.status() === 'over')) this.input.finishFrame();
    this.game.render();
    this.frameId = requestAnimationFrame(this.frame);
  };
}
