import type { Game, GameContext, GameMeta } from '../types';

const WIDTH = 480;
const HEIGHT = 640;
const COLS = 12;
const ROWS = 14;
const CELL = 40;
const HUD_HEIGHT = 48;
const MAX_DT = 0.1;
const START_ROW = ROWS - 1;
const PLAYER_SIZE = 24;

interface Vehicle {
  x: number;
  row: number;
  width: number;
  speed: number;
  color: string;
  accent: string;
}

interface LanePattern {
  rows: number[];
  speeds: number[];
  density: number;
}

const PATTERNS: readonly LanePattern[] = [
  { rows: [2, 4, 6, 8, 10, 11], speeds: [42, -50, 58, -64, 48, -42], density: 0.72 },
  { rows: [1, 2, 4, 6, 7, 9, 10, 12], speeds: [-58, 70, -76, 86, -68, 92, -82, 72], density: 0.82 },
  { rows: [1, 2, 3, 5, 6, 7, 9, 10, 11, 12], speeds: [82, -94, 76, -108, 96, -84, 112, -102, 90, -118], density: 0.92 },
];

const VEHICLE_COLORS = [
  ['#f26b5e', '#ffd166'],
  ['#4ecdc4', '#d8fff7'],
  ['#8c7ae6', '#f4d6ff'],
  ['#f5a65b', '#fff0b3'],
];

export const meta: GameMeta = {
  id: 'road-hopper',
  title: 'Road Hopper',
  description: 'Cross moving traffic, reach the top edge, and master harder patterns.',
  controls: 'Arrows or WASD move one cell per press · Action starts or retries',
  accent: '#f6d365',
};

export class RoadHopperGame implements Game {
  readonly meta = meta;

  private ctx: CanvasRenderingContext2D | null = null;
  private gameContext: GameContext | null = null;
  private vehicles: Vehicle[] = [];
  private playerX = Math.floor(COLS / 2);
  private playerRow = START_ROW;
  private lives = 3;
  private stage = 0;
  private status: 'ready' | 'playing' | 'over' = 'ready';
  private paused = false;
  private destroyed = false;
  private hitCooldown = 0;

  init(canvas: HTMLCanvasElement, context: GameContext): void {
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    this.ctx = canvas.getContext('2d');
    this.gameContext = context;
    this.destroyed = false;
    this.paused = false;
    this.status = 'ready';
    this.lives = 3;
    this.stage = 0;
    context.score.reset();
    this.resetRound();
    context.setStatus('ready');
    this.render();
  }

  update(dt: number): void {
    if (this.destroyed || this.paused || !this.gameContext) return;
    const elapsed = Math.min(Math.max(dt, 0), MAX_DT);
    if (this.status !== 'playing') {
      if (this.gameContext.input.pressed('action')) this.startOrRetry();
      return;
    }

    this.hitCooldown = Math.max(0, this.hitCooldown - elapsed);
    for (const vehicle of this.vehicles) {
      vehicle.x += vehicle.speed * elapsed;
      const span = WIDTH + vehicle.width + CELL * 2;
      if (vehicle.speed > 0 && vehicle.x > WIDTH + CELL) vehicle.x -= span;
      if (vehicle.speed < 0 && vehicle.x + vehicle.width < -CELL) vehicle.x += span;
    }

    this.readMove();
    if (this.hitCooldown <= 0 && this.collidesWithVehicle()) this.hitPlayer();
    if (this.playerRow === 0) this.reachGoal();
  }

  render(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.fillStyle = '#08131d';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    this.drawHud(ctx);
    this.drawWorld(ctx);
    this.drawPlayer(ctx);
    if (this.status !== 'playing') this.drawOverlay(ctx);
  }

  pause(): void {
    if (!this.destroyed && this.status === 'playing') {
      this.paused = true;
      this.gameContext?.setStatus('paused');
    }
  }

