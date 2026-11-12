import type { Game, GameContext, GameMeta } from '../types';

const WIDTH = 480;
const HEIGHT = 640;
const BOARD_X = 60;
const BOARD_Y = 150;
const CELL = 120;
const BOARD_SIZE = CELL * 3;

type Cell = 0 | 1 | 2;
type Board = Cell[];

export const meta: GameMeta = {
  id: 'three-in-a-row',
  title: 'Three in a Row',
  description: 'Outplay the machine on a classic three-by-three grid.',
  controls: 'Use arrows to move the highlight, then press action to place a piece. Tap a cell to place.',
  accent: '#76f7ff',
};

const WIN_LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const MOVE_ORDER = [4, 0, 2, 6, 8, 1, 3, 5, 7];

function emptyBoard(): Board {
  return [0, 0, 0, 0, 0, 0, 0, 0, 0];
}

function winner(board: Board): Cell {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] !== 0 && board[a] === board[b] && board[b] === board[c]) return board[a];
  }
  return 0;
}

function isFull(board: Board): boolean {
  return board.every((cell) => cell !== 0);
}

export class ThreeInARowGame implements Game {
  readonly meta = meta;
  private canvas: HTMLCanvasElement | null = null;
  private context: GameContext | null = null;
  private drawing: CanvasRenderingContext2D | null = null;
  private board = emptyBoard();
  private cursor = 4;
  private status: 'ready' | 'playing' | 'over' = 'ready';
  private paused = false;
  private aiPending = false;

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (this.paused || this.status !== 'playing' || this.aiPending) return;
    const cell = this.pointerCell(event);
    if (cell === null) return;
    this.cursor = cell;
    this.placePlayer(cell);
  };

  init(canvas: HTMLCanvasElement, context: GameContext): void {
    this.canvas = canvas;
    this.context = context;
    this.drawing = canvas.getContext('2d');
    this.resetBoard();
    canvas.addEventListener('pointerup', this.onPointerUp);
    context.setStatus('ready');
    context.audio.tone(300, 70, 'sine', 0.035);
    this.render();
  }

  update(_dt: number): void {
    if (!this.context || this.paused) return;
    if (this.status === 'ready') {
      if (this.context.input.pressed('action')) this.start();
      return;
    }
    if (this.status !== 'playing') return;
    if (this.aiPending) {
      this.playAiTurn();
      return;
    }
    const input = this.context.input;
    if (input.pressed('up')) this.cursor = this.cursor < 3 ? this.cursor + 6 : this.cursor - 3;
    if (input.pressed('down')) this.cursor = this.cursor >= 6 ? this.cursor - 6 : this.cursor + 3;
    if (input.pressed('left')) this.cursor = this.cursor % 3 === 0 ? this.cursor + 2 : this.cursor - 1;
    if (input.pressed('right')) this.cursor = this.cursor % 3 === 2 ? this.cursor - 2 : this.cursor + 1;
    if (input.pressed('action')) this.placePlayer(this.cursor);
    this.render();
  }

  render(): void {
    const ctx = this.drawing;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;
    const scale = Math.min(canvas.width / WIDTH, canvas.height / HEIGHT);
    const offsetX = (canvas.width - WIDTH * scale) / 2;
    const offsetY = (canvas.height - HEIGHT * scale) / 2;
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#090b1c';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = '#76f7ff';
    ctx.font = '700 22px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('THREE IN A ROW', 60, 54);
    ctx.fillStyle = '#9aa0d4';
    ctx.font = '12px monospace';
    ctx.fillText('YOU  ×    MACHINE  ○', 60, 82);

    ctx.fillStyle = '#121936';
    ctx.fillRect(BOARD_X, BOARD_Y, BOARD_SIZE, BOARD_SIZE);
    ctx.strokeStyle = '#303b70';
    ctx.lineWidth = 3;
    for (let line = 1; line < 3; line += 1) {
      ctx.beginPath();
      ctx.moveTo(BOARD_X + line * CELL, BOARD_Y);
      ctx.lineTo(BOARD_X + line * CELL, BOARD_Y + BOARD_SIZE);
      ctx.moveTo(BOARD_X, BOARD_Y + line * CELL);
      ctx.lineTo(BOARD_X + BOARD_SIZE, BOARD_Y + line * CELL);
      ctx.stroke();
    }

    if (this.status === 'playing' && !this.aiPending && this.board[this.cursor] === 0) {
      const cursorX = BOARD_X + (this.cursor % 3) * CELL;
      const cursorY = BOARD_Y + Math.floor(this.cursor / 3) * CELL;
      ctx.fillStyle = 'rgba(118, 247, 255, 0.14)';
      ctx.fillRect(cursorX + 5, cursorY + 5, CELL - 10, CELL - 10);
      ctx.strokeStyle = '#fff36b';
      ctx.lineWidth = 3;
      ctx.strokeRect(cursorX + 8, cursorY + 8, CELL - 16, CELL - 16);
    }

    for (let index = 0; index < this.board.length; index += 1) {
      const cell = this.board[index];
      if (cell === 0) continue;
      const centerX = BOARD_X + (index % 3) * CELL + CELL / 2;
      const centerY = BOARD_Y + Math.floor(index / 3) * CELL + CELL / 2;
      if (cell === 1) this.drawCross(ctx, centerX, centerY);
      else this.drawCircle(ctx, centerX, centerY);
    }

    ctx.textAlign = 'center';
    if (this.status === 'ready') {
      ctx.fillStyle = '#fff36b';
      ctx.font = '700 16px monospace';
      ctx.fillText('PRESS ACTION TO START', WIDTH / 2, 570);
    } else if (this.status === 'playing') {
      ctx.fillStyle = '#9aa0d4';
      ctx.font = '12px monospace';
      ctx.fillText(this.aiPending ? 'MACHINE IS THINKING' : 'ARROWS: MOVE    ACTION: PLACE    TAP: PLACE', WIDTH / 2, 570);
    } else {
      const result = winner(this.board);
      ctx.fillStyle = result === 1 ? '#76f7ff' : result === 2 ? '#ff6b7a' : '#fff36b';
      ctx.font = '700 17px monospace';
      ctx.fillText(result === 1 ? 'YOU WIN // +100' : result === 2 ? 'MACHINE WINS // 0' : 'TIE // +25', WIDTH / 2, 570);
    }
    ctx.fillStyle = '#59618f';
    ctx.font = '11px monospace';
    ctx.fillText('THE HIGHLIGHTED CELL IS YOUR NEXT MOVE', WIDTH / 2, 604);
    ctx.restore();
  }

  destroy(): void {
    this.canvas?.removeEventListener('pointerup', this.onPointerUp);
    this.canvas = null;
    this.context = null;
    this.drawing = null;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  private resetBoard(): void {
    this.board = emptyBoard();
    this.cursor = 4;
    this.status = 'ready';
    this.paused = false;
    this.aiPending = false;
  }

  private start(): void {
    this.resetBoard();
    this.status = 'playing';
    this.context?.score.reset();
    this.context?.setStatus('playing');
    this.context?.audio.tone(520, 80, 'triangle', 0.05);
    this.render();
  }

  private placePlayer(index: number): void {
    if (this.status !== 'playing' || this.aiPending || this.board[index] !== 0) return;
    this.board[index] = 1;
    this.context?.audio.tone(620, 65, 'triangle', 0.05);
    if (this.finishIfComplete()) return;
    this.aiPending = true;
    this.render();
  }

  private playAiTurn(): void {
    if (this.status !== 'playing' || !this.aiPending) return;
    const move = this.bestMove(this.board);
    if (move !== -1) this.board[move] = 2;
    this.aiPending = false;
    this.context?.audio.tone(260, 75, 'square', 0.045);
    this.finishIfComplete();
    this.render();
  }

  private finishIfComplete(): boolean {
    const result = winner(this.board);
    if (result === 0 && !isFull(this.board)) return false;
    this.status = 'over';
    this.aiPending = false;
    if (result === 1) {
      this.context?.score.add(100);
      this.context?.audio.tone(880, 180, 'triangle', 0.08);
    } else if (result === 0) {
      this.context?.score.add(25);
      this.context?.audio.tone(520, 130, 'sine', 0.06);
    } else {
      this.context?.audio.tone(120, 220, 'sawtooth', 0.07);
    }
    this.context?.setStatus('over');
    return true;
  }

  private bestMove(board: Board): number {
    let bestScore = -Infinity;
    let move = -1;
    for (const index of MOVE_ORDER) {
      if (board[index] !== 0) continue;
      board[index] = 2;
      const score = this.minimax(board, false, 0);
      board[index] = 0;
      if (score > bestScore) {
        bestScore = score;
        move = index;
      }
    }
    return move;
  }

  private minimax(board: Board, maximizing: boolean, depth: number): number {
    const result = winner(board);
    if (result === 2) return 10 - depth;
    if (result === 1) return depth - 10;
    if (isFull(board)) return 0;
    let best = maximizing ? -Infinity : Infinity;
    for (const index of MOVE_ORDER) {
      if (board[index] !== 0) continue;
      board[index] = maximizing ? 2 : 1;
      const score = this.minimax(board, !maximizing, depth + 1);
      board[index] = 0;
      best = maximizing ? Math.max(best, score) : Math.min(best, score);
    }
    return best;
  }

  private drawCross(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.strokeStyle = '#76f7ff';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 31, y - 31);
    ctx.lineTo(x + 31, y + 31);
    ctx.moveTo(x + 31, y - 31);
    ctx.lineTo(x - 31, y + 31);
    ctx.stroke();
  }

  private drawCircle(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.strokeStyle = '#ff6b7a';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(x, y, 34, 0, Math.PI * 2);
    ctx.stroke();
  }

  private pointerCell(event: PointerEvent): number | null {
    if (!this.canvas) return null;
    const bounds = this.canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return null;
    const scale = Math.min(this.canvas.width / WIDTH, this.canvas.height / HEIGHT);
    const offsetX = (this.canvas.width - WIDTH * scale) / 2;
    const offsetY = (this.canvas.height - HEIGHT * scale) / 2;
    const logicalX = (event.clientX - bounds.left) * (this.canvas.width / bounds.width);
    const logicalY = (event.clientY - bounds.top) * (this.canvas.height / bounds.height);
    const x = (logicalX - offsetX) / scale;
    const y = (logicalY - offsetY) / scale;
    const column = Math.floor((x - BOARD_X) / CELL);
    const row = Math.floor((y - BOARD_Y) / CELL);
    if (row < 0 || row >= 3 || column < 0 || column >= 3) return null;
    return row * 3 + column;
  }
}

export function createThreeInARow(): Game {
  return new ThreeInARowGame();
}
