import type { Game, GameContext, GameMeta } from '../types';

const WIDTH = 480;
const HEIGHT = 640;
const BOARD_SIZE = 8;
const BOARD_X = 40;
const BOARD_Y = 118;
const CELL = 50;
const PLAYER_ONE = 1;
const PLAYER_TWO = 2;
const KING_FLAG = 4;

type Piece = 0 | 1 | 2 | 5 | 6;
type Cell = { row: number; column: number };
type Move = { from: Cell; to: Cell; captured: Cell | null };

export const meta: GameMeta = {
  id: 'checkers',
  title: 'Checkers',
  description: 'A hot-seat strategy duel on an eight-by-eight board.',
  controls: 'Arrows move the cursor. Action selects or moves a piece. Tap a square to play.',
  accent: '#ffcf70',
};

function playerOf(piece: Piece): 1 | 2 | 0 {
  if (piece === PLAYER_ONE || piece === PLAYER_ONE + KING_FLAG) return PLAYER_ONE;
  if (piece === PLAYER_TWO || piece === PLAYER_TWO + KING_FLAG) return PLAYER_TWO;
  return 0;
}

function isKing(piece: Piece): boolean {
  return piece === PLAYER_ONE + KING_FLAG || piece === PLAYER_TWO + KING_FLAG;
}

function inside(row: number, column: number): boolean {
  return row >= 0 && row < BOARD_SIZE && column >= 0 && column < BOARD_SIZE;
}

export class CheckersGame implements Game {
  readonly meta = meta;
  private canvas: HTMLCanvasElement | null = null;
  private context: GameContext | null = null;
  private drawing: CanvasRenderingContext2D | null = null;
  private board: Piece[][] = this.newBoard();
  private cursorRow = 5;
  private cursorColumn = 0;
  private selected: Cell | null = null;
  private player: 1 | 2 = PLAYER_ONE;
  private status: 'ready' | 'playing' | 'over' = 'ready';
  private paused = false;
  private winner: 1 | 2 | 0 = 0;
  private removePointerListener: (() => void) | null = null;

  init(canvas: HTMLCanvasElement, context: GameContext): void {
    this.canvas = canvas;
    this.context = context;
    this.drawing = canvas.getContext('2d');
    this.reset();
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('contextmenu', this.preventContextMenu);
    this.removePointerListener = () => {
      canvas.removeEventListener('pointerup', this.handlePointerUp);
      canvas.removeEventListener('contextmenu', this.preventContextMenu);
    };
    context.setStatus('ready');
  }

  update(_dt: number): void {
    if (!this.context || this.paused || this.status === 'over') return;
    const input = this.context.input;
    if (input.pressed('up')) this.cursorRow = Math.max(0, this.cursorRow - 1);
    if (input.pressed('down')) this.cursorRow = Math.min(BOARD_SIZE - 1, this.cursorRow + 1);
    if (input.pressed('left')) this.cursorColumn = Math.max(0, this.cursorColumn - 1);
    if (input.pressed('right')) this.cursorColumn = Math.min(BOARD_SIZE - 1, this.cursorColumn + 1);
    if (input.pressed('action')) {
      if (this.status === 'ready') this.start();
      else this.playAt({ row: this.cursorRow, column: this.cursorColumn });
    }
  }

  render(): void {
    const ctx = this.drawing;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;
    const scaleX = canvas.width / WIDTH;
    const scaleY = canvas.height / HEIGHT;
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scaleX, scaleY);
    ctx.fillStyle = '#0a0d1b';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = '#ffcf70';
    ctx.font = '700 25px monospace';
    ctx.fillText('DARK BOARD', 40, 50);
    ctx.fillStyle = '#8e96b8';
    ctx.font = '12px monospace';
    ctx.fillText('HOT-SEAT // TWO PLAYERS', 40, 75);
    ctx.fillStyle = '#f7f3e8';
    ctx.font = '700 14px monospace';
    ctx.fillText(`TURN: PLAYER ${this.player}`, 300, 50);
    ctx.fillStyle = '#8e96b8';
    ctx.font = '12px monospace';
    ctx.fillText('HIGH', 390, 75);
    ctx.fillStyle = '#f7f3e8';
    ctx.font = '700 16px monospace';
    ctx.fillText(String(this.context?.score.best() ?? 0).padStart(4, '0'), 425, 75);

