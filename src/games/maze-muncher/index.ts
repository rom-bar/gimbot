import type { Game, GameContext, GameMeta } from '../types';

type Direction = 'up' | 'down' | 'left' | 'right';
type Cell = { x: number; y: number };
type Chaser = Cell & { hue: string };

const WIDTH = 480;
const HEIGHT = 640;
const TILE = 30;
const GRID_X = 15;
const GRID_Y = 18;
const MAZE_X = (WIDTH - GRID_X * TILE) / 2;
const MAZE_Y = 72;
const STEP_TIME = 0.22;
const CHASER_STEP_TIME = 0.62;
const POWER_TIME = 4;
const MAX_WAVES = 2;

const MAZE = [
  '###############',
  '#o....#.......#',
  '#.###.#.#####.#',
  '#.....#.....#.#',
  '#####.#####.#.#',
  '#.....#...#...#',
  '#.###.#.#.###.#',
  '#.#...#.#.....#',
  '#.#.###.#####.#',
  '#...#.........#',
  '###.#.#########',
  '#...#.........#',
  '#.###.#####.#.#',
  '#.....#...#...#',
  '#.#####.#.###.#',
  '#.......#.....#',
  '#.#####.#####.#',
  '###############',
] as const;

const DIRECTIONS: Record<Direction, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const DIRECTION_ORDER: Direction[] = ['up', 'left', 'down', 'right'];

export const meta: GameMeta = {
  id: 'maze-muncher',
  title: 'Maze Muncher',
  description: 'Clear a glowing maze, gather dots, and outsmart two slow sentries.',
  controls: 'Arrows / WASD move one tile · Space / A starts or restarts',
  accent: '#67f5c5',
  touchControls: { dpad: ['up', 'down', 'left', 'right'], buttons: ['action'], labels: {action: 'Start'}, gestures: false },
};

export class MazeMuncherGame implements Game {
  readonly meta = meta;

  private ctx: CanvasRenderingContext2D | null = null;
  private gameContext: GameContext | null = null;
  private dots = new Set<string>();
  private powerDots = new Set<string>();
  private player: Cell = { x: 1, y: 1 };
  private chasers: Chaser[] = [];
  private lives = 3;
  private wave = 1;
  private powerRemaining = 0;
  private playerTimer = 0;
  private chaserTimer = 0;
  private status: 'ready' | 'playing' | 'over' = 'ready';
  private paused = false;
  private destroyed = false;

  init(canvas: HTMLCanvasElement, context: GameContext): void {
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    this.ctx = canvas.getContext('2d');
    this.gameContext = context;
    this.destroyed = false;
    this.paused = false;
    this.status = 'ready';
    this.resetRound(false);
    context.setStatus('ready');
    this.render();
  }

  update(dt: number): void {
    if (this.destroyed || this.paused || !this.gameContext) return;
    const safeDt = Math.min(Math.max(dt, 0), 0.25);
    if (this.status !== 'playing') {
      if (this.gameContext.input.pressed('action')) this.start();
      return;
    }

    this.powerRemaining = Math.max(0, this.powerRemaining - safeDt);
    this.playerTimer += safeDt;
    this.chaserTimer += safeDt;

    if (this.playerTimer >= STEP_TIME) {
      this.playerTimer = 0;
      this.readPlayerMove();
    }
    if (this.status !== 'playing') return;

    if (this.chaserTimer >= CHASER_STEP_TIME) {
      this.chaserTimer = 0;
      if (this.powerRemaining <= 0) this.moveChasers();
    }
    this.checkCollisions();
    if (this.dots.size === 0) this.finishWave();
  }

  render(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#07151d';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    this.drawHeader(ctx);
    this.drawMaze(ctx);
    this.drawPlayer(ctx);
    this.drawChasers(ctx);
    if (this.status !== 'playing') this.drawOverlay(ctx);
  }

  pause(): void {
    if (!this.destroyed) this.paused = true;
  }

  resume(): void {
    if (!this.destroyed) this.paused = false;
  }

  destroy(): void {
    this.destroyed = true;
    this.ctx = null;
    this.gameContext = null;
    this.dots.clear();
    this.powerDots.clear();
    this.chasers = [];
  }

  private start(): void {
    this.gameContext?.score.reset();
    this.lives = 3;
    this.wave = 1;
    this.resetRound(true);
    this.status = 'playing';
    this.gameContext?.setStatus('playing');
    this.gameContext?.audio.tone(440, 90, 'square', 0.06);
    this.render();
  }

