import type { Game, GameContext, GameMeta } from '../types';

const WIDTH = 480;
const HEIGHT = 640;
const COURT_TOP = 62;
const COURT_BOTTOM = HEIGHT - 22;
const PADDLE_WIDTH = 14;
const PADDLE_HEIGHT = 92;
const PLAYER_X = 28;
const AI_X = WIDTH - PLAYER_X - PADDLE_WIDTH;
const BALL_RADIUS = 9;
const PLAYER_SPEED = 410;
const AI_MAX_SPEED = 265;
const AI_REACTION = 0.11;
const SERVE_SPEED = 330;
const WINNING_SCORE = 7;

export const meta: GameMeta = {
  id: 'paddle-duel',
  title: 'Paddle Duel',
  description: 'Outplay a quick opponent and reach seven points first.',
  controls: 'Move with Up/Down or W/S. Press A or Space to serve.',
  accent: '#72e6ff',
};

export class PaddleDuelGame implements Game {
  readonly meta = meta;

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private context: GameContext | null = null;
  private playerY = HEIGHT / 2 - PADDLE_HEIGHT / 2;
  private aiY = this.playerY;
  private ballX = WIDTH / 2;
  private ballY = HEIGHT / 2;
  private ballVX = 0;
  private ballVY = 0;
  private playerScore = 0;
  private aiScore = 0;
  private serveDirection = 1;
  private aiReactionTimer = 0;
  private active = false;
  private paused = false;
  private destroyed = false;

  init(canvas: HTMLCanvasElement, context: GameContext): void {
    this.canvas = canvas;
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;
    this.ctx = canvas.getContext('2d');
    this.context = context;
    this.destroyed = false;
    this.paused = false;
    this.playerScore = 0;
    this.aiScore = 0;
    this.playerY = HEIGHT / 2 - PADDLE_HEIGHT / 2;
    this.aiY = this.playerY;
    this.active = false;
    this.serveDirection = 1;
    this.resetBall();
    context.score.reset();
    context.setStatus('ready');
    this.render();
  }

  update(dt: number): void {
    if (this.destroyed || this.paused || !this.context || !this.ctx) return;
    const elapsed = Math.min(Math.max(dt, 0), 0.05);
    const input = this.context.input;
    const direction = (input.down('down') ? 1 : 0) - (input.down('up') ? 1 : 0);
    this.playerY = this.clamp(
      this.playerY + direction * PLAYER_SPEED * elapsed,
      COURT_TOP,
      COURT_BOTTOM - PADDLE_HEIGHT,
    );

    if (!this.active) {
      this.resetBall();
      if (input.pressed('action')) this.serve();
      return;
    }

    this.updateAi(elapsed);
    this.ballX += this.ballVX * elapsed;
    this.ballY += this.ballVY * elapsed;
    this.bounceFromWalls();
    this.bounceFromPaddle(PLAYER_X, this.playerY, true);
    this.bounceFromPaddle(AI_X, this.aiY, false);

    if (this.ballX + BALL_RADIUS < 0) this.awardPoint(false);
    else if (this.ballX - BALL_RADIUS > WIDTH) this.awardPoint(true);
  }

