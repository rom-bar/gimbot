import type { Game, GameContext, GameMeta } from '../types';

const WIDTH = 480;
const HEIGHT = 640;
const PADDLE_WIDTH = 92;
const PADDLE_HEIGHT = 12;
const PADDLE_Y = HEIGHT - 54;
const BALL_RADIUS = 7;
const BRICK_COLUMNS = 8;
const BRICK_ROWS = 6;
const BRICK_WIDTH = 49;
const BRICK_HEIGHT = 20;
const BRICK_GAP = 7;
const BRICK_LEFT = (WIDTH - (BRICK_COLUMNS * BRICK_WIDTH + (BRICK_COLUMNS - 1) * BRICK_GAP)) / 2;
const BRICK_TOP = 76;

export const meta: GameMeta = {
  id: 'brick-smash',
  title: 'Brick Smash',
  description: 'Guide the neon ball through six rows of shifting color.',
  controls: 'Move the paddle with the arrows or WASD, then press A or Space to launch.',
  accent: '#ff4fd8',
};

interface Brick {
  x: number;
  y: number;
  hue: number;
  alive: boolean;
}

export class BrickSmashGame implements Game {
  readonly meta = meta;

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private context: GameContext | null = null;
  private paddleX = WIDTH / 2 - PADDLE_WIDTH / 2;
  private paddleTargetX = this.paddleX;
  private ballX = WIDTH / 2;
  private ballY = PADDLE_Y - BALL_RADIUS - 2;
  private ballVX = 0;
  private ballVY = 0;
  private bricks: Brick[] = [];
  private lives = 3;
  private level = 1;
  private launched = false;
  private destroyed = false;
  private paused = false;
  private launchSide = 1;

  init(canvas: HTMLCanvasElement, context: GameContext): void {
    this.canvas = canvas;
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;
    this.ctx = canvas.getContext('2d');
    this.context = context;
    this.destroyed = false;
    this.paused = false;
    this.lives = 3;
    this.level = 1;
    this.launched = false;
    this.paddleX = WIDTH / 2 - PADDLE_WIDTH / 2;
    this.paddleTargetX = this.paddleX;
    this.buildBricks();
    this.attachBall();
    context.setStatus('ready');
    this.render();
  }

  update(dt: number): void {
    if (this.destroyed || this.paused || !this.context) return;
    const input = this.context.input;
    const direction = (input.down('right') ? 1 : 0) - (input.down('left') ? 1 : 0);
    if (direction !== 0) {
      this.paddleTargetX += direction * 390 * dt;
      this.paddleTargetX = this.clamp(this.paddleTargetX, 10, WIDTH - PADDLE_WIDTH - 10);
    }
    this.paddleX += (this.paddleTargetX - this.paddleX) * Math.min(1, dt * 18);

    if (!this.launched) {
      this.attachBall();
      if (input.pressed('action')) this.launch();
      return;
    }
    if (input.pressed('action')) return;

    this.ballX += this.ballVX * dt;
    this.ballY += this.ballVY * dt;
    this.collideWithWalls();
    this.collideWithPaddle();
    this.collideWithBrick();

    if (this.ballY - BALL_RADIUS > HEIGHT) this.loseLife();
  }

