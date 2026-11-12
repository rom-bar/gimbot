import type { Game, GameContext, GameMeta } from '../types';
import { applyMove, getLegalMoves, type Player } from './logic';

const SIZE = 8;
const LOGICAL_WIDTH = 640;
const LOGICAL_HEIGHT = 760;
const BOARD_X = 48;
const BOARD_Y = 142;
const CELL = 68;
const BOARD_SIZE = SIZE * CELL;
const HUMAN: Player = 1;
const AI: Player = -1;
const CORNERS = new Set(['0,0', '0,7', '7,0', '7,7']);

export const meta: GameMeta = {
  id: 'disk-reversal',
  title: 'Disk Reversal',
  description: 'Claim the board by surrounding and reversing your rival’s disks.',
  controls: 'Arrows move the marker. Action places a disk. You can also tap a square.',
  accent: '#f4c95d',
  touchControls: { dpad: ['up', 'down', 'left', 'right'], buttons: ['action'], labels: {action: 'Place'}, gestures: false },
};

function startingBoard(): number[][] {
  const board = Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(0));
  board[3][3] = -1;
  board[3][4] = 1;
  board[4][3] = 1;
  board[4][4] = -1;
  return board;
}

export class DiskReversalGame implements Game {
  readonly meta = meta;
  private canvas: HTMLCanvasElement | null = null;
  private context: GameContext | null = null;
  private board = startingBoard();
  private status: 'ready' | 'playing' | 'over' = 'ready';
  private paused = false;
  private turn: Player = HUMAN;
  private cursorRow = 2;
  private cursorColumn = 3;
  private aiTimer = 0;
  private message = 'Press action to begin';
  private removeListeners: (() => void) | null = null;

  init(canvas: HTMLCanvasElement, context: GameContext): void {
    this.canvas = canvas;
    this.context = context;
    this.board = startingBoard();
    this.status = 'ready';
    this.paused = false;
    this.turn = HUMAN;
    this.aiTimer = 0;
    this.message = 'Press action to begin';
    context.setStatus('ready');
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('contextmenu', this.preventContextMenu);
    this.removeListeners = () => {
      canvas.removeEventListener('pointerup', this.handlePointerUp);
      canvas.removeEventListener('contextmenu', this.preventContextMenu);
    };
  }

  update(dt: number): void {
    if (!this.context || this.paused || this.status === 'over') return;
    if (this.status === 'ready') {
      if (this.context.input.pressed('action')) this.start();
      return;
    }
    if (this.turn === AI) {
      this.aiTimer -= dt;
      if (this.aiTimer <= 0) this.playAi();
      return;
    }
    if (this.context.input.pressed('up')) this.cursorRow = Math.max(0, this.cursorRow - 1);
    if (this.context.input.pressed('down')) this.cursorRow = Math.min(SIZE - 1, this.cursorRow + 1);
    if (this.context.input.pressed('left')) this.cursorColumn = Math.max(0, this.cursorColumn - 1);
    if (this.context.input.pressed('right')) this.cursorColumn = Math.min(SIZE - 1, this.cursorColumn + 1);
    if (this.context.input.pressed('action')) this.playHuman(this.cursorRow, this.cursorColumn);
  }

