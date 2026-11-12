import type { Game, GameContext, GameMeta } from '../types';

const WIDTH = 480;
const HEIGHT = 640;
const COLS = 20;
const ROWS = 24;
const TILE = 24;
const MAP_Y = 48;
const MOVE_DELAY = 0.12;
const HOLE_DURATION = 4.2;
const LEVELS: readonly string[][] = [
  [
    '####################',
    '#        H         #',
    '#   $    H    $    #',
    '#  ====  H  ====   #',
    '#      # H #      #',
    '#  $   # H #  $   X#',
    '#  ====# H #====   #',
    '#      # H #      #',
    '#  $   # H #  E   #',
    '#  ====  H  ====   #',
    '#                  #',
    '#   P              #',
    '#  ====      ====  #',
    '#                  #',
    '#    $        $    #',
    '#  ====  H  ====   #',
    '#        H         #',
    '#  $     H     $   #',
    '#  ====  H  ====   #',
    '#                  #',
    '#                  #',
    '#                  #',
    '#                  #',
    '####################',
  ],
  [
    '####################',
    '# P      H        X#',
    '# ====   H   ====  #',
    '#      $ H $      #',
    '#   #### H ####   #',
    '#       E         #',
    '# ====   H   ====  #',
    '#   $    H    $    #',
    '#      ##H##      #',
    '#                  #',
    '# ====  H  ====    #',
    '#   $   H      E  #',
    '#      H          #',
    '#  ====H====       #',
    '#      H   $       #',
    '#  $   H  ====     #',
    '#      H           #',
    '# ==== H ====      #',
    '#                  #',
    '#      $           #',
    '#  ==========      #',
    '#                  #',
    '#                  #',
    '####################',
  ],
  [
    '####################',
    '#P      H         X#',
    '# ====  H  ====    #',
    '#   $   H    $     #',
    '#      ##          #',
    '#  E       H       #',
    '# ====  H  ====    #',
    '#       H    $     #',
    '#   ####H####      #',
    '#       H          #',
    '#  $    H      E   #',
    '# ====  H  ====    #',
    '#       H          #',
    '#   $   H    $     #',
    '#      ##          #',
    '#  ==== H ====     #',
    '#       H          #',
    '#   E   H          #',
    '# ====  H  ====    #',
    '#       H          #',
    '#       H          #',
    '#  $           $   #',
    '#  ============    #',
    '####################',
  ],
  [
    '####################',
    '#P     H          X#',
    '# ===  H  ===      #',
    '#  $   H      $    #',
    '#  ####H####       #',
    '#      H     E     #',
    '#  === H ===       #',
    '#      H      $    #',
    '# $    H          #',
    '# ==== H ====      #',
    '#      H          #',
    '#   E  H     $    #',
    '#      H          #',
    '# ===  H  ===     #',
    '#  $   H          #',
    '#      H   E      #',
    '# ==== H ====     #',
    '#      H          #',
    '#   $  H     $    #',
    '#      H          #',
    '#  ============   #',
    '#                  #',
    '#                  #',
    '####################',
  ],
  [
    '####################',
    '#P       H        X#',
    '# ====   H  ====   #',
    '#   $    H    $    #',
    '#      ###         #',
    '#  E       H   E   #',
    '# ====    H ====   #',
    '#    $    H        #',
    '#       ###        #',
    '#  ====   H  ====  #',
    '#     $   H        #',
    '#   E     H     $  #',
    '#       ###        #',
    '# ====   H  ====   #',
    '#   $    H         #',
    '#  E     H     E   #',
    '#      ###         #',
    '# ====   H  ====   #',
    '#       $H        #',
    '#        H         #',
    '#  ============    #',
    '#                  #',
    '#                  #',
    '####################',
  ],
];

export const meta: GameMeta = {
  id: 'brick-runner',
  title: 'Brick Runner',
  description: 'Climb, dig, and gather every signal crystal across five compact ruins.',
  controls: 'Arrows or WASD move. X or B digs beside you. Reach the exit after collecting all crystals.',
  accent: '#ffbd59',
  touchControls: { dpad: ['up', 'down', 'left', 'right'], buttons: ['action', 'secondary'], labels: {action: 'Start', secondary: 'Dig'}, gestures: false },
};

type Enemy = { x: number; y: number; direction: number; timer: number };
type Hole = { x: number; y: number; timer: number };

