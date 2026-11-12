import type { Game, GameContext, GameMeta, ControlName } from '../types';

type Direction = 'up' | 'down' | 'left' | 'right';
type Point = { x: number; y: number };

const WIDTH = 480;
const HEIGHT = 640;
const CELL = 20;
const COLUMNS = WIDTH / CELL;
const ROWS = HEIGHT / CELL;
const START_LENGTH = 4;
const INITIAL_STEP = 0.14;
const MIN_STEP = 0.065;

const DIRECTIONS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

export const meta: GameMeta = {
  id: 'serpent',
  title: 'Serpent',
  description: 'Guide the growing serpent, collect fruit, and survive the grid.',
  controls: 'Arrow keys / WASD to move · Space / A to start',
  accent: '#6df4cf',
};

export function createSerpent(): Game {
  return new SerpentGame();
}

export class SerpentGame implements Game {
  public readonly meta = meta;

  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private gameContext: GameContext | null = null;
  private snake: Point[] = [];
  private fruit: Point = { x: 0, y: 0 };
  private direction: Direction = 'right';
  private queuedDirection: Direction = 'right';
  private elapsed = 0;
  private running = false;
  private destroyed = false;

  public init(canvas: HTMLCanvasElement, context: GameContext): void {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.gameContext = context;
    this.destroyed = false;
    this.resetState();
    context.setStatus('ready');
  }

  public update(dt: number): void {
    if (this.destroyed || !this.gameContext) {
      return;
    }

    this.readDirection();
    if (!this.running) return;
    this.elapsed += Math.max(0, Math.min(dt, 0.25));
    const step = this.stepDuration();

    while (this.elapsed >= step && this.running) {
      this.elapsed -= step;
      this.advance();
    }
  }

  public render(): void {
    const canvas = this.canvas;
    const context = this.context;
    if (!canvas || !context) {
      return;
    }

    const width = canvas.width || WIDTH;
    const height = canvas.height || HEIGHT;
    const scaleX = width / WIDTH;
    const scaleY = height / HEIGHT;

    context.save();
    context.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    context.imageSmoothingEnabled = false;
    context.fillStyle = '#071b20';
    context.fillRect(0, 0, WIDTH, HEIGHT);

    this.drawGrid(context);
    this.drawFruit(context);
    this.drawSnake(context);
    this.drawFrame(context);
    context.restore();
  }

  public pause(): void {
    if (this.running) {
      this.running = false;
      this.gameContext?.setStatus('paused');
    }
  }

  public resume(): void {
    if (!this.destroyed && this.gameContext && this.snake.length > 0) {
      this.running = true;
      this.gameContext.setStatus('playing');
    }
  }

  public destroy(): void {
    this.running = false;
    this.destroyed = true;
    this.canvas = null;
    this.context = null;
    this.gameContext = null;
    this.snake = [];
  }

  private resetState(): void {
    const centerY = Math.floor(ROWS / 2);
    const centerX = Math.floor(COLUMNS / 2);
    this.snake = [];
    for (let index = 0; index < START_LENGTH; index += 1) {
      this.snake.push({ x: centerX - index, y: centerY });
    }
    this.direction = 'right';
    this.queuedDirection = 'right';
    this.elapsed = 0;
    this.running = false;
    this.spawnFruit();
    this.gameContext?.score.reset();
  }

  private readDirection(): void {
    const input = this.gameContext?.input;
    if (!input) {
      return;
    }

    const controls: Array<[Direction, ControlName]> = [
      ['up', 'up'],
      ['down', 'down'],
      ['left', 'left'],
      ['right', 'right'],
    ];

    for (const [direction, control] of controls) {
      if ((input.pressed(control) || input.down(control)) && direction !== OPPOSITE[this.direction]) {
        this.queuedDirection = direction;
        break;
      }
    }

    if (!this.running && (input.pressed('action') || input.down('action'))) {
      this.running = true;
      this.gameContext?.setStatus('playing');
      this.gameContext?.audio.tone(440, 80, 'square', 0.06);
    }
  }

