import type { Game, GameContext, GameMeta } from '../types';

const WIDTH = 480;
const HEIGHT = 640;
const HEADER = 48;
const PLAYER_W = 28;
const PLAYER_H = 22;
const PLAYER_Y = HEIGHT - 58;
const PLAYER_SPEED = 310;
const PLAYER_SHOT_SPEED = 460;
const ENEMY_W = 26;
const ENEMY_H = 20;
const ENEMY_SHOT_SPEED = 175;
const MAX_DT = 0.05;

export const meta: GameMeta = {
  id: 'star-defender',
  title: 'Star Defender',
  description: 'Defend the lower sky, clear descending formations, and survive every wave.',
  controls: 'Move with arrows or WASD · press A or Space to fire',
  accent: '#64e7ff',
};

interface Enemy {
  x: number;
  y: number;
  column: number;
  row: number;
  alive: boolean;
}

interface Shot {
  x: number;
  y: number;
  vy: number;
  friendly: boolean;
}

export class StarDefenderGame implements Game {
  readonly meta = meta;

  private ctx: CanvasRenderingContext2D | null = null;
  private gameContext: GameContext | null = null;
  private playerX = WIDTH / 2 - PLAYER_W / 2;
  private enemies: Enemy[] = [];
  private shots: Shot[] = [];
  private lives = 3;
  private level = 1;
  private formationOffset = 0;
  private formationDirection = 1;
  private descent = 0;
  private enemyFireTimer = 0;
  private shotCooldown = 0;
  private destroyed = false;
  private paused = false;
  private active = false;

  init(canvas: HTMLCanvasElement, context: GameContext): void {
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    this.ctx = canvas.getContext('2d');
    this.gameContext = context;
    this.destroyed = false;
    this.paused = false;
    this.active = false;
    this.lives = 3;
    this.level = 1;
    this.playerX = WIDTH / 2 - PLAYER_W / 2;
    this.shots = [];
    this.buildWave();
    context.score.reset();
    context.setStatus('ready');
    this.render();
  }

  update(dt: number): void {
    if (this.destroyed || this.paused || !this.gameContext) return;
    const elapsed = Math.max(0, Math.min(dt, MAX_DT));
    const input = this.gameContext.input;

    if (!this.active) {
      if (input.pressed('action')) this.start();
      return;
    }

    const direction = (input.down('right') ? 1 : 0) - (input.down('left') ? 1 : 0);
    this.playerX = this.clamp(this.playerX + direction * PLAYER_SPEED * elapsed, 10, WIDTH - PLAYER_W - 10);
    this.shotCooldown = Math.max(0, this.shotCooldown - elapsed);
    if (input.pressed('action') || input.down('action')) this.firePlayerShot();

    this.moveFormation(elapsed);
    this.enemyFireTimer -= elapsed;
    if (this.enemyFireTimer <= 0) this.fireEnemyShot();
    this.updateShots(elapsed);
    this.checkBreach();

    if (this.enemies.length > 0 && this.enemies.every((enemy) => !enemy.alive)) {
      this.level += 1;
      this.gameContext.audio.tone(880 + this.level * 30, 130, 'triangle', 0.07);
      this.buildWave();
    }
  }

  render(): void {
    const context = this.ctx;
    if (!context) return;
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.imageSmoothingEnabled = false;
    const background = context.createLinearGradient(0, 0, 0, HEIGHT);
    background.addColorStop(0, '#070d28');
    background.addColorStop(1, '#10152f');
    context.fillStyle = background;
    context.fillRect(0, 0, WIDTH, HEIGHT);
    this.drawStars(context);
    this.drawHeader(context);
    this.drawEnemies(context);
    this.drawShots(context);
    this.drawPlayer(context);
    context.strokeStyle = 'rgba(100, 231, 255, 0.35)';
    context.strokeRect(1, HEADER, WIDTH - 2, HEIGHT - HEADER - 1);
    context.restore();
  }

  pause(): void {
    if (!this.destroyed && this.active) {
      this.paused = true;
      this.gameContext?.setStatus('paused');
    }
  }