export class BrickRunnerGame implements Game {
  readonly meta = meta;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private context: GameContext | null = null;
  private map: string[][] = [];
  private enemies: Enemy[] = [];
  private holes: Hole[] = [];
  private playerX = 1;
  private playerY = 1;
  private facing = 1;
  private level = 0;
  private lives = 3;
  private crystals = 0;
  private moveTimer = 0;
  private started = false;
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
    this.started = false;
    this.level = 0;
    this.lives = 3;
    context.score.reset();
    this.loadLevel();
    context.setStatus('ready');
    this.render();
  }

  update(dt: number): void {
    if (this.destroyed || this.paused || !this.context || !this.started) {
      if (!this.started && this.context?.input.pressed('action')) this.start();
      return;
    }
    this.moveTimer -= dt;
    for (const hole of this.holes) hole.timer -= dt;
    this.holes = this.holes.filter((hole) => hole.timer > 0);
    if (this.context.input.pressed('secondary')) this.dig();
    if (this.moveTimer <= 0) {
      this.moveTimer = MOVE_DELAY;
      this.movePlayer();
    }
    this.updateEnemies(dt);
    this.applyFall();
    this.collectCrystal();
    this.checkEnemyCollision();
    if (this.crystals === 0 && this.tile(this.playerX, this.playerY) === 'X') this.advanceLevel();
  }

  render(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.fillStyle = '#090b19';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#111832';
    ctx.fillRect(0, 0, WIDTH, 40);
    ctx.fillStyle = '#f7c86b';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`LEVEL ${this.level + 1}/${LEVELS.length}`, 14, 25);
    ctx.fillStyle = '#7ee7d4';
    ctx.fillText(`CRYSTALS ${this.crystals}`, 175, 25);
    ctx.fillStyle = '#ff8d9d';
    ctx.fillText(`LIVES ${this.lives}`, 370, 25);

    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) this.drawTile(ctx, x, y, this.tile(x, y));
    }
    for (const hole of this.holes) this.drawHole(ctx, hole.x, hole.y);
    for (const enemy of this.enemies) this.drawEnemy(ctx, enemy);
    this.drawPlayer(ctx);
  }

  pause(): void { this.paused = true; }
  resume(): void { this.paused = false; }

  destroy(): void {
    this.destroyed = true;
    this.canvas = null;
    this.ctx = null;
    this.context = null;
    this.map = [];
    this.enemies = [];
    this.holes = [];
  }

  private start(): void {
    this.started = true;
    this.context?.setStatus('playing');
    this.context?.audio.tone(440, 70, 'square', 0.05);
  }

  private loadLevel(): void {
    const source = LEVELS[this.level] ?? LEVELS[0];
    this.map = Array.from({ length: ROWS }, (_, y) => {
      const row = source[y] ?? '';
      return Array.from({ length: COLS }, (_, x) => row[x] ?? '#');
    });
    this.enemies = [];
    this.holes = [];
    this.crystals = 0;
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const value = this.map[y][x];
        if (value === 'P') { this.playerX = x; this.playerY = y; this.map[y][x] = ' '; }
        if (value === '$') this.crystals += 1;
        if (value === 'E') { this.enemies.push({ x, y, direction: x % 2 === 0 ? 1 : -1, timer: 0 }); this.map[y][x] = ' '; }
      }
    }
    this.moveTimer = 0;
  }

  private movePlayer(): void {
    const input = this.context?.input;
    if (!input) return;
    let dx = (input.down('right') ? 1 : 0) - (input.down('left') ? 1 : 0);
    let dy = (input.down('down') ? 1 : 0) - (input.down('up') ? 1 : 0);
    if (dx !== 0) { this.facing = dx; dy = 0; }
    if (dx === 0 && dy === 0) return;
    const current = this.tile(this.playerX, this.playerY);
    if (dy !== 0 && current !== 'H' && this.tile(this.playerX, this.playerY + 1) !== 'H' && this.tile(this.playerX, this.playerY - 1) !== 'H') return;
    const nx = this.playerX + dx;
    const ny = this.playerY + dy;
    if (this.canEnter(nx, ny)) {
      this.playerX = nx;
      this.playerY = ny;
      this.context?.audio.tone(280 + (dy !== 0 ? 80 : 0), 24, 'square', 0.025);
    }
  }

  private canEnter(x: number, y: number): boolean {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
    const value = this.tile(x, y);
    return value !== '#' && value !== '=' && !this.holes.some((hole) => hole.x === x && hole.y === y);
  }

  private applyFall(): void {
    if (this.tile(this.playerX, this.playerY) === 'H') return;
    const below = this.tile(this.playerX, this.playerY + 1);
    if (below !== '#' && below !== '=' && below !== 'H' && this.canEnter(this.playerX, this.playerY + 1)) this.playerY += 1;
  }

  private dig(): void {
    const x = this.playerX + this.facing;
    const y = this.playerY + 1;
    if (this.tile(x, y) !== '=') return;
    if (this.holes.some((hole) => hole.x === x && hole.y === y)) return;
    this.holes.push({ x, y, timer: HOLE_DURATION });
    this.context?.audio.tone(180, 90, 'square', 0.05);
  }

  private updateEnemies(dt: number): void {
    for (const enemy of this.enemies) {
      enemy.timer -= dt;
      if (enemy.timer > 0) continue;
      enemy.timer = 0.28;
      const nextX = enemy.x + enemy.direction;
      if (this.tile(nextX, enemy.y) === ' ' && this.tile(nextX, enemy.y + 1) !== ' ' && this.tile(nextX, enemy.y + 1) !== 'H') enemy.x = nextX;
      else enemy.direction *= -1;
    }
  }

  private collectCrystal(): void {
    if (this.tile(this.playerX, this.playerY) !== '$') return;
    this.map[this.playerY][this.playerX] = ' ';
    this.crystals -= 1;
    this.context?.score.add(10);
    this.context?.audio.tone(760, 75, 'triangle', 0.06);
  }

  private checkEnemyCollision(): void {
    if (!this.enemies.some((enemy) => enemy.x === this.playerX && enemy.y === this.playerY)) return;
    this.lives -= 1;
    this.context?.audio.tone(120, 180, 'sawtooth', 0.07);
    if (this.lives <= 0) { this.context?.setStatus('over'); this.started = false; return; }
    this.loadLevel();
  }

  private advanceLevel(): void {
    this.context?.audio.tone(980, 140, 'triangle', 0.08);
    if (this.level >= LEVELS.length - 1) { this.context?.setStatus('over'); this.started = false; return; }
    this.level += 1;
    this.loadLevel();
  }

  private tile(x: number, y: number): string {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return '#';
    return this.map[y]?.[x] ?? '#';
  }

  private drawTile(ctx: CanvasRenderingContext2D, x: number, y: number, value: string): void {
    const px = x * TILE;
    const py = MAP_Y + y * TILE;
    if (value === '#' || value === '=') {
      ctx.fillStyle = value === '#' ? '#26345a' : '#a0524b';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = value === '#' ? '#3e527e' : '#d87854';
      ctx.fillRect(px + 2, py + 2, TILE - 4, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(px + 3, py + TILE - 5, TILE - 6, 3);
    } else if (value === 'H') {
      ctx.strokeStyle = '#69c5bb';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px + 7, py); ctx.lineTo(px + 7, py + TILE);
      ctx.moveTo(px + 17, py); ctx.lineTo(px + 17, py + TILE);
      ctx.stroke();
      ctx.lineWidth = 2;
      for (let rung = 5; rung < TILE; rung += 7) { ctx.beginPath(); ctx.moveTo(px + 6, py + rung); ctx.lineTo(px + 18, py + rung); ctx.stroke(); }
    } else if (value === '$') {
      ctx.fillStyle = '#ffe27b';
      ctx.fillRect(px + 8, py + 5, 8, 14);
      ctx.fillStyle = '#fff5ba';
      ctx.fillRect(px + 10, py + 7, 3, 10);
    } else if (value === 'X') {
      ctx.fillStyle = '#8c6cff';
      ctx.fillRect(px + 5, py + 4, 14, 16);
      ctx.fillStyle = '#e2d9ff';
      ctx.fillRect(px + 8, py + 7, 8, 3);
    }
  }

  private drawHole(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillStyle = '#090b19';
    ctx.fillRect(x * TILE, MAP_Y + y * TILE, TILE, TILE);
    ctx.strokeStyle = '#d87854';
    ctx.strokeRect(x * TILE + 2, MAP_Y + y * TILE + 2, TILE - 4, TILE - 4);
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const px = this.playerX * TILE;
    const py = MAP_Y + this.playerY * TILE;
    ctx.fillStyle = '#6be7d1';
    ctx.fillRect(px + 5, py + 5, 14, 15);
    ctx.fillStyle = '#d8fff4';
    ctx.fillRect(px + (this.facing > 0 ? 14 : 6), py + 8, 4, 4);
    ctx.fillStyle = '#1e4560';
    ctx.fillRect(px + 7, py + 18, 4, 4);
    ctx.fillRect(px + 14, py + 18, 4, 4);
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy): void {
    const px = enemy.x * TILE;
    const py = MAP_Y + enemy.y * TILE;
    ctx.fillStyle = '#ff7184';
    ctx.fillRect(px + 4, py + 7, 16, 13);
    ctx.fillStyle = '#3e1e4c';
    ctx.fillRect(px + 7, py + 10, 3, 3);
    ctx.fillRect(px + 14, py + 10, 3, 3);
  }
}

export function createBrickRunner(): Game {
  return new BrickRunnerGame();
}