  private advance(): void {
    this.direction = this.queuedDirection;
    const vector = DIRECTIONS[this.direction];
    const head = this.snake[0];
    const next = { x: head.x + vector.x, y: head.y + vector.y };
    const eating = next.x === this.fruit.x && next.y === this.fruit.y;
    const bodyToCheck = eating ? this.snake : this.snake.slice(0, -1);

    if (
      next.x < 0 ||
      next.x >= COLUMNS ||
      next.y < 0 ||
      next.y >= ROWS ||
      bodyToCheck.some((part) => part.x === next.x && part.y === next.y)
    ) {
      this.running = false;
      this.gameContext?.setStatus('over');
      this.gameContext?.audio.tone(110, 180, 'sawtooth', 0.08);
      return;
    }

    this.snake.unshift(next);
    if (eating) {
      this.gameContext?.score.add(10);
      this.gameContext?.audio.tone(660, 85, 'square', 0.07);
      this.spawnFruit();
    } else {
      this.snake.pop();
    }
  }

  private stepDuration(): number {
    const score = this.gameContext?.score.current() ?? 0;
    return Math.max(MIN_STEP, INITIAL_STEP - Math.floor(score / 50) * 0.008);
  }

  private spawnFruit(): void {
    const occupied = new Set(this.snake.map((part) => `${part.x},${part.y}`));
    const empty: Point[] = [];
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLUMNS; x += 1) {
        if (!occupied.has(`${x},${y}`)) {
          empty.push({ x, y });
        }
      }
    }
    if (empty.length > 0) {
      this.fruit = empty[Math.floor(Math.random() * empty.length)];
    }
  }

  private drawGrid(context: CanvasRenderingContext2D): void {
    context.strokeStyle = 'rgba(109, 244, 207, 0.08)';
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 0; x <= WIDTH; x += CELL) {
      context.moveTo(x + 0.5, 0);
      context.lineTo(x + 0.5, HEIGHT);
    }
    for (let y = 0; y <= HEIGHT; y += CELL) {
      context.moveTo(0, y + 0.5);
      context.lineTo(WIDTH, y + 0.5);
    }
    context.stroke();
  }

  private drawFruit(context: CanvasRenderingContext2D): void {
    const x = this.fruit.x * CELL;
    const y = this.fruit.y * CELL;
    context.fillStyle = '#ff5ca8';
    context.fillRect(x + 5, y + 4, 10, 12);
    context.fillRect(x + 3, y + 7, 14, 6);
    context.fillStyle = '#ffc1df';
    context.fillRect(x + 6, y + 6, 3, 3);
    context.fillStyle = '#6df4cf';
    context.fillRect(x + 10, y + 2, 3, 4);
  }

  private drawSnake(context: CanvasRenderingContext2D): void {
    this.snake.forEach((part, index) => {
      const x = part.x * CELL;
      const y = part.y * CELL;
      context.fillStyle = index === 0 ? '#d4fff4' : '#6df4cf';
      context.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
      context.fillStyle = index === 0 ? '#6df4cf' : '#31b99c';
      context.fillRect(x + 5, y + 5, CELL - 10, CELL - 5);
      if (index === 0) {
        this.drawEyes(context, x, y);
      }
    });
  }

  private drawEyes(context: CanvasRenderingContext2D, x: number, y: number): void {
    context.fillStyle = '#071b20';
    if (this.direction === 'left' || this.direction === 'right') {
      const eyeX = this.direction === 'right' ? x + 13 : x + 4;
      context.fillRect(eyeX, y + 5, 3, 3);
      context.fillRect(eyeX, y + 12, 3, 3);
    } else {
      const eyeY = this.direction === 'down' ? y + 13 : y + 4;
      context.fillRect(x + 5, eyeY, 3, 3);
      context.fillRect(x + 12, eyeY, 3, 3);
    }
  }

  private drawFrame(context: CanvasRenderingContext2D): void {
    context.strokeStyle = '#6df4cf';
    context.lineWidth = 2;
    context.strokeRect(1, 1, WIDTH - 2, HEIGHT - 2);
  }
}