  render(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, '#080d25');
    gradient.addColorStop(0.55, '#10133b');
    gradient.addColorStop(1, '#08091b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    this.drawStars(ctx);
    this.drawHeader(ctx);
    this.drawBricks(ctx);
    this.drawPaddle(ctx);
    this.drawBall(ctx);
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  destroy(): void {
    this.destroyed = true;
    this.canvas = null;
    this.ctx = null;
    this.context = null;
    this.bricks = [];
  }

  private buildBricks(): void {
    this.bricks = [];
    for (let row = 0; row < BRICK_ROWS; row += 1) {
      for (let column = 0; column < BRICK_COLUMNS; column += 1) {
        this.bricks.push({
          x: BRICK_LEFT + column * (BRICK_WIDTH + BRICK_GAP),
          y: BRICK_TOP + row * (BRICK_HEIGHT + BRICK_GAP),
          hue: 170 + row * 28 + column * 5,
          alive: true,
        });
      }
    }
  }

  private attachBall(): void {
    this.ballX = this.paddleX + PADDLE_WIDTH / 2;
    this.ballY = PADDLE_Y - BALL_RADIUS - 3;
    this.ballVX = 0;
    this.ballVY = 0;
  }

  private launch(): void {
    if (!this.context) return;
    this.launched = true;
    this.launchSide *= -1;
    const speed = 305 + (this.level - 1) * 24;
    this.ballVX = this.launchSide * (125 + this.level * 8);
    this.ballVY = -Math.sqrt(speed * speed - this.ballVX * this.ballVX);
    this.context.setStatus('playing');
    this.context.audio.tone(520, 90, 'square', 0.07);
  }

  private collideWithWalls(): void {
    if (this.ballX - BALL_RADIUS <= 8) {
      this.ballX = 8 + BALL_RADIUS;
      this.ballVX = Math.abs(this.ballVX);
      this.beep(260);
    } else if (this.ballX + BALL_RADIUS >= WIDTH - 8) {
      this.ballX = WIDTH - 8 - BALL_RADIUS;
      this.ballVX = -Math.abs(this.ballVX);
      this.beep(260);
    }
    if (this.ballY - BALL_RADIUS <= 52) {
      this.ballY = 52 + BALL_RADIUS;
      this.ballVY = Math.abs(this.ballVY);
      this.beep(320);
    }
  }

  private collideWithPaddle(): void {
    const overlapsX = this.ballX >= this.paddleX - BALL_RADIUS && this.ballX <= this.paddleX + PADDLE_WIDTH + BALL_RADIUS;
    const movingDown = this.ballVY > 0;
    const reachesPaddle = this.ballY + BALL_RADIUS >= PADDLE_Y && this.ballY - BALL_RADIUS <= PADDLE_Y + PADDLE_HEIGHT;
    if (!overlapsX || !movingDown || !reachesPaddle) return;
    const hit = this.clamp((this.ballX - (this.paddleX + PADDLE_WIDTH / 2)) / (PADDLE_WIDTH / 2), -1, 1);
    const speed = Math.max(300, Math.hypot(this.ballVX, this.ballVY));
    this.ballVX = hit * Math.min(260, speed * 0.82);
    this.ballVY = -Math.sqrt(Math.max(120 * 120, speed * speed - this.ballVX * this.ballVX));
    this.ballY = PADDLE_Y - BALL_RADIUS - 1;
    this.beep(610);
  }

  private collideWithBrick(): void {
    for (const brick of this.bricks) {
      if (!brick.alive) continue;
      const closestX = this.clamp(this.ballX, brick.x, brick.x + BRICK_WIDTH);
      const closestY = this.clamp(this.ballY, brick.y, brick.y + BRICK_HEIGHT);
      const dx = this.ballX - closestX;
      const dy = this.ballY - closestY;
      if (dx * dx + dy * dy > BALL_RADIUS * BALL_RADIUS) continue;
      brick.alive = false;
      this.context?.score.add(10);
      this.beep(760 + brick.hue);
      if (Math.abs(dx) > Math.abs(dy)) this.ballVX *= -1;
      else this.ballVY *= -1;
      if (this.bricks.every((candidate) => !candidate.alive)) this.advanceLevel();
      return;
    }
  }

  private advanceLevel(): void {
    this.level += 1;
    this.buildBricks();
    this.launched = false;
    this.attachBall();
    this.context?.audio.tone(980, 150, 'triangle', 0.09);
  }

  private loseLife(): void {
    this.lives -= 1;
    this.context?.audio.tone(150, 180, 'sawtooth', 0.08);
    if (this.lives <= 0) {
      this.launched = false;
      this.context?.setStatus('over');
      return;
    }
    this.launched = false;
    this.attachBall();
  }

  private drawStars(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (let i = 0; i < 30; i += 1) {
      const x = (i * 97 + 23) % WIDTH;
      const y = 58 + ((i * 61) % (HEIGHT - 65));
      const alpha = 0.2 + (i % 4) * 0.1;
      ctx.fillStyle = `rgba(130, 223, 255, ${alpha})`;
      ctx.fillRect(x, y, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
    }
    ctx.restore();
  }

  private drawHeader(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(5, 7, 20, 0.82)';
    ctx.fillRect(0, 0, WIDTH, 42);
    ctx.strokeStyle = 'rgba(104, 245, 255, 0.32)';
    ctx.beginPath();
    ctx.moveTo(0, 42);
    ctx.lineTo(WIDTH, 42);
    ctx.stroke();
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#8ef6ff';
    ctx.fillText(`LEVEL ${this.level}`, 18, 27);
    ctx.fillStyle = '#ff80df';
    ctx.fillText(`SCORE ${this.context?.score.current() ?? 0}`, 180, 27);
    ctx.fillStyle = '#ffd86e';
    ctx.fillText(`LIVES ${'◆'.repeat(this.lives)}`, 350, 27);
  }

  private drawBricks(ctx: CanvasRenderingContext2D): void {
    for (const brick of this.bricks) {
      if (!brick.alive) continue;
      ctx.save();
      ctx.shadowBlur = 12;
      ctx.shadowColor = `hsl(${brick.hue}, 100%, 65%)`;
      ctx.fillStyle = `hsl(${brick.hue}, 82%, 58%)`;
      ctx.fillRect(brick.x, brick.y, BRICK_WIDTH, BRICK_HEIGHT);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.36)';
      ctx.fillRect(brick.x + 3, brick.y + 3, BRICK_WIDTH - 6, 3);
      ctx.restore();
    }
  }

  private drawPaddle(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = '#ff4fd8';
    const gradient = ctx.createLinearGradient(this.paddleX, PADDLE_Y, this.paddleX + PADDLE_WIDTH, PADDLE_Y);
    gradient.addColorStop(0, '#ff55c8');
    gradient.addColorStop(0.5, '#fff0ff');
    gradient.addColorStop(1, '#7cceff');
    ctx.fillStyle = gradient;
    ctx.fillRect(this.paddleX, PADDLE_Y, PADDLE_WIDTH, PADDLE_HEIGHT);
    ctx.restore();
  }

  private drawBall(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#aafcff';
    ctx.fillStyle = '#e8ffff';
    ctx.beginPath();
    ctx.arc(this.ballX, this.ballY, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private beep(frequency: number): void {
    this.context?.audio.tone(frequency, 42, 'sine', 0.035);
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.max(minimum, Math.min(maximum, value));
  }
}

export function createBrickSmash(): Game {
  return new BrickSmashGame();
}