  render(): void {
    const canvas = this.canvas;
    const drawing = canvas?.getContext('2d');
    if (!canvas || !drawing) return;
    const scaleX = canvas.width / LOGICAL_WIDTH;
    const scaleY = canvas.height / LOGICAL_HEIGHT;
    drawing.save();
    drawing.clearRect(0, 0, canvas.width, canvas.height);
    drawing.scale(scaleX, scaleY);
    drawing.fillStyle = '#07141a';
    drawing.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    drawing.fillStyle = '#f4c95d';
    drawing.font = '700 30px monospace';
    drawing.fillText('DISK REVERSAL', 42, 52);
    drawing.fillStyle = '#91b7b5';
    drawing.font = '13px monospace';
    drawing.fillText('SURROUND // REVERSE // CONTROL', 44, 78);
    const humanCount = this.count(HUMAN);
    const aiCount = this.count(AI);
    this.label(drawing, 'YOU', 420, 37, '#79e2c0');
    this.number(drawing, humanCount, 420, 66, '#f2fff8');
    this.label(drawing, 'HIGH', 530, 37, '#91b7b5');
    this.number(drawing, this.context?.score.best() ?? 0, 530, 66, '#f2fff8');
    drawing.fillStyle = '#12383a';
    drawing.fillRect(BOARD_X - 12, BOARD_Y - 12, BOARD_SIZE + 24, BOARD_SIZE + 24);
    drawing.strokeStyle = '#2e6b68';
    drawing.lineWidth = 3;
    drawing.strokeRect(BOARD_X - 12, BOARD_Y - 12, BOARD_SIZE + 24, BOARD_SIZE + 24);
    for (let row = 0; row < SIZE; row += 1) {
      for (let column = 0; column < SIZE; column += 1) this.renderCell(drawing, row, column);
    }
    drawing.fillStyle = '#91b7b5';
    drawing.font = '13px monospace';
    drawing.fillText(`YOU ${humanCount}    RIVAL ${aiCount}`, 48, 720);
    drawing.fillText('ARROWS: MOVE    ACTION: PLACE    TAP: PLACE', 48, 742);
    drawing.fillStyle = this.status === 'over' ? '#f4c95d' : this.turn === HUMAN ? '#79e2c0' : '#d59bdf';
    drawing.font = '700 16px monospace';
    drawing.fillText(this.message, 48, 112);
    if (this.paused) {
      drawing.fillStyle = 'rgba(7, 20, 26, 0.72)';
      drawing.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      drawing.fillStyle = '#f4c95d';
      drawing.font = '700 24px monospace';
      drawing.fillText('PAUSED', 258, 390);
    }
    drawing.restore();
  }

  pause(): void {
    if (this.status === 'playing' && !this.paused) {
      this.paused = true;
      this.context?.setStatus('paused');
    }
  }

  resume(): void {
    if (this.status === 'playing' && this.paused) {
      this.paused = false;
      this.context?.setStatus('playing');
    }
  }

  destroy(): void {
    this.removeListeners?.();
    this.removeListeners = null;
    this.canvas = null;
    this.context = null;
  }

  private start(): void {
    this.board = startingBoard();
    this.status = 'playing';
    this.paused = false;
    this.turn = HUMAN;
    this.cursorRow = 2;
    this.cursorColumn = 3;
    this.aiTimer = 0;
    this.message = 'Your turn';
    this.context?.score.reset();
    this.context?.setStatus('playing');
    this.context?.audio.tone(420, 90, 'triangle', 0.07);
  }

  private playHuman(row: number, column: number): void {
    if (this.turn !== HUMAN) return;
    const next = applyMove(this.board, HUMAN, row, column);
    if (!next) {
      this.context?.audio.tone(180, 65, 'square', 0.04);
      return;
    }
    this.board = next;
    this.context?.audio.tone(520, 70, 'sine', 0.06);
    this.advanceTurn(AI);
  }

  private playAi(): void {
    if (this.turn !== AI || this.status !== 'playing') return;
    const moves = getLegalMoves(this.board, AI);
    if (moves.length === 0) {
      this.advanceTurn(HUMAN);
      return;
    }
    const [row, column] = this.chooseAiMove(moves);
    this.board = applyMove(this.board, AI, row, column) ?? this.board;
    this.context?.audio.tone(290, 80, 'sine', 0.045);
    this.advanceTurn(HUMAN);
  }

  private chooseAiMove(moves: Array<[number, number]>): [number, number] {
    let best = moves[0];
    let bestValue = -Infinity;
    for (const move of moves) {
      const [row, column] = move;
      const next = applyMove(this.board, AI, row, column);
      if (!next) continue;
      const value = (CORNERS.has(`${row},${column}`) ? 10000 : 0) + this.countOn(next, AI) * 10;
      if (value > bestValue) {
        bestValue = value;
        best = move;
      }
    }
    return best;
  }

  private advanceTurn(nextTurn: Player): void {
    const nextMoves = getLegalMoves(this.board, nextTurn);
    const otherTurn: Player = nextTurn === HUMAN ? AI : HUMAN;
    const otherMoves = getLegalMoves(this.board, otherTurn);
    if (nextMoves.length === 0 && otherMoves.length === 0) {
      this.finish();
      return;
    }
    if (nextMoves.length === 0) {
      this.turn = otherTurn;
      this.message = otherTurn === HUMAN ? 'Rival passed — your turn' : 'No move — rival plays';
      this.aiTimer = otherTurn === AI ? 0.35 : 0;
      return;
    }
    this.turn = nextTurn;
    this.message = nextTurn === HUMAN ? 'Your turn' : 'Rival is choosing';
    this.aiTimer = nextTurn === AI ? 0.35 : 0;
  }

