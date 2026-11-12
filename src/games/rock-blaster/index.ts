import type { Game, GameContext, GameMeta } from '../types';

const WIDTH = 480;
const HEIGHT = 640;
const TAU = Math.PI * 2;
const MAX_DT = 0.1;
const SHIP_RADIUS = 13;
const SHIP_TURN_SPEED = 4.2;
const SHIP_THRUST = 230;
const SHIP_DRAG = 0.992;
const BULLET_SPEED = 410;
const BULLET_LIFE = 1.25;
const FIRE_DELAY = 0.18;
const RESPAWN_GRACE = 1.5;

type Size = 0 | 1 | 2;

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  radius: number;
  size: Size;
  shape: number[];
  seed: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export const meta: GameMeta = {
  id: 'rock-blaster',
  title: 'Rock Blaster',
  description: 'Pilot a nimble ship, split drifting rocks, and clear each wave.',
  controls: 'Left/Right rotate · Up or A thrust · Space or action fire',
  accent: '#67e8f9',
};

export class RockBlasterGame implements Game {
  readonly meta = meta;

  private ctx: CanvasRenderingContext2D | null = null;
  private gameContext: GameContext | null = null;
  private shipX = WIDTH / 2;
  private shipY = HEIGHT / 2;
  private shipVX = 0;
  private shipVY = 0;
  private shipAngle = -Math.PI / 2;
  private rocks: Body[] = [];
  private bullets: Bullet[] = [];
  private wave = 1;
  private lives = 3;
  private fireTimer = 0;
  private graceTimer = RESPAWN_GRACE;
  private started = false;
  private paused = false;
  private destroyed = false;
  private randomState = 0x2f6e2b1;

  init(canvas: HTMLCanvasElement, context: GameContext): void {
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    this.ctx = canvas.getContext('2d');
    this.gameContext = context;
    this.destroyed = false;
    this.paused = false;
    this.started = false;
    this.wave = 1;
    this.lives = 3;
    this.randomState = 0x2f6e2b1;
    this.resetShip();
    this.bullets = [];
    this.rocks = this.createWave(this.wave);
    context.score.reset();
    context.setStatus('ready');
    this.render();
  }

  update(dt: number): void {
    if (this.destroyed || this.paused || !this.gameContext) return;
    const elapsed = Math.max(0, Math.min(dt, MAX_DT));
    const input = this.gameContext.input;
    const rotate = (input.down('right') ? 1 : 0) - (input.down('left') ? 1 : 0);
    const thrusting = input.down('up') || input.down('secondary');

    if (!this.started && this.lives <= 0 && input.pressed('action')) {
      this.wave = 1;
      this.lives = 3;
      this.bullets = [];
      this.rocks = this.createWave(this.wave);
      this.resetShip();
      this.gameContext.score.reset();
    }
    if (!this.started && (input.pressed('action') || input.pressed('secondary') || input.down('up'))) {
      this.started = true;
      this.gameContext.setStatus('playing');
      this.gameContext.audio.tone(420, 75, 'square', 0.06);
    }
    if (!this.started) return;

    this.shipAngle += rotate * SHIP_TURN_SPEED * elapsed;
    if (thrusting) {
      this.shipVX += Math.cos(this.shipAngle) * SHIP_THRUST * elapsed;
      this.shipVY += Math.sin(this.shipAngle) * SHIP_THRUST * elapsed;
    }
    this.shipVX *= Math.pow(SHIP_DRAG, elapsed * 60);
    this.shipVY *= Math.pow(SHIP_DRAG, elapsed * 60);
    this.shipX = this.wrap(this.shipX + this.shipVX * elapsed, WIDTH);
    this.shipY = this.wrap(this.shipY + this.shipVY * elapsed, HEIGHT);
    this.graceTimer = Math.max(0, this.graceTimer - elapsed);
    this.fireTimer -= elapsed;

    if (input.pressed('action') && this.fireTimer <= 0) {
      this.fire();
    }
    this.updateBullets(elapsed);
    this.updateRocks(elapsed);
    this.checkCollisions();
    if (this.rocks.length === 0) this.startNextWave();
  }

