import type { Game, GameContext, GameMeta } from '../types';
import { floodReveal } from './logic';

const SIZE = 9;
const HAZARDS = 10;
const CELL = 40;
const BOARD_X = 60;
const BOARD_Y = 150;
const BOARD_SIZE = SIZE * CELL;
const LONG_PRESS_MS = 450;

export const mineSweepMeta: GameMeta = {
  id: 'mine-sweep',
  title: 'Mine Sweep',
  description: 'Clear the grid. Mark hazards. Trust your first move.',
  controls: 'Open safe cells, or hold a cell to mark a hazard.',
  accent: '#ff4fd8',
};

export class MineSweepGame implements Game {
  readonly meta = mineSweepMeta;
  private canvas: HTMLCanvasElement | null = null;
  private context: GameContext | null = null;
  private board: number[][] = [];
  private revealed: boolean[][] = [];
  private flagged: boolean[][] = [];
  private cursorRow = 4;
  private cursorColumn = 4;
  private started = false;
  private ended = false;
  private paused = false;
  private firstMove = true;
  private pointerTimer: number | null = null;
  private pointerLongPressed = false;
  private pointerDownCell: [number, number] | null = null;
  private pointerId: number | null = null;
  private removeCanvasListeners: (() => void) | null = null;

  init(canvas: HTMLCanvasElement, context: GameContext): void {
    this.canvas = canvas;
    this.context = context;
    this.resetBoard();
    canvas.addEventListener('contextmenu', this.preventContextMenu);
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('pointercancel', this.handlePointerCancel);
    canvas.addEventListener('pointerleave', this.handlePointerCancel);
    this.removeCanvasListeners = () => {
      canvas.removeEventListener('contextmenu', this.preventContextMenu);
      canvas.removeEventListener('pointerdown', this.handlePointerDown);
      canvas.removeEventListener('pointerup', this.handlePointerUp);
      canvas.removeEventListener('pointercancel', this.handlePointerCancel);
      canvas.removeEventListener('pointerleave', this.handlePointerCancel);
    };
  }

  update(_dt: number): void {
    if (!this.context || this.paused || this.ended) return;
    const { input } = this.context;
    if (input.pressed('up')) this.cursorRow = Math.max(0, this.cursorRow - 1);
    if (input.pressed('down')) this.cursorRow = Math.min(SIZE - 1, this.cursorRow + 1);
    if (input.pressed('left')) this.cursorColumn = Math.max(0, this.cursorColumn - 1);
    if (input.pressed('right')) this.cursorColumn = Math.min(SIZE - 1, this.cursorColumn + 1);
    if (input.pressed('secondary')) this.toggleFlag(this.cursorRow, this.cursorColumn);
    if (input.pressed('action')) {
      if (!this.started) {
        this.started = true;
        this.context.setStatus('playing');
      }
      this.open(this.cursorRow, this.cursorColumn);
    }
  }

  render(): void {
    const canvas = this.canvas;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const scale = canvas.width / 480;
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#080817';
    ctx.fillRect(0, 0, 480, 640);
    ctx.fillStyle = '#ff4fd8';
    ctx.font = '700 18px monospace';
    ctx.fillText('MINE // SWEEP', 60, 48);
    ctx.fillStyle = '#76f7ff';
    ctx.font = '12px monospace';
    ctx.fillText('SAFE CELLS +10  •  HOLD TO FLAG', 60, 72);
    ctx.strokeStyle = '#2c315d';
    ctx.lineWidth = 2;
    ctx.strokeRect(BOARD_X - 4, BOARD_Y - 4, BOARD_SIZE + 8, BOARD_SIZE + 8);

    for (let row = 0; row < SIZE; row += 1) {
      for (let column = 0; column < SIZE; column += 1) this.renderCell(ctx, row, column);
    }
    const cursorX = BOARD_X + this.cursorColumn * CELL;
    const cursorY = BOARD_Y + this.cursorRow * CELL;
    ctx.strokeStyle = '#fff36b';
    ctx.lineWidth = 2;
    ctx.strokeRect(cursorX + 2, cursorY + 2, CELL - 4, CELL - 4);
    ctx.fillStyle = '#9aa0d4';
    ctx.font = '11px monospace';
    ctx.fillText('ARROWS: MOVE    SPACE: OPEN    X: FLAG', 60, 555);
    ctx.fillText('TAP: OPEN    LONG PRESS / SECONDARY: FLAG', 60, 578);
    if (!this.started && !this.ended) {
      ctx.fillStyle = '#fff36b';
      ctx.font = '700 14px monospace';
      ctx.fillText('FIRST MOVE IS ALWAYS SAFE', 60, 610);
    } else if (this.ended) {
      ctx.fillStyle = this.hasWon() ? '#76f7ff' : '#ff6b7a';
      ctx.font = '700 16px monospace';
      ctx.fillText(this.hasWon() ? 'GRID CLEARED // NICE WORK' : 'HAZARD HIT // TRY AGAIN', 60, 610);
    }
    ctx.restore();
  }