  private resetRound(resetDots: boolean): void {
    if (resetDots) {
      this.dots.clear();
      this.powerDots.clear();
    }
    if (this.dots.size === 0) {
      for (let y = 0; y < GRID_Y; y += 1) {
        for (let x = 0; x < GRID_X; x += 1) {
          const cell = this.cellKey({ x, y });
          const tile = MAZE[y][x];
          if (tile !== '#') this.dots.add(cell);
          if (tile === 'o') this.powerDots.add(cell);
        }
      }
    }
    this.player = { x: 1, y: 1 };
    this.dots.delete(this.cellKey(this.player));
    this.powerDots.delete(this.cellKey(this.player));
    this.chasers = [
      { x: 13, y: 1, hue: '#ff719e' },
      { x: 13, y: 15, hue: '#b992ff' },
    ];
    for (const chaser of this.chasers) {
      this.dots.delete(this.cellKey(chaser));
      this.powerDots.delete(this.cellKey(chaser));
    }
    this.playerTimer = 0;
    this.chaserTimer = 0;
    this.powerRemaining = 0;
  }

  private readPlayerMove(): void {
    if (!this.gameContext) return;
    const controls: Array<[Direction, 'up' | 'down' | 'left' | 'right']> = [
      ['up', 'up'],
      ['down', 'down'],
      ['left', 'left'],
      ['right', 'right'],
    ];
    for (const [direction, control] of controls) {
      if (!this.gameContext.input.pressed(control)) continue;
      const vector = DIRECTIONS[direction];
      const next = { x: this.player.x + vector.x, y: this.player.y + vector.y };
      if (!this.isOpen(next)) return;
      this.player = next;
      const key = this.cellKey(next);
      if (this.powerDots.delete(key)) {
        this.powerRemaining = POWER_TIME;
        this.gameContext.audio.tone(820, 110, 'triangle', 0.08);
      } else if (this.dots.delete(key)) {
        this.gameContext.audio.tone(620, 45, 'square', 0.05);
      }
      this.gameContext.score.add(10);
      return;
    }
  }

  private moveChasers(): void {
    for (const chaser of this.chasers) {
      const options = DIRECTION_ORDER
        .map((direction) => {
          const vector = DIRECTIONS[direction];
          return { x: chaser.x + vector.x, y: chaser.y + vector.y };
        })
        .filter((candidate) => this.isOpen(candidate));
      options.sort((a, b) => this.distance(a, this.player) - this.distance(b, this.player));
      const next = options[0];
      if (next) {
        chaser.x = next.x;
        chaser.y = next.y;
      }
    }
  }

  private checkCollisions(): void {
    const hit = this.chasers.some((chaser) => chaser.x === this.player.x && chaser.y === this.player.y);
    if (!hit) return;
    if (this.powerRemaining > 0) {
      for (const chaser of this.chasers) {
        chaser.x = chaser.x === this.player.x ? 13 : chaser.x;
        chaser.y = chaser.y === this.player.y ? 15 : chaser.y;
      }
      this.gameContext?.score.add(30);
      this.gameContext?.audio.tone(260, 130, 'sawtooth', 0.06);
      return;
    }
    this.lives -= 1;
    this.gameContext?.audio.tone(140, 180, 'sawtooth', 0.08);
    if (this.lives <= 0) {
      this.status = 'over';
      this.gameContext?.setStatus('over');
      return;
    }
    this.resetRound(false);
  }

  private finishWave(): void {
    if (this.wave >= MAX_WAVES) {
      this.status = 'over';
      this.gameContext?.setStatus('over');
      this.gameContext?.audio.tone(980, 180, 'triangle', 0.08);
      return;
    }
    this.wave += 1;
    this.resetRound(true);
    this.gameContext?.audio.tone(760, 140, 'triangle', 0.08);
  }

  private isOpen(cell: Cell): boolean {
    return cell.x >= 0 && cell.x < GRID_X && cell.y >= 0 && cell.y < GRID_Y && MAZE[cell.y][cell.x] !== '#';
  }

  private cellKey(cell: Cell): string {
    return `${cell.x},${cell.y}`;
  }