  private finish(): void {
    this.status = 'over';
    this.turn = HUMAN;
    const human = this.count(HUMAN);
    const rival = this.count(AI);
    const score = human > rival ? 100 : human === rival ? 25 : 0;
    this.context?.score.set(score);
    this.context?.setStatus('over');
    this.context?.audio.tone(score === 100 ? 880 : score === 25 ? 550 : 180, 150, 'triangle', 0.07);
    this.message = human > rival ? `You win ${human}-${rival} // +100` : human === rival ? `Draw ${human}-${rival} // +25` : `Rival wins ${rival}-${human} // +0`;
  }

  private count(player: Player): number { return this.countOn(this.board, player); }

  private countOn(board: readonly (readonly number[])[], player: Player): number {
    return board.reduce((total, row) => total + row.filter((cell) => cell === player).length, 0);
  }

  private label(drawing: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): void {
    drawing.fillStyle = color;
    drawing.font = '12px monospace';
    drawing.fillText(text, x, y);
  }

  private number(drawing: CanvasRenderingContext2D, value: number, x: number, y: number, color: string): void {
    drawing.fillStyle = color;
    drawing.font = '700 24px monospace';
    drawing.fillText(String(value).padStart(2, '0'), x, y);
  }

  private renderCell(drawing: CanvasRenderingContext2D, row: number, column: number): void {
    const x = BOARD_X + column * CELL;
    const y = BOARD_Y + row * CELL;
    drawing.fillStyle = (row + column) % 2 === 0 ? '#1a5250' : '#174845';
    drawing.fillRect(x, y, CELL, CELL);
    drawing.strokeStyle = '#2f7770';
    drawing.lineWidth = 1;
    drawing.strokeRect(x, y, CELL, CELL);
    if (row === this.cursorRow && column === this.cursorColumn && this.turn === HUMAN && this.status === 'playing') {
      drawing.strokeStyle = '#f4c95d';
      drawing.lineWidth = 3;
      drawing.strokeRect(x + 3, y + 3, CELL - 6, CELL - 6);
    }
    const value = this.board[row][column];
    if (value === 0) return;
    drawing.beginPath();
    drawing.arc(x + CELL / 2, y + CELL / 2, CELL * 0.34, 0, Math.PI * 2);
    drawing.fillStyle = value === HUMAN ? '#d7fff1' : '#2b1f36';
    drawing.shadowColor = value === HUMAN ? '#79e2c0' : '#d59bdf';
    drawing.shadowBlur = 10;
    drawing.fill();
    drawing.shadowBlur = 0;
    drawing.strokeStyle = value === HUMAN ? '#79e2c0' : '#d59bdf';
    drawing.lineWidth = 2;
    drawing.stroke();
  }

  private pointerCell(event: PointerEvent): [number, number] | null {
    if (!this.canvas) return null;
    const bounds = this.canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return null;
    const logicalX = (event.clientX - bounds.left) * (LOGICAL_WIDTH / bounds.width);
    const logicalY = (event.clientY - bounds.top) * (LOGICAL_HEIGHT / bounds.height);
    const column = Math.floor((logicalX - BOARD_X) / CELL);
    const row = Math.floor((logicalY - BOARD_Y) / CELL);
    if (row < 0 || row >= SIZE || column < 0 || column >= SIZE) return null;
    return [row, column];
  }

  private handlePointerUp = (event: PointerEvent): void => {
    if (event.button !== 0 || this.paused) return;
    const cell = this.pointerCell(event);
    if (!cell) return;
    event.preventDefault();
    if (this.status === 'ready') this.start();
    if (this.status === 'playing' && this.turn === HUMAN) {
      this.cursorRow = cell[0];
      this.cursorColumn = cell[1];
      this.playHuman(cell[0], cell[1]);
    }
  };

  private preventContextMenu = (event: MouseEvent): void => { event.preventDefault(); };
}

export function createDiskReversal(): Game {
  return new DiskReversalGame();
}