  destroy(): void {
    this.clearPointerTimer();
    this.removeCanvasListeners?.();
    this.removeCanvasListeners = null;
    this.canvas = null;
    this.context = null;
  }

  pause(): void {
    this.paused = true;
    this.clearPointerTimer();
  }

  resume(): void {
    this.paused = false;
  }

  private resetBoard(): void {
    this.board = Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(0));
    this.revealed = Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false));
    this.flagged = Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false));
    this.started = false;
    this.ended = false;
    this.firstMove = true;
    this.cursorRow = 4;
    this.cursorColumn = 4;
    this.placeHazards();
  }

  private placeHazards(safeRow?: number, safeColumn?: number): void {
    const positions: [number, number][] = [];
    for (let row = 0; row < SIZE; row += 1) {
      for (let column = 0; column < SIZE; column += 1) {
        if (row !== safeRow || column !== safeColumn) positions.push([row, column]);
      }
    }
    for (let index = positions.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [positions[index], positions[swapIndex]] = [positions[swapIndex], positions[index]];
    }
    this.board = Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(0));
    for (const [row, column] of positions.slice(0, HAZARDS)) this.board[row][column] = -1;
    for (let row = 0; row < SIZE; row += 1) {
      for (let column = 0; column < SIZE; column += 1) {
        if (this.board[row][column] < 0) continue;
        let count = 0;
        for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
          for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
            const adjacentRow = row + rowOffset;
            const adjacentColumn = column + columnOffset;
            if (adjacentRow >= 0 && adjacentRow < SIZE && adjacentColumn >= 0 && adjacentColumn < SIZE && this.board[adjacentRow][adjacentColumn] < 0) count += 1;
          }
        }
        this.board[row][column] = count;
      }
    }
  }

  private open(row: number, column: number): void {
    if (this.ended || this.flagged[row][column]) return;
    if (this.firstMove) {
      this.placeHazards(row, column);
      this.firstMove = false;
    }
    if (this.board[row][column] < 0) {
      this.revealed[row][column] = true;
      this.ended = true;
      this.context?.audio.tone(110, 240, 'sawtooth', 0.08);
      this.context?.setStatus('over');
      return;
    }
    const result = floodReveal(this.board, this.revealed, row, column);
    this.revealed = result.revealed;
    if (result.cells.length > 0) {
      this.context?.score.add(result.cells.length * 10);
      this.context?.audio.tone(440 + result.cells.length * 12, 55, 'square', 0.05);
    }
    if (this.hasWon()) {
      this.ended = true;
      this.context?.score.add(100);
      this.context?.audio.tone(880, 150, 'triangle', 0.08);
      this.context?.setStatus('over');
    }
  }

  private toggleFlag(row: number, column: number): void {
    if (this.ended || this.revealed[row][column]) return;
    this.flagged[row][column] = !this.flagged[row][column];
    this.context?.audio.tone(this.flagged[row][column] ? 260 : 180, 45, 'square', 0.04);
  }

  private hasWon(): boolean {
    for (let row = 0; row < SIZE; row += 1) {
      for (let column = 0; column < SIZE; column += 1) {
        if (this.board[row][column] >= 0 && !this.revealed[row][column]) return false;
      }
    }
    return true;
  }

  private renderCell(ctx: CanvasRenderingContext2D, row: number, column: number): void {
    const x = BOARD_X + column * CELL;
    const y = BOARD_Y + row * CELL;
    const value = this.board[row][column];
    const isVisible = this.revealed[row][column] || (this.ended && value < 0);
    ctx.fillStyle = isVisible ? '#171b3a' : '#10132b';
    ctx.fillRect(x, y, CELL - 1, CELL - 1);
    ctx.strokeStyle = isVisible ? '#30386e' : '#252b55';
    ctx.strokeRect(x, y, CELL - 1, CELL - 1);
    if (this.flagged[row][column] && !isVisible) {
      ctx.fillStyle = '#ff4fd8';
      ctx.font = '700 22px monospace';
      ctx.fillText('⚑', x + 10, y + 27);
    } else if (isVisible && value < 0) {
      ctx.fillStyle = '#ff6b7a';
      ctx.font = '700 20px monospace';
      ctx.fillText('✹', x + 10, y + 27);
    } else if (this.revealed[row][column] && value > 0) {
      ctx.fillStyle = ['#76f7ff', '#8eff8e', '#fff36b', '#ff9d6c', '#d19cff'][Math.min(value - 1, 4)];
      ctx.font = '700 19px monospace';
      ctx.fillText(String(value), x + 14, y + 27);
    }
  }

  private preventContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  private handlePointerDown = (event: PointerEvent): void => {
    if (this.paused || this.ended || !this.canvas) return;
    event.preventDefault();
    const cell = this.pointerCell(event);
    if (!cell) return;
    this.pointerId = event.pointerId;
    this.pointerDownCell = cell;
    this.pointerLongPressed = false;
    this.canvas.setPointerCapture?.(event.pointerId);
    if (event.button === 2) {
      this.pointerLongPressed = true;
      this.toggleFlag(cell[0], cell[1]);
      return;
    }
    this.pointerTimer = window.setTimeout(() => {
      this.pointerLongPressed = true;
      this.toggleFlag(cell[0], cell[1]);
    }, LONG_PRESS_MS);
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (this.pointerId !== null && event.pointerId !== this.pointerId) return;
    event.preventDefault();
    const cell = this.pointerCell(event);
    this.clearPointerTimer();
    if (!this.pointerLongPressed && cell && this.pointerDownCell && cell[0] === this.pointerDownCell[0] && cell[1] === this.pointerDownCell[1]) {
      if (!this.started) {
        this.started = true;
        this.context?.setStatus('playing');
      }
      this.open(cell[0], cell[1]);
    }
    this.pointerDownCell = null;
    this.pointerId = null;
    this.pointerLongPressed = false;
  };

  private handlePointerCancel = (): void => {
    this.clearPointerTimer();
    this.pointerDownCell = null;
    this.pointerId = null;
    this.pointerLongPressed = false;
  };

  private clearPointerTimer(): void {
    if (this.pointerTimer !== null) window.clearTimeout(this.pointerTimer);
    this.pointerTimer = null;
  }

  private pointerCell(event: PointerEvent): [number, number] | null {
    if (!this.canvas) return null;
    const bounds = this.canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return null;
    const logicalX = (event.clientX - bounds.left) * (this.canvas.width / bounds.width);
    const logicalY = (event.clientY - bounds.top) * (this.canvas.height / bounds.height);
    const column = Math.floor((logicalX - BOARD_X) / CELL);
    const row = Math.floor((logicalY - BOARD_Y) / CELL);
    if (row < 0 || row >= SIZE || column < 0 || column >= SIZE) return null;
    return [row, column];
  }
}

export function createMineSweep(): Game {
  return new MineSweepGame();
}

export default {
  meta: mineSweepMeta,
  create: createMineSweep,
};