  render(): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const background = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    background.addColorStop(0, '#071523');
    background.addColorStop(1, '#0b2631');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    this.drawHeader(ctx);
    this.drawCourt(ctx);
    this.drawPaddle(ctx, PLAYER_X, this.playerY, '#72e6ff');
    this.drawPaddle(ctx, AI_X, this.aiY, '#ff9dca');
    this.drawBall(ctx);
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    if (!this.destroyed) this.paused = false;
  }

  destroy(): void {
    this.destroyed = true;
    this.active = false;
    this.canvas = null;
    this.ctx = null;
    this.context = null;
  }

  private serve(): void {
    this.active = true;
    this.context?.setStatus('playing');
    const vertical = (Math.random() * 2 - 1) * 145;
    this.ballVX = this.serveDirection * SERVE_SPEED;
    this.ballVY = vertical;
    this.context?.audio.tone(520, 75, 'square', 0.06);
  }

  private resetBall(): void {
    this.ballX = WIDTH / 2;
    this.ballY = (COURT_TOP + COURT_BOTTOM) / 2;
    this.ballVX = 0;
    this.ballVY = 0;
    this.aiReactionTimer = 0;
  }

  private updateAi(dt: number): void {
    this.aiReactionTimer -= dt;
    if (this.aiReactionTimer > 0) return;
    this.aiReactionTimer = AI_REACTION;

    const target = this.ballVX > 0
      ? this.ballY - PADDLE_HEIGHT / 2
      : (COURT_TOP + COURT_BOTTOM - PADDLE_HEIGHT) / 2;
    const difference = target - this.aiY;
    const movement = this.clamp(difference, -AI_MAX_SPEED * AI_REACTION, AI_MAX_SPEED * AI_REACTION);
    this.aiY = this.clamp(this.aiY + movement, COURT_TOP, COURT_BOTTOM - PADDLE_HEIGHT);
  }

  private bounceFromWalls(): void {
    if (this.ballY - BALL_RADIUS <= COURT_TOP) {
      this.ballY = COURT_TOP + BALL_RADIUS;
      this.ballVY = Math.abs(this.ballVY);
      this.beep(330);
    } else if (this.ballY + BALL_RADIUS >= COURT_BOTTOM) {
      this.ballY = COURT_BOTTOM - BALL_RADIUS;
      this.ballVY = -Math.abs(this.ballVY);
      this.beep(330);
    }
  }

  private bounceFromPaddle(x: number, y: number, player: boolean): void {
    const movingToward = player ? this.ballVX < 0 : this.ballVX > 0;
    const overlapsY = this.ballY + BALL_RADIUS >= y && this.ballY - BALL_RADIUS <= y + PADDLE_HEIGHT;
    const overlapsX = player
      ? this.ballX - BALL_RADIUS <= x + PADDLE_WIDTH && this.ballX + BALL_RADIUS >= x
      : this.ballX + BALL_RADIUS >= x && this.ballX - BALL_RADIUS <= x + PADDLE_WIDTH;
    if (!movingToward || !overlapsY || !overlapsX) return;

    const center = y + PADDLE_HEIGHT / 2;
    const offset = this.clamp((this.ballY - center) / (PADDLE_HEIGHT / 2), -1, 1);
    const speed = Math.min(560, Math.max(330, Math.hypot(this.ballVX, this.ballVY) * 1.025));
    const horizontal = Math.sqrt(Math.max(155 * 155, speed * speed - (offset * 275) ** 2));
    this.ballVX = player ? horizontal : -horizontal;
    this.ballVY = offset * 275;
    this.ballX = player ? x + PADDLE_WIDTH + BALL_RADIUS : x - BALL_RADIUS;
    this.beep(player ? 650 : 510);
  }

  private awardPoint(playerScored: boolean): void {
    this.active = false;
    this.ballVX = 0;
    this.ballVY = 0;
    if (playerScored) {
      this.playerScore += 1;
      this.context?.score.add(1);
      this.context?.audio.tone(820, 120, 'triangle', 0.07);
      this.serveDirection = 1;
    } else {
      this.aiScore += 1;
      this.context?.audio.tone(170, 150, 'sawtooth', 0.06);
      this.serveDirection = -1;
    }

    if (this.playerScore >= WINNING_SCORE || this.aiScore >= WINNING_SCORE) {
      this.context?.setStatus('over');
      return;
    }
    this.resetBall();
    this.context?.setStatus('ready');
  }

  private drawHeader(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(2, 8, 16, 0.88)';
    ctx.fillRect(0, 0, WIDTH, 54);
    ctx.fillStyle = '#72e6ff';
    ctx.font = '700 13px monospace';
    ctx.fillText('PLAYER', 34, 20);
    ctx.fillStyle = '#ff9dca';
    ctx.fillText('OPPONENT', WIDTH - 104, 20);
    ctx.font = '700 25px monospace';
    ctx.fillStyle = '#e9fbff';
    ctx.fillText(String(this.playerScore), 38, 46);
    ctx.fillStyle = '#ffe6f1';
    ctx.fillText(String(this.aiScore), WIDTH - 47, 46);
    ctx.fillStyle = 'rgba(151, 224, 235, 0.7)';
    ctx.font = '11px monospace';
    ctx.fillText('FIRST TO 7', WIDTH / 2 - 34, 31);
  }

  private drawCourt(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = 'rgba(140, 227, 238, 0.26)';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, COURT_TOP, WIDTH - 20, COURT_BOTTOM - COURT_TOP);
    ctx.setLineDash([7, 11]);
    ctx.strokeStyle = 'rgba(140, 227, 238, 0.25)';
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2, COURT_TOP);
    ctx.lineTo(WIDTH / 2, COURT_BOTTOM);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(140, 227, 238, 0.16)';
    for (let y = COURT_TOP + 18; y < COURT_BOTTOM; y += 34) ctx.fillRect(WIDTH / 2 - 1, y, 2, 14);
  }

  private drawPaddle(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, PADDLE_WIDTH, PADDLE_HEIGHT);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(x + 3, y + 7, 3, PADDLE_HEIGHT - 14);
    ctx.restore();
  }

  private drawBall(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ecffff';
    ctx.fillStyle = '#f4ffff';
    ctx.beginPath();
    ctx.arc(this.ballX, this.ballY, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private beep(frequency: number): void {
    this.context?.audio.tone(frequency, 38, 'sine', 0.035);
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.max(minimum, Math.min(maximum, value));
  }
}

export function createPaddleDuel(): Game {
  return new PaddleDuelGame();
}
