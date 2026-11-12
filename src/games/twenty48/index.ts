import type { Game, GameContext, GameMeta } from '../types';
import { moveBoard, type Direction } from './logic';

export const meta: GameMeta = {
  id: 'twenty48',
  title: 'Twenty48',
  description: 'Slide matching tiles, build momentum, and reach the summit.',
  controls: 'Use the arrows or WASD to slide tiles. Matching values merge.',
  accent: '#e8a95b',
};

const SIZE = 4;
const CELL_GAP = 12;
const COLORS: Record<number, string> = {
  0: '#d9c8ad',
  2: '#f4eadb',
  4: '#f1dfbd',
  8: '#f0b36a',
  16: '#ee9160',
  32: '#e8795f',
  64: '#d95555',
  128: '#d9b958',
  256: '#c9aa42',
  512: '#b99435',
  1024: '#8b6bcb',
  2048: '#5c43a6',
};

function emptyBoard(): number[][] {
  return Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(0));
}

export class Twenty48Game implements Game {
  readonly meta = meta;
  private canvas: HTMLCanvasElement | null = null;
  private context: GameContext | null = null;
  private board = emptyBoard();
  private status: 'ready' | 'playing' | 'over' = 'ready';
  private won = false;
  private paused = false;
  private touchStart: { x: number; y: number } | null = null;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const direction = this.directionFromKey(event.key);
    if (!direction) return;
    event.preventDefault();
    this.tryMove(direction);
  };

  private readonly onTouchStart = (event: TouchEvent): void => {
    const touch = event.changedTouches[0];
    if (touch) this.touchStart = { x: touch.clientX, y: touch.clientY };
  };

  private readonly onTouchEnd = (event: TouchEvent): void => {
    if (!this.touchStart) return;
    const start = this.touchStart;
    const touch = event.changedTouches[0];
    this.touchStart = null;
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    this.tryMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
  };

  init(canvas: HTMLCanvasElement, context: GameContext): void {
    this.canvas = canvas;
    this.context = context;
    canvas.addEventListener('keydown', this.onKeyDown);
    canvas.addEventListener('touchstart', this.onTouchStart, { passive: true });
    canvas.addEventListener('touchend', this.onTouchEnd, { passive: true });
    this.render();
  }

  update(_dt: number): void {
    if (!this.context || this.paused) return;
    if (this.status === 'ready' && this.context.input.pressed('action')) this.start();
    if (this.status !== 'playing') return;
    for (const direction of ['left', 'right', 'up', 'down'] as const) {
      if (this.context.input.pressed(direction)) {
        this.tryMove(direction);
        break;
      }
    }
  }

  render(): void {
    const canvas = this.canvas;
    if (!canvas) return;
    const drawing = canvas.getContext('2d');
    if (!drawing) return;
    const width = canvas.width;
    const height = canvas.height;
    drawing.clearRect(0, 0, width, height);
    drawing.fillStyle = '#171420';
    drawing.fillRect(0, 0, width, height);

    const boardSize = Math.min(width, height) * 0.82;
    const originX = (width - boardSize) / 2;
    const originY = (height - boardSize) / 2;
    const cellSize = (boardSize - CELL_GAP * (SIZE + 1)) / SIZE;
    drawing.fillStyle = '#6b594b';
    drawing.beginPath();
    drawing.roundRect(originX, originY, boardSize, boardSize, 18);
    drawing.fill();

    for (let row = 0; row < SIZE; row += 1) {
      for (let column = 0; column < SIZE; column += 1) {
        const value = this.board[row][column];
        const x = originX + CELL_GAP + column * (cellSize + CELL_GAP);
        const y = originY + CELL_GAP + row * (cellSize + CELL_GAP);
        drawing.fillStyle = COLORS[value] ?? '#714cc2';
        drawing.beginPath();
        drawing.roundRect(x, y, cellSize, cellSize, 10);
        drawing.fill();
        if (value === 0) continue;
        drawing.fillStyle = value <= 4 ? '#514338' : '#fff8ec';
        drawing.font = `700 ${Math.max(18, cellSize * (value >= 1000 ? 0.25 : value >= 100 ? 0.32 : 0.4))}px system-ui, sans-serif`;
        drawing.textAlign = 'center';
        drawing.textBaseline = 'middle';
        drawing.fillText(String(value), x + cellSize / 2, y + cellSize / 2 + 1);
      }
    }

    if (this.won) {
      drawing.fillStyle = 'rgba(20, 13, 35, 0.68)';
      drawing.fillRect(originX, originY, boardSize, boardSize);
      drawing.fillStyle = '#fff8ec';
      drawing.font = '700 28px system-ui, sans-serif';
      drawing.textAlign = 'center';
      drawing.fillText('Summit reached', width / 2, height / 2);
    }
  }

  destroy(): void {
    this.canvas?.removeEventListener('keydown', this.onKeyDown);
    this.canvas?.removeEventListener('touchstart', this.onTouchStart);
    this.canvas?.removeEventListener('touchend', this.onTouchEnd);
    this.canvas = null;
    this.context = null;
  }

  pause(): void { this.paused = true; }
  resume(): void { this.paused = false; }

  private start(): void {
    this.board = emptyBoard();
    this.won = false;
    this.status = 'playing';
    this.context?.score.reset();
    this.spawn();
    this.spawn();
    this.context?.setStatus('playing');
    this.context?.audio.tone(440, 80, 'triangle', 0.06);
    this.render();
  }

  private tryMove(direction: Direction): void {
    if (this.status !== 'playing' || this.paused) return;
    const moved = moveBoard(this.board, direction);
    if (!moved.changed) {
      if (!this.canMove()) this.finish();
      return;
    }
    this.board = moved.board;
    if (moved.score > 0) {
      this.context?.score.add(moved.score);
      this.context?.audio.tone(520 + Math.min(moved.score, 1024) / 4, 70, 'sine', 0.07);
    }
    this.spawn();
    if (this.board.some((row) => row.some((value) => value >= 2048))) {
      this.won = true;
      this.finish();
    } else if (!this.canMove()) {
      this.finish();
    }
    this.render();
  }

  private finish(): void {
    this.status = 'over';
    this.context?.setStatus('over');
    this.context?.audio.tone(this.won ? 880 : 180, 160, 'triangle', 0.08);
    this.render();
  }

  private canMove(): boolean {
    return (['left', 'right', 'up', 'down'] as const).some((direction) => moveBoard(this.board, direction).changed);
  }

  private spawn(): void {
    const open: Array<[number, number]> = [];
    for (let row = 0; row < SIZE; row += 1) for (let column = 0; column < SIZE; column += 1) if (this.board[row][column] === 0) open.push([row, column]);
    if (open.length === 0) return;
    const [row, column] = open[Math.floor(Math.random() * open.length)];
    this.board[row][column] = Math.random() < 0.9 ? 2 : 4;
  }

  private directionFromKey(key: string): Direction | null {
    switch (key.toLowerCase()) {
      case 'arrowleft': case 'a': return 'left';
      case 'arrowright': case 'd': return 'right';
      case 'arrowup': case 'w': return 'up';
      case 'arrowdown': case 's': return 'down';
      default: return null;
    }
  }
}

export function createTwenty48(): Game {
  return new Twenty48Game();
}