  resume(): void {
    if (!this.destroyed && this.status === 'playing') {
      this.paused = false;
      this.gameContext?.setStatus('playing');
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.ctx = null;
    this.gameContext = null;
    this.vehicles = [];
  }

  private startOrRetry(): void {
    if (this.status === 'over') {
      this.lives = 3;
      this.stage = 0;
      this.gameContext?.score.reset();
      this.resetRound();
    }
    this.status = 'playing';
    this.gameContext?.setStatus('playing');
    this.gameContext?.audio.tone(440, 75, 'square', 0.06);
  }

  private resetRound(): void {
    this.playerX = Math.floor(COLS / 2);
    this.playerRow = START_ROW;
    this.hitCooldown = 0.7;
    this.vehicles = this.createVehicles(PATTERNS[Math.min(this.stage, PATTERNS.length - 1)] ?? PATTERNS[0]);
  }

  private readMove(): void {
    const gameContext = this.gameContext;
    if (!gameContext) return;
    const input = gameContext.input;
    let dx = 0;
    let dy = 0;
    if (input.pressed('left')) dx = -1;
    else if (input.pressed('right')) dx = 1;
    else if (input.pressed('up')) dy = -1;
    else if (input.pressed('down')) dy = 1;
    const nextX = Math.max(0, Math.min(COLS - 1, this.playerX + dx));
    const nextRow = Math.max(0, Math.min(START_ROW, this.playerRow + dy));
    if (nextX === this.playerX && nextRow === this.playerRow) return;
    this.playerX = nextX;
    this.playerRow = nextRow;
    gameContext.audio.tone(dy !== 0 ? 520 : 360, 28, 'square', 0.035);
  }

  private collidesWithVehicle(): boolean {
    const playerLeft = this.playerX * CELL + (CELL - PLAYER_SIZE) / 2;
    const playerTop = HUD_HEIGHT + this.playerRow * CELL + (CELL - PLAYER_SIZE) / 2;
    const playerRight = playerLeft + PLAYER_SIZE;
    const playerBottom = playerTop + PLAYER_SIZE;
    return this.vehicles.some((vehicle) => {
      if (vehicle.row !== this.playerRow) return false;
      const left = vehicle.x;
      const right = vehicle.x + vehicle.width;
      return playerLeft + 4 < right && playerRight - 4 > left && playerTop + 5 < HUD_HEIGHT + (vehicle.row + 1) * CELL && playerBottom - 5 > HUD_HEIGHT + vehicle.row * CELL;
    });
  }

  private hitPlayer(): void {
    this.lives -= 1;
    this.hitCooldown = 0.9;
    this.gameContext?.audio.tone(130, 180, 'sawtooth', 0.07);
    if (this.lives <= 0) {
      this.status = 'over';
      this.gameContext?.setStatus('over');
      return;
    }
    this.resetRound();
  }

  private reachGoal(): void {
    this.gameContext?.score.add(10);
    this.gameContext?.audio.tone(920, 130, 'triangle', 0.07);
    this.stage = Math.min(this.stage + 1, PATTERNS.length - 1);
    this.resetRound();
  }

  private createVehicles(pattern: LanePattern): Vehicle[] {
    const vehicles: Vehicle[] = [];
    pattern.rows.forEach((row, laneIndex) => {
      const speed = pattern.speeds[laneIndex] ?? 60;
      const count = Math.max(2, Math.round(2 + pattern.density));
      const gap = WIDTH / count;
      for (let index = 0; index < count; index += 1) {
        const width = 48 + ((laneIndex + index) % 3) * 12;
        const palette = VEHICLE_COLORS[(laneIndex + index + this.stage) % VEHICLE_COLORS.length] ?? VEHICLE_COLORS[0];
        vehicles.push({
          x: index * gap + (laneIndex % 2 === 0 ? -width : 0),
          row,
          width,
          speed,
          color: palette[0],
          accent: palette[1],
        });
      }
    });
    return vehicles;
  }

  private drawHud(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#102532';
    ctx.fillRect(0, 0, WIDTH, HUD_HEIGHT);
    ctx.font = '700 14px monospace';
    ctx.fillStyle = '#f6d365';
    ctx.fillText(`STAGE ${this.stage + 1}`, 16, 21);
    ctx.fillStyle = '#b8f3e6';
    ctx.fillText(`SCORE ${this.gameContext?.score.current() ?? 0}`, 165, 21);
    ctx.fillStyle = '#ff9b8e';
    ctx.fillText(`LIVES ${'●'.repeat(Math.max(0, this.lives))}`, 344, 21);
    ctx.fillStyle = '#8aa8b5';
    ctx.font = '11px monospace';
    ctx.fillText(`BEST ${this.gameContext?.score.best() ?? 0}`, 16, 39);
    ctx.fillText('REACH THE TOP', 344, 39);
  }

  private drawWorld(ctx: CanvasRenderingContext2D): void {
    for (let row = 0; row < ROWS; row += 1) {
      const y = HUD_HEIGHT + row * CELL;
      if (row === 0) {
        ctx.fillStyle = '#173c43';
        ctx.fillRect(0, y, WIDTH, CELL);
        ctx.fillStyle = '#9ce6bd';
        ctx.font = '700 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SAFE SHORE', WIDTH / 2, y + 25);
        ctx.textAlign = 'left';
      } else if (this.isTrafficRow(row)) {
        ctx.fillStyle = '#1d2830';
        ctx.fillRect(0, y, WIDTH, CELL);
        ctx.fillStyle = '#34434a';
        for (let x = 0; x < WIDTH; x += 48) ctx.fillRect(x + 10, y + 19, 22, 2);
      } else {
        ctx.fillStyle = row === START_ROW ? '#173c43' : '#214b45';
        ctx.fillRect(0, y, WIDTH, CELL);
        ctx.fillStyle = '#3d7662';
        for (let x = 8; x < WIDTH; x += 32) ctx.fillRect(x + (row % 2) * 7, y + 11 + (x % 3) * 5, 3, 7);
      }
    }
    for (const vehicle of this.vehicles) this.drawVehicle(ctx, vehicle);
  }