    ctx.fillStyle = '#171d35';
    ctx.fillRect(BOARD_X - 8, BOARD_Y - 8, BOARD_SIZE * CELL + 16, BOARD_SIZE * CELL + 16);
    ctx.strokeStyle = '#3a456b';
    ctx.lineWidth = 2;
    ctx.strokeRect(BOARD_X - 8, BOARD_Y - 8, BOARD_SIZE * CELL + 16, BOARD_SIZE * CELL + 16);
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let column = 0; column < BOARD_SIZE; column += 1) this.renderCell(ctx, row, column);
    }

    ctx.fillStyle = '#8e96b8';
    ctx.font = '12px monospace';
    ctx.fillText('ARROWS: MOVE    ACTION: SELECT / MOVE', 40, 570);
    ctx.fillText('TAP A SQUARE TO PLAY', 40, 592);
    ctx.textAlign = 'center';
    if (this.status === 'ready') {
      ctx.fillStyle = '#fff071';
      ctx.font = '700 16px monospace';
      ctx.fillText('PRESS ACTION TO START', WIDTH / 2, 625);
    } else if (this.status === 'over') {
      ctx.fillStyle = this.winner === PLAYER_ONE ? '#72e7c2' : '#ff7f91';
      ctx.font = '700 16px monospace';
      ctx.fillText(`PLAYER ${this.winner} WINS // ${this.winner === PLAYER_ONE ? '+100' : '0'}`, WIDTH / 2, 625);
    } else if (this.paused) {
      ctx.fillStyle = '#fff071';
      ctx.font = '700 16px monospace';
      ctx.fillText('PAUSED', WIDTH / 2, 625);
    } else {
      ctx.fillStyle = '#8e96b8';
      ctx.font = '12px monospace';
      ctx.fillText(this.selected ? 'SELECT A GLOWING TARGET' : 'SELECT A PIECE TO BEGIN', WIDTH / 2, 625);
    }
    ctx.textAlign = 'left';
    ctx.restore();
  }

  pause(): void {
    if (this.status === 'playing') {
      this.paused = true;
      this.context?.setStatus('paused');
    }
  }

  resume(): void {
    if (this.status === 'playing') {
      this.paused = false;
      this.context?.setStatus('playing');
    }
  }

  destroy(): void {
    this.removePointerListener?.();
    this.removePointerListener = null;
    this.canvas = null;
    this.context = null;
    this.drawing = null;
  }

  private reset(): void {
    this.board = this.newBoard();
    this.cursorRow = 5;
    this.cursorColumn = 0;
    this.selected = null;
    this.player = PLAYER_ONE;
    this.winner = 0;
    this.status = 'ready';
    this.paused = false;
  }

  private newBoard(): Piece[][] {
    const board = Array.from({ length: BOARD_SIZE }, () => Array<Piece>(BOARD_SIZE).fill(0));
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < BOARD_SIZE; column += 1) {
        if ((row + column) % 2 === 1) board[row][column] = PLAYER_TWO;
      }
    }
    for (let row = 5; row < BOARD_SIZE; row += 1) {
      for (let column = 0; column < BOARD_SIZE; column += 1) {
        if ((row + column) % 2 === 1) board[row][column] = PLAYER_ONE;
      }
    }
    return board;
  }

  private start(): void {
    this.reset();
    this.status = 'playing';
    this.context?.score.reset();
    this.context?.setStatus('playing');
    this.context?.audio.tone(520, 80, 'triangle', 0.05);
  }

  private playAt(cell: Cell): void {
    if (this.status !== 'playing' || !inside(cell.row, cell.column)) return;
    const piece = this.board[cell.row][cell.column];
    if (!this.selected) {
      if (playerOf(piece) === this.player) {
        this.selected = { ...cell };
        this.context?.audio.tone(620, 45, 'sine', 0.04);
      }
      return;
    }
    const move = this.legalMovesFrom(this.selected).find((candidate) => candidate.to.row === cell.row && candidate.to.column === cell.column);
    if (move) {
      this.makeMove(move);
      return;
    }
    if (playerOf(piece) === this.player) {
      this.selected = { ...cell };
      this.context?.audio.tone(620, 45, 'sine', 0.04);
    } else {
      this.selected = null;
    }
  }

  private makeMove(move: Move): void {
    const moving = this.board[move.from.row][move.from.column];
    if (moving === 0) return;
    this.board[move.from.row][move.from.column] = 0;
    this.board[move.to.row][move.to.column] = moving;
    if (move.captured) this.board[move.captured.row][move.captured.column] = 0;
    let promoted = moving;
    if (playerOf(moving) === PLAYER_ONE && move.to.row === 0) promoted = PLAYER_ONE + KING_FLAG;
    if (playerOf(moving) === PLAYER_TWO && move.to.row === BOARD_SIZE - 1) promoted = PLAYER_TWO + KING_FLAG;
    this.board[move.to.row][move.to.column] = promoted as Piece;
    this.cursorRow = move.to.row;
    this.cursorColumn = move.to.column;
    this.context?.audio.tone(move.captured ? 760 : 480, 70, 'triangle', 0.05);

    if (move.captured && this.legalMovesFrom({ row: move.to.row, column: move.to.column }).some((candidate) => candidate.captured !== null)) {
      this.selected = { row: move.to.row, column: move.to.column };
      return;
    }
    this.selected = null;
    this.player = this.player === PLAYER_ONE ? PLAYER_TWO : PLAYER_ONE;
    this.finishIfNeeded();
  }

  private legalMovesFrom(cell: Cell): Move[] {
    if (!inside(cell.row, cell.column)) return [];
    const piece = this.board[cell.row][cell.column];
    if (playerOf(piece) !== this.player) return [];
    const captures = this.movesFor(cell, true);
    if (captures.length > 0) return captures;
    if (this.allCaptures(this.player).length > 0) return [];
    return this.movesFor(cell, false);
  }

  private movesFor(cell: Cell, captureOnly: boolean): Move[] {
    const piece = this.board[cell.row][cell.column];
    const owner = playerOf(piece);
    if (owner === 0) return [];
    const directions = isKing(piece) ? [-1, 1] : [owner === PLAYER_ONE ? -1 : 1];
    const moves: Move[] = [];
    for (const rowDirection of directions) {
      for (const columnDirection of [-1, 1]) {
        const nearRow = cell.row + rowDirection;
        const nearColumn = cell.column + columnDirection;
        if (!captureOnly && inside(nearRow, nearColumn) && this.board[nearRow][nearColumn] === 0) {
          moves.push({ from: { ...cell }, to: { row: nearRow, column: nearColumn }, captured: null });
        }
        const jumpRow = cell.row + rowDirection * 2;
        const jumpColumn = cell.column + columnDirection * 2;
        if (inside(jumpRow, jumpColumn) && playerOf(this.board[nearRow]?.[nearColumn] ?? 0) !== 0 && playerOf(this.board[nearRow][nearColumn]) !== owner && this.board[jumpRow][jumpColumn] === 0) {
          moves.push({ from: { ...cell }, to: { row: jumpRow, column: jumpColumn }, captured: { row: nearRow, column: nearColumn } });
        }
      }
    }
    return captureOnly ? moves.filter((move) => move.captured !== null) : moves;
  }

  private allCaptures(owner: 1 | 2): Move[] {
    const captures: Move[] = [];
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let column = 0; column < BOARD_SIZE; column += 1) {
        if (playerOf(this.board[row][column]) === owner) captures.push(...this.movesFor({ row, column }, true));
      }
    }
    return captures;
  }

  private finishIfNeeded(): void {
    let pieces = 0;
    for (const row of this.board) for (const piece of row) if (playerOf(piece) === this.player) pieces += 1;
    const hasMoves = this.allMoves(this.player).length > 0;
    if (pieces > 0 && hasMoves) return;
    this.winner = this.player === PLAYER_ONE ? PLAYER_TWO : PLAYER_ONE;
    this.status = 'over';
    this.context?.setStatus('over');
    if (this.winner === PLAYER_ONE) this.context?.score.add(100);
    this.context?.audio.tone(this.winner === PLAYER_ONE ? 880 : 150, 180, 'triangle', 0.07);
  }

  private allMoves(owner: 1 | 2): Move[] {
    const moves: Move[] = [];
    const captures = this.allCaptures(owner);
    if (captures.length > 0) return captures;
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let column = 0; column < BOARD_SIZE; column += 1) {
        if (playerOf(this.board[row][column]) === owner) moves.push(...this.movesFor({ row, column }, false));
      }
    }
    return moves;
  }

  private renderCell(ctx: CanvasRenderingContext2D, row: number, column: number): void {
    const x = BOARD_X + column * CELL;
    const y = BOARD_Y + row * CELL;
    const dark = (row + column) % 2 === 1;
    ctx.fillStyle = dark ? '#38415f' : '#d9c9a4';
    ctx.fillRect(x, y, CELL, CELL);
    const selected = this.selected?.row === row && this.selected.column === column;
    const cursor = this.status === 'playing' && this.cursorRow === row && this.cursorColumn === column;
    if (selected) {
      ctx.fillStyle = 'rgba(255, 240, 113, 0.30)';
      ctx.fillRect(x + 3, y + 3, CELL - 6, CELL - 6);
    }
    if (this.selected && this.legalMovesFrom(this.selected).some((move) => move.to.row === row && move.to.column === column)) {
      ctx.fillStyle = '#fff071';
      ctx.beginPath();
      ctx.arc(x + CELL / 2, y + CELL / 2, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    if (cursor) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 3, y + 3, CELL - 6, CELL - 6);
    }
    const piece = this.board[row][column];
    if (piece === 0) return;
    const owner = playerOf(piece);
    ctx.fillStyle = owner === PLAYER_ONE ? '#72e7c2' : '#ff7f91';
    ctx.beginPath();
    ctx.arc(x + CELL / 2, y + CELL / 2 + 2, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = owner === PLAYER_ONE ? '#d4fff1' : '#ffd5db';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.34)';
    ctx.beginPath();
    ctx.arc(x + CELL / 2 - 5, y + CELL / 2 - 5, 5, 0, Math.PI * 2);
    ctx.fill();
    if (isKing(piece)) {
      ctx.fillStyle = '#172039';
      ctx.font = '700 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('K', x + CELL / 2, y + CELL / 2 + 6);
      ctx.textAlign = 'left';
    }
  }

  private pointerCell(event: PointerEvent): Cell | null {
    if (!this.canvas) return null;
    const bounds = this.canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return null;
    const logicalX = (event.clientX - bounds.left) * (WIDTH / bounds.width);
    const logicalY = (event.clientY - bounds.top) * (HEIGHT / bounds.height);
    const column = Math.floor((logicalX - BOARD_X) / CELL);
    const row = Math.floor((logicalY - BOARD_Y) / CELL);
    return inside(row, column) ? { row, column } : null;
  }

  private handlePointerUp = (event: PointerEvent): void => {
    if (event.button !== 0 || this.paused || this.status === 'over') return;
    const cell = this.pointerCell(event);
    if (!cell) return;
    event.preventDefault();
    this.cursorRow = cell.row;
    this.cursorColumn = cell.column;
    if (this.status === 'ready') this.start();
    else this.playAt(cell);
  };

  private preventContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };
}

export function createCheckers(): Game {
  return new CheckersGame();
}