  render(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, '#071324');
    gradient.addColorStop(1, '#020611');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    this.drawStars(ctx);
    this.drawHud(ctx);
    for (const rock of this.rocks) this.drawRock(ctx, rock);
    for (const bullet of this.bullets) this.drawBullet(ctx, bullet);
    if (this.graceTimer <= 0 || Math.floor(this.graceTimer * 12) % 2 === 0) this.drawShip(ctx);
    if (!this.started && this.gameContext?.score.current() === 0) this.drawPrompt(ctx, 'PRESS ACTION TO LAUNCH');
    if (this.gameContext && this.lives <= 0) this.drawPrompt(ctx, 'SHIP LOST — PRESS ACTION TO RETRY');
    ctx.restore();
  }

  pause(): void {
    if (!this.destroyed && this.started && this.lives > 0) {
      this.paused = true;
      this.gameContext?.setStatus('paused');
    }
  }

  resume(): void {
    if (!this.destroyed && this.started && this.lives > 0) {
      this.paused = false;
      this.gameContext?.setStatus('playing');
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.paused = false;
    this.ctx = null;
    this.gameContext = null;
    this.rocks = [];
    this.bullets = [];
  }

  private resetShip(): void {
    this.shipX = WIDTH / 2;
    this.shipY = HEIGHT / 2;
    this.shipVX = 0;
    this.shipVY = 0;
    this.shipAngle = -Math.PI / 2;
    this.graceTimer = RESPAWN_GRACE;
    this.fireTimer = 0;
  }

  private fire(): void {
    const noseX = this.shipX + Math.cos(this.shipAngle) * (SHIP_RADIUS + 4);
    const noseY = this.shipY + Math.sin(this.shipAngle) * (SHIP_RADIUS + 4);
    this.bullets.push({
      x: noseX,
      y: noseY,
      vx: this.shipVX + Math.cos(this.shipAngle) * BULLET_SPEED,
      vy: this.shipVY + Math.sin(this.shipAngle) * BULLET_SPEED,
      life: BULLET_LIFE,
    });
    this.fireTimer = FIRE_DELAY;
    this.gameContext?.audio.tone(720, 34, 'square', 0.045);
  }

  private updateBullets(dt: number): void {
    for (const bullet of this.bullets) {
      bullet.x = this.wrap(bullet.x + bullet.vx * dt, WIDTH);
      bullet.y = this.wrap(bullet.y + bullet.vy * dt, HEIGHT);
      bullet.life -= dt;
    }
    this.bullets = this.bullets.filter((bullet) => bullet.life > 0);
  }

  private updateRocks(dt: number): void {
    for (const rock of this.rocks) {
      rock.x = this.wrap(rock.x + rock.vx * dt, WIDTH);
      rock.y = this.wrap(rock.y + rock.vy * dt, HEIGHT);
      rock.angle += rock.spin * dt;
    }
  }

  private checkCollisions(): void {
    for (let bulletIndex = this.bullets.length - 1; bulletIndex >= 0; bulletIndex -= 1) {
      const bullet = this.bullets[bulletIndex];
      let hitIndex = -1;
      for (let rockIndex = 0; rockIndex < this.rocks.length; rockIndex += 1) {
        const rock = this.rocks[rockIndex];
        if (this.distanceSquared(bullet.x, bullet.y, rock.x, rock.y) <= (rock.radius + 3) ** 2) {
          hitIndex = rockIndex;
          break;
        }
      }
      if (hitIndex < 0) continue;
      const [rock] = this.rocks.splice(hitIndex, 1);
      this.bullets.splice(bulletIndex, 1);
      this.gameContext?.score.add(rock.size === 2 ? 20 : rock.size === 1 ? 35 : 60);
      this.gameContext?.audio.tone(rock.size === 2 ? 270 : 510, 55, 'triangle', 0.05);
      if (rock.size > 0) {
        this.rocks.push(this.splitRock(rock, -1), this.splitRock(rock, 1));
      }
    }

    if (this.graceTimer <= 0) {
      for (const rock of this.rocks) {
        if (this.distanceSquared(this.shipX, this.shipY, rock.x, rock.y) < (rock.radius + SHIP_RADIUS - 3) ** 2) {
          this.loseLife();
          break;
        }
      }
    }
  }

  private loseLife(): void {
    this.lives -= 1;
    this.gameContext?.audio.tone(130, 180, 'sawtooth', 0.08);
    this.bullets = [];
    if (this.lives <= 0) {
      this.started = false;
      this.gameContext?.setStatus('over');
      return;
    }
    this.resetShip();
  }

  private startNextWave(): void {
    this.wave += 1;
    this.rocks = this.createWave(this.wave);
    this.resetShip();
    this.gameContext?.audio.tone(900, 120, 'triangle', 0.07);
  }

  private createWave(wave: number): Body[] {
    const count = Math.min(10, 3 + wave);
    const rocks: Body[] = [];
    for (let index = 0; index < count; index += 1) {
      let x = this.random() * WIDTH;
      let y = this.random() * HEIGHT;
      if (this.distanceSquared(x, y, WIDTH / 2, HEIGHT / 2) < 150 ** 2) {
        x = this.wrap(x + WIDTH / 2, WIDTH);
        y = this.wrap(y + HEIGHT / 2, HEIGHT);
      }
      rocks.push(this.makeRock(x, y, 2, 0.8 + wave * 0.025));
    }
    return rocks;
  }

  private makeRock(x: number, y: number, size: Size, speedScale: number): Body {
    const radii: Record<Size, number> = { 0: 14, 1: 25, 2: 43 };
    const radius = radii[size];
    const seed = this.random();
    const sides = 7 + Math.floor(this.random() * 3);
    const shape: number[] = [];
    for (let index = 0; index < sides; index += 1) shape.push(0.72 + this.random() * 0.48);
    const direction = this.random() * TAU;
    const speed = (size === 2 ? 30 : size === 1 ? 55 : 85) * speedScale;
    return {
      x, y, radius, size, shape, seed,
      vx: Math.cos(direction) * speed,
      vy: Math.sin(direction) * speed,
      angle: this.random() * TAU,
      spin: (this.random() - 0.5) * 1.8,
    };
  }

  private splitRock(parent: Body, side: -1 | 1): Body {
    const size = (parent.size - 1) as Size;
    const offsetAngle = Math.atan2(parent.vy, parent.vx) + side * 0.8;
    const offset = parent.radius * 0.45;
    const child = this.makeRock(
      this.wrap(parent.x + Math.cos(offsetAngle) * offset, WIDTH),
      this.wrap(parent.y + Math.sin(offsetAngle) * offset, HEIGHT),
      size,
      1,
    );
    child.vx += parent.vx * 0.35 + Math.cos(offsetAngle) * 26;
    child.vy += parent.vy * 0.35 + Math.sin(offsetAngle) * 26;
    return child;
  }

  private drawShip(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.shipX, this.shipY);
    ctx.rotate(this.shipAngle);
    ctx.strokeStyle = '#baf7ff';
    ctx.fillStyle = '#123749';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 14;
    ctx.shadowColor = '#67e8f9';
    ctx.beginPath();
    ctx.moveTo(17, 0);
    ctx.lineTo(-11, -10);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-11, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (this.gameContext?.input.down('up') || this.gameContext?.input.down('secondary')) {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(-9, -4);
      ctx.lineTo(-20 - this.random() * 4, 0);
      ctx.lineTo(-9, 4);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawRock(ctx: CanvasRenderingContext2D, rock: Body): void {
    ctx.save();
    ctx.translate(rock.x, rock.y);
    ctx.rotate(rock.angle);
    ctx.strokeStyle = rock.size === 2 ? '#9ca3af' : rock.size === 1 ? '#cbd5e1' : '#f1f5f9';
    ctx.fillStyle = rock.size === 2 ? '#263342' : rock.size === 1 ? '#334155' : '#475569';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(103, 232, 249, 0.3)';
    ctx.beginPath();
    for (let index = 0; index < rock.shape.length; index += 1) {
      const angle = (index / rock.shape.length) * TAU;
      const distance = rock.radius * rock.shape[index];
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawBullet(ctx: CanvasRenderingContext2D, bullet: Bullet): void {
    ctx.save();
    ctx.fillStyle = '#fef08a';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#facc15';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 2.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  private drawStars(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(186, 230, 253, 0.5)';
    for (let index = 0; index < 55; index += 1) {
      const x = (index * 83 + 19) % WIDTH;
      const y = (index * 137 + 31) % HEIGHT;
      const size = index % 7 === 0 ? 2 : 1;
      ctx.fillRect(x, y, size, size);
    }
  }

  private drawHud(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(2, 6, 17, 0.9)';
    ctx.fillRect(0, 0, WIDTH, 44);
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#67e8f9';
    ctx.fillText(`WAVE ${this.wave}`, 16, 27);
    ctx.fillStyle = '#fef08a';
    ctx.fillText(`SCORE ${this.gameContext?.score.current() ?? 0}`, 166, 27);
    ctx.fillStyle = '#fda4af';
    ctx.fillText(`LIVES ${'●'.repeat(Math.max(0, this.lives))}`, 350, 27);
  }

  private drawPrompt(ctx: CanvasRenderingContext2D, text: string): void {
    ctx.save();
    ctx.fillStyle = 'rgba(2, 6, 17, 0.72)';
    ctx.fillRect(45, HEIGHT / 2 - 28, WIDTH - 90, 56);
    ctx.strokeStyle = '#67e8f9';
    ctx.strokeRect(45, HEIGHT / 2 - 28, WIDTH - 90, 56);
    ctx.fillStyle = '#e0f2fe';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, WIDTH / 2, HEIGHT / 2 + 5);
    ctx.restore();
  }

  private random(): number {
    this.randomState = (this.randomState * 1664525 + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }

  private wrap(value: number, limit: number): number {
    return ((value % limit) + limit) % limit;
  }

  private distanceSquared(ax: number, ay: number, bx: number, by: number): number {
    return (ax - bx) ** 2 + (ay - by) ** 2;
  }
}

export function createRockBlaster(): Game {
  return new RockBlasterGame();
}