  resume(): void {
    if (!this.destroyed && this.active && this.lives > 0) {
      this.paused = false;
      this.gameContext?.setStatus('playing');
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.active = false;
    this.ctx = null;
    this.gameContext = null;
    this.enemies = [];
    this.shots = [];
  }

  private start(): void {
    if (!this.gameContext) return;
    this.active = true;
    this.paused = false;
    this.gameContext.setStatus('playing');
    this.gameContext.audio.tone(520, 75, 'square', 0.06);
  }

  private buildWave(): void {
    const rows = Math.min(3 + this.level, 7);
    const columns = Math.min(6 + Math.floor((this.level - 1) / 2), 9);
    const gapX = 18;
    const totalWidth = columns * ENEMY_W + (columns - 1) * gapX;
    const left = (WIDTH - totalWidth) / 2;
    this.enemies = [];
    this.formationOffset = 0;
    this.formationDirection = 1;
    this.descent = 0;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        this.enemies.push({
          x: left + column * (ENEMY_W + gapX),
          y: HEADER + 28 + row * 30,
          column,
          row,
          alive: true,
        });
      }
    }
    this.shots = this.shots.filter((shot) => shot.friendly);
    this.enemyFireTimer = Math.max(0.42, 1.2 - this.level * 0.06);
  }

  private moveFormation(dt: number): void {
    const speed = 24 + this.level * 5;
    this.formationOffset += this.formationDirection * speed * dt;
    const leftLimit = 12;
    const rightLimit = WIDTH - 12;
    const alive = this.enemies.filter((enemy) => enemy.alive);
    if (alive.length === 0) return;
    const minX = Math.min(...alive.map((enemy) => enemy.x + this.formationOffset));
    const maxX = Math.max(...alive.map((enemy) => enemy.x + this.formationOffset + ENEMY_W));
    if (minX <= leftLimit || maxX >= rightLimit) {
      this.formationDirection *= -1;
      this.formationOffset += this.formationDirection * speed * dt;
      this.descent += 9 + this.level * 1.5;
    }
  }

  private firePlayerShot(): void {
    if (!this.gameContext || this.shotCooldown > 0) return;
    this.shots.push({ x: this.playerX + PLAYER_W / 2 - 2, y: PLAYER_Y - 8, vy: -PLAYER_SHOT_SPEED, friendly: true });
    this.shotCooldown = 0.2;
    this.gameContext.audio.tone(740, 42, 'square', 0.045);
  }

  private fireEnemyShot(): void {
    if (!this.gameContext) return;
    const candidates = this.enemies.filter((enemy) => enemy.alive);
    if (candidates.length === 0) return;
    const index = (this.level + Math.floor(this.enemyFireTimer * 100)) % candidates.length;
    const enemy = candidates[index];
    this.shots.push({
      x: enemy.x + this.formationOffset + ENEMY_W / 2 - 2,
      y: enemy.y + this.descent + ENEMY_H,
      vy: ENEMY_SHOT_SPEED + this.level * 8,
      friendly: false,
    });
    this.enemyFireTimer = Math.max(0.42, 1.25 - this.level * 0.06);
  }

  private updateShots(dt: number): void {
    for (const shot of this.shots) shot.y += shot.vy * dt;
    this.shots = this.shots.filter((shot) => shot.y > HEADER - 16 && shot.y < HEIGHT + 14);

    for (const shot of this.shots) {
      if (!shot.friendly) {
        if (this.overlaps(shot.x, shot.y, 4, 12, this.playerX, PLAYER_Y, PLAYER_W, PLAYER_H)) {
          shot.y = HEIGHT + 20;
          this.loseLife();
        }
        continue;
      }
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        const enemyX = enemy.x + this.formationOffset;
        const enemyY = enemy.y + this.descent;
        if (!this.overlaps(shot.x, shot.y, 4, 10, enemyX, enemyY, ENEMY_W, ENEMY_H)) continue;
        enemy.alive = false;
        shot.y = -20;
        this.gameContext?.score.add(10 * this.level);
        this.gameContext?.audio.tone(610 + enemy.row * 35, 58, 'square', 0.05);
        break;
      }
    }
  }

  private checkBreach(): void {
    const lowest = this.enemies.filter((enemy) => enemy.alive).reduce((value, enemy) => {
      return Math.max(value, enemy.y + this.descent + ENEMY_H);
    }, 0);
    if (lowest >= PLAYER_Y - 10) this.endGame();
  }

  private loseLife(): void {
    if (!this.active || !this.gameContext) return;
    this.lives -= 1;
    this.gameContext.audio.tone(140, 170, 'sawtooth', 0.08);
    this.shots = this.shots.filter((shot) => shot.friendly);
    if (this.lives <= 0) this.endGame();
  }

  private endGame(): void {
    if (!this.active) return;
    this.active = false;
    this.gameContext?.setStatus('over');
    this.gameContext?.audio.tone(100, 220, 'sawtooth', 0.08);
  }

  private drawHeader(context: CanvasRenderingContext2D): void {
    context.fillStyle = 'rgba(4, 7, 22, 0.92)';
    context.fillRect(0, 0, WIDTH, HEADER);
    context.font = 'bold 14px monospace';
    context.fillStyle = '#64e7ff';
    context.fillText(`WAVE ${this.level}`, 16, 29);
    context.fillStyle = '#fff0a8';
    context.fillText(`SCORE ${this.gameContext?.score.current() ?? 0}`, 175, 29);
    context.fillStyle = '#ff779d';
    context.fillText(`LIVES ${'◆'.repeat(Math.max(0, this.lives))}`, 352, 29);
  }

  private drawStars(context: CanvasRenderingContext2D): void {
    for (let index = 0; index < 42; index += 1) {
      const x = (index * 83 + 17) % WIDTH;
      const y = HEADER + ((index * 47 + 11) % (HEIGHT - HEADER));
      context.fillStyle = index % 4 === 0 ? '#9cf5ff' : 'rgba(125, 166, 223, 0.55)';
      context.fillRect(x, y, index % 4 === 0 ? 2 : 1, index % 4 === 0 ? 2 : 1);
    }
  }

  private drawEnemies(context: CanvasRenderingContext2D): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const x = Math.round(enemy.x + this.formationOffset);
      const y = Math.round(enemy.y + this.descent);
      const color = enemy.row % 2 === 0 ? '#ff668f' : '#b776ff';
      context.fillStyle = color;
      context.fillRect(x + 5, y, ENEMY_W - 10, 4);
      context.fillRect(x + 2, y + 4, ENEMY_W - 4, 9);
      context.fillRect(x, y + 9, 7, 7);
      context.fillRect(x + ENEMY_W - 7, y + 9, 7, 7);
      context.fillStyle = '#ffe4ee';
      context.fillRect(x + 7, y + 6, 4, 4);
      context.fillRect(x + ENEMY_W - 11, y + 6, 4, 4);
      context.fillStyle = '#512858';
      context.fillRect(x + 10, y + 13, 6, 3);
    }
  }

  private drawPlayer(context: CanvasRenderingContext2D): void {
    const x = Math.round(this.playerX);
    const y = PLAYER_Y;
    context.fillStyle = '#64e7ff';
    context.fillRect(x + 11, y, 6, 4);
    context.fillRect(x + 7, y + 4, 14, 7);
    context.fillRect(x + 3, y + 11, 22, 6);
    context.fillRect(x, y + 17, 8, 5);
    context.fillRect(x + PLAYER_W - 8, y + 17, 8, 5);
    context.fillStyle = '#d9fbff';
    context.fillRect(x + 12, y + 5, 4, 7);
    context.fillStyle = '#ffda70';
    context.fillRect(x + 5, y + 20, 4, 4);
    context.fillRect(x + PLAYER_W - 9, y + 20, 4, 4);
  }

  private drawShots(context: CanvasRenderingContext2D): void {
    for (const shot of this.shots) {
      context.fillStyle = shot.friendly ? '#fff4a8' : '#ff7096';
      context.fillRect(Math.round(shot.x), Math.round(shot.y), 4, shot.friendly ? 10 : 12);
      context.fillStyle = shot.friendly ? '#ffffff' : '#ffc1d2';
      context.fillRect(Math.round(shot.x + 1), Math.round(shot.y), 2, 3);
    }
  }

  private overlaps(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.max(minimum, Math.min(maximum, value));
  }
}

export function createStarDefender(): Game {
  return new StarDefenderGame();
}