  private distance(a: Cell, b: Cell): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  private drawHeader(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#0d2730';
    ctx.fillRect(0, 0, WIDTH, 56);
    ctx.fillStyle = '#67f5c5';
    ctx.font = '700 15px monospace';
    ctx.fillText(`WAVE ${this.wave}/${MAX_WAVES}`, 18, 23);
    ctx.fillStyle = '#f6d77a';
    ctx.fillText(`SCORE ${this.gameContext?.score.current() ?? 0}`, 178, 23);
    ctx.fillStyle = '#ff9bc0';
    ctx.fillText(`LIVES ${'●'.repeat(this.lives)}`, 344, 23);
    ctx.fillStyle = '#8bb7bd';
    ctx.font = '12px monospace';
    ctx.fillText(`DOTS ${this.dots.size}`, 18, 43);
    if (this.powerRemaining > 0) {
      ctx.fillStyle = '#f4a9ff';
      ctx.fillText('SENTRIES STUNNED', 344, 43);
    }
  }

  private drawMaze(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#0b2532';
    ctx.fillRect(MAZE_X - 8, MAZE_Y - 8, GRID_X * TILE + 16, GRID_Y * TILE + 16);
    for (let y = 0; y < GRID_Y; y += 1) {
      for (let x = 0; x < GRID_X; x += 1) {
        const px = MAZE_X + x * TILE;
        const py = MAZE_Y + y * TILE;
        if (MAZE[y][x] === '#') {
          ctx.fillStyle = '#164a58';
          ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
          ctx.strokeStyle = '#257b83';
          ctx.strokeRect(px + 4, py + 4, TILE - 8, TILE - 8);
          continue;
        }
        ctx.fillStyle = '#09202a';
        ctx.fillRect(px, py, TILE, TILE);
        const key = `${x},${y}`;
        if (this.dots.has(key)) {
          ctx.fillStyle = '#b7f7d8';
          ctx.beginPath();
          ctx.arc(px + TILE / 2, py + TILE / 2, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        if (this.powerDots.has(key)) {
          ctx.fillStyle = '#f4a9ff';
          ctx.beginPath();
          ctx.arc(px + TILE / 2, py + TILE / 2, 8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const center = this.center(this.player);
    ctx.save();
    ctx.shadowBlur = 16;
    ctx.shadowColor = '#f6d77a';
    ctx.fillStyle = '#f6d77a';
    ctx.beginPath();
    ctx.arc(center.x, center.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#493a29';
    ctx.fillRect(center.x + 3, center.y - 4, 2, 2);
    ctx.restore();
  }

  private drawChasers(ctx: CanvasRenderingContext2D): void {
    for (const chaser of this.chasers) {
      const center = this.center(chaser);
      ctx.save();
      ctx.shadowBlur = 12;
      ctx.shadowColor = this.powerRemaining > 0 ? '#a7d7ff' : chaser.hue;
      ctx.fillStyle = this.powerRemaining > 0 ? '#80b9e8' : chaser.hue;
      ctx.beginPath();
      ctx.arc(center.x, center.y - 2, 10, Math.PI, 0);
      ctx.lineTo(center.x + 10, center.y + 9);
      ctx.lineTo(center.x + 4, center.y + 5);
      ctx.lineTo(center.x, center.y + 9);
      ctx.lineTo(center.x - 4, center.y + 5);
      ctx.lineTo(center.x - 10, center.y + 9);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f4ffff';
      ctx.fillRect(center.x - 6, center.y - 5, 4, 5);
      ctx.fillRect(center.x + 2, center.y - 5, 4, 5);
      ctx.fillStyle = '#12313a';
      ctx.fillRect(center.x - 5, center.y - 4, 2, 3);
      ctx.fillRect(center.x + 3, center.y - 4, 2, 3);
      ctx.restore();
    }
  }

  private drawOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(4, 13, 18, 0.82)';
    ctx.fillRect(35, 250, WIDTH - 70, 130);
    ctx.strokeStyle = '#67f5c5';
    ctx.strokeRect(35, 250, WIDTH - 70, 130);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f4ffff';
    ctx.font = '700 28px monospace';
    ctx.fillText(this.status === 'ready' ? 'MAZE MUNCHER' : 'ROUND COMPLETE', WIDTH / 2, 300);
    ctx.fillStyle = '#a7d7d1';
    ctx.font = '14px monospace';
    ctx.fillText(this.status === 'ready' ? 'PRESS A / SPACE TO START' : 'PRESS A / SPACE TO PLAY AGAIN', WIDTH / 2, 335);
    ctx.textAlign = 'left';
  }

  private center(cell: Cell): Cell {
    return { x: MAZE_X + cell.x * TILE + TILE / 2, y: MAZE_Y + cell.y * TILE + TILE / 2 };
  }
}

export function createMazeMuncher(): Game {
  return new MazeMuncherGame();
}