  private drawVehicle(ctx: CanvasRenderingContext2D, vehicle: Vehicle): void {
    const y = HUD_HEIGHT + vehicle.row * CELL + 7;
    ctx.fillStyle = '#0d151b';
    ctx.fillRect(vehicle.x - 2, y + 4, vehicle.width + 4, 22);
    ctx.fillStyle = vehicle.color;
    ctx.fillRect(vehicle.x, y + 2, vehicle.width, 18);
    ctx.fillStyle = vehicle.accent;
    ctx.fillRect(vehicle.x + 8, y + 5, Math.max(10, vehicle.width - 28), 7);
    ctx.fillStyle = '#101a22';
    ctx.fillRect(vehicle.x + 8, y + 19, 9, 5);
    ctx.fillRect(vehicle.x + vehicle.width - 17, y + 19, 9, 5);
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    if (this.hitCooldown > 0 && Math.floor(this.hitCooldown * 14) % 2 === 0) return;
    const x = this.playerX * CELL + CELL / 2;
    const y = HUD_HEIGHT + this.playerRow * CELL + CELL / 2;
    ctx.fillStyle = '#f6d365';
    ctx.fillRect(x - 10, y - 12, 20, 22);
    ctx.fillStyle = '#fff4bd';
    ctx.fillRect(x - 6, y - 8, 12, 7);
    ctx.fillStyle = '#25434b';
    ctx.fillRect(x - 7, y + 7, 5, 5);
    ctx.fillRect(x + 2, y + 7, 5, 5);
  }

  private drawOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(5, 14, 20, 0.84)';
    ctx.fillRect(38, 254, WIDTH - 76, 128);
    ctx.strokeStyle = '#f6d365';
    ctx.strokeRect(38, 254, WIDTH - 76, 128);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff4bd';
    ctx.font = '700 25px monospace';
    ctx.fillText(this.status === 'ready' ? 'ROAD HOPPER' : 'RUN ENDED', WIDTH / 2, 302);
    ctx.fillStyle = '#b8f3e6';
    ctx.font = '13px monospace';
    ctx.fillText(this.status === 'ready' ? 'PRESS ACTION TO START' : 'PRESS ACTION TO TRY AGAIN', WIDTH / 2, 337);
    ctx.textAlign = 'left';
  }

  private isTrafficRow(row: number): boolean {
    const pattern = PATTERNS[Math.min(this.stage, PATTERNS.length - 1)] ?? PATTERNS[0];
    return pattern.rows.includes(row);
  }
}

export function createRoadHopper(): Game {
  return new RoadHopperGame();
}
