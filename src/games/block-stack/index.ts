import type { Game, GameContext, GameMeta } from '../types';
import { clearLines, rotateMatrix } from './logic';

const WIDTH = 10;
const HEIGHT = 20;
const CELL = 28;
const BOARD_X = 48;
const BOARD_Y = 34;
const COLORS = ['#53e0c2', '#ffcb6b', '#ff6b8a', '#a98bff', '#65b7ff', '#ff9966', '#d7f171'];
const SHAPES: readonly (readonly (readonly number[])[])[] = [
  [[1, 1, 1, 1]],
  [[1, 1], [1, 1]],
  [[0, 1, 0], [1, 1, 1]],
  [[1, 0, 0], [1, 1, 1]],
  [[0, 0, 1], [1, 1, 1]],
  [[1, 1, 0], [0, 1, 1]],
  [[0, 1, 1], [1, 1, 0]],
];

function blankBoard(): number[][] {
  return Array.from({ length: HEIGHT }, () => Array<number>(WIDTH).fill(0));
}

function copyMatrix(matrix: readonly (readonly number[])[]): number[][] {
  return matrix.map((row) => [...row]);
}

export const meta: GameMeta = {
  id: 'block-stack',
  title: 'Block Stack',
  description: 'Fit falling shapes, clear lines, and keep the stack low.',
  controls: 'Rotate and guide each shape into place. Clear lines to build your score.',
  accent: '#53e0c2',
  touchControls: { dpad: ['left', 'right', 'down'], buttons: ['action', 'secondary', 'hold'], optionalButtons: ['hold'], labels: {action: 'Rotate', secondary: 'Hard drop', hold: 'Hold'}, gestures: true, hardDropOnFlick: true },
};

export class BlockStackGame implements Game {
  readonly meta = meta;
  private canvas: HTMLCanvasElement | null = null;
  private context: GameContext | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private board = blankBoard();
  private piece: number[][] | null = null;
  private pieceColor = 0;
  private nextShapeIndex = 0;
  private heldShapeIndex: number | null = null;
  private holdUsed = false;
  private rngState = 1;
  private pieceX = 0;
  private pieceY = 0;
  private dropTimer = 0;
  private lockTimer = 0;
  private lockResets = 0;
  private lines = 0;
  private started = false;

  init(canvas: HTMLCanvasElement, context: GameContext): void {
    this.canvas = canvas;
    this.context = context;
    this.ctx = canvas.getContext('2d');
    this.reset();
    context.setStatus('ready');
  }

  update(dt: number): void {
    const input = this.context?.input;
    if (!input) return;
    if (!this.started) {
      if (input.pressed('action')) {
        this.started = true;
        this.context?.setStatus('playing');
        this.spawn();
        this.context?.audio.tone(440, 70, 'square', 0.05);
      }
      return;
    }
    if (input.pressed('left')) this.move(-1);
    if (input.pressed('right')) this.move(1);
    if (input.pressed('action')) this.rotate();
    if (input.pressed('secondary')) this.hardDrop();
    if (input.pressed('hold') && this.context?.storage.getBoolean('touch:hold-piece', false)) this.holdPiece();

    this.dropTimer += dt * (input.down('down') ? 8 : 1);
    const interval = Math.max(0.08, 0.65 - (this.level - 1) * 0.05);
    while (this.dropTimer >= interval) {
      this.dropTimer -= interval;
      if (!this.stepDown()) break;
    }
    if (this.piece && this.collides(this.piece, this.pieceX, this.pieceY + 1)) {
      this.lockTimer += dt;
      if (this.lockTimer >= 0.4) this.lockPiece();
    } else {
      this.lockTimer = 0;
    }
  }

  render(): void {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#100d20';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.drawBoard(ctx);
    this.drawGhost(ctx);
    this.drawPiece(ctx);
    ctx.fillStyle = '#302747';
    ctx.font = '700 14px monospace';
    ctx.fillText('LINES', 358, 76);
    ctx.fillStyle = '#f7f1ff';
    ctx.font = '700 28px monospace';
    ctx.fillText(String(this.lines).padStart(2, '0'), 358, 108);
    ctx.fillStyle = '#302747';
    ctx.font = '700 14px monospace';
    ctx.fillText('LEVEL', 358, 156);
    ctx.fillStyle = '#f7f1ff';
    ctx.font = '700 28px monospace';
    ctx.fillText(String(this.level), 358, 188);
    ctx.fillStyle = '#6d6085';
    ctx.font = '12px monospace';
    ctx.fillText('← → MOVE', 358, 254);
    ctx.fillText('A ROTATE', 358, 274);
    ctx.fillText('B DROP', 358, 294);
    this.drawPreview(ctx, 'NEXT', this.nextShapeIndex, 358, 360);
    if (this.context?.storage.getBoolean('touch:hold-piece', false)) {
      this.drawPreview(ctx, 'HOLD', this.heldShapeIndex, 358, 478);
      ctx.fillStyle = this.holdUsed ? '#514361' : '#6d6085';
      ctx.font = '11px monospace';
      ctx.fillText('C / H', 358, 548);
    }
  }

  pause(): void {}
  resume(): void {}

  destroy(): void {
    this.canvas = null;
    this.context = null;
    this.ctx = null;
    this.piece = null;
  }

  getDebugState(): Record<string, unknown> {
    return {
      pieceX: this.pieceX,
      pieceY: this.pieceY,
      piece: this.piece?.map((row) => [...row]) ?? null,
      ghostY: this.ghostY(),
      nextShapeIndex: this.nextShapeIndex,
      heldShapeIndex: this.heldShapeIndex,
      holdUsed: this.holdUsed,
      lines: this.lines,
      board: this.board.map((row) => [...row]),
    };
  }

  setSeed(seed: number): void {
    this.rngState = seed >>> 0 || 1;
    this.nextShapeIndex = this.randomIndex();
  }

  private get level(): number {
    return Math.floor(this.lines / 10) + 1;
  }

  private reset(): void {
    this.board = blankBoard();
    this.piece = null;
    this.pieceX = 0;
    this.pieceY = 0;
    this.pieceColor = 0;
    this.nextShapeIndex = this.randomIndex();
    this.heldShapeIndex = null;
    this.holdUsed = false;
    this.dropTimer = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.lines = 0;
    this.started = false;
  }

  private spawn(): void {
    const index = this.nextShapeIndex;
    this.nextShapeIndex = this.randomIndex();
    this.pieceColor = index;
    this.piece = copyMatrix(SHAPES[index]);
    this.pieceX = Math.floor((WIDTH - this.piece[0].length) / 2);
    this.pieceY = 0;
    this.dropTimer = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.holdUsed = false;
    if (this.collides(this.piece, this.pieceX, this.pieceY)) {
      this.context?.setStatus('over');
      this.context?.audio.tone(110, 240, 'sawtooth', 0.06);
      this.piece = null;
    }
  }

  private collides(piece: readonly (readonly number[])[], x: number, y: number): boolean {
    return piece.some((row, rowIndex) => row.some((cell, columnIndex) => {
      if (!cell) return false;
      const boardX = x + columnIndex;
      const boardY = y + rowIndex;
      return boardX < 0 || boardX >= WIDTH || boardY >= HEIGHT || (boardY >= 0 && this.board[boardY][boardX] !== 0);
    }));
  }

  private move(direction: number): void {
    if (!this.piece) return;
    if (!this.collides(this.piece, this.pieceX + direction, this.pieceY)) {
      this.pieceX += direction;
      this.resetLockDelay();
      this.context?.audio.tone(250, 25, 'square', 0.025);
    }
  }

  private rotate(): void {
    if (!this.piece) return;
    const rotated = rotateMatrix(this.piece);
    for (const offset of [0, -1, 1, -2, 2]) {
      if (!this.collides(rotated, this.pieceX + offset, this.pieceY)) {
        this.piece = rotated;
        this.pieceX += offset;
        this.resetLockDelay();
        this.context?.audio.tone(520, 55, 'square', 0.04);
        return;
      }
    }
  }

  private stepDown(): boolean {
    if (!this.piece) return false;
    if (!this.collides(this.piece, this.pieceX, this.pieceY + 1)) {
      this.pieceY += 1;
      this.lockTimer = 0;
      return true;
    }
    return false;
  }

  private hardDrop(): void {
    if (!this.piece) return;
    let distance = 0;
    while (!this.collides(this.piece, this.pieceX, this.pieceY + 1)) {
      this.pieceY += 1;
      distance += 1;
    }
    if (distance > 0) this.context?.audio.tone(180, 45, 'square', 0.04);
    this.lockPiece();
  }

  private holdPiece(): void {
    if (!this.piece || this.holdUsed) return;
    const current = this.pieceColor;
    if (this.heldShapeIndex === null) {
      this.heldShapeIndex = current;
      this.spawn();
    } else {
      const replacement = this.heldShapeIndex;
      this.heldShapeIndex = current;
      this.pieceColor = replacement;
      this.piece = copyMatrix(SHAPES[replacement]);
      this.pieceX = Math.floor((WIDTH - this.piece[0].length) / 2);
      this.pieceY = 0;
      this.dropTimer = 0;
      this.lockTimer = 0;
      this.lockResets = 0;
      this.holdUsed = false;
    }
    this.holdUsed = true;
  }

  private resetLockDelay(): void {
    if (this.lockResets >= 15) return;
    this.lockTimer = 0;
    this.lockResets += 1;
  }

  private ghostY(): number {
    if (!this.piece) return this.pieceY;
    let y = this.pieceY;
    while (!this.collides(this.piece, this.pieceX, y + 1)) y += 1;
    return y;
  }

  private drawGhost(ctx: CanvasRenderingContext2D): void {
    if (!this.piece) return;
    const y = this.ghostY();
    if (y <= this.pieceY) return;
    this.piece.forEach((row, rowIndex) => row.forEach((cell, columnIndex) => {
      if (!cell) return;
      const x = BOARD_X + (this.pieceX + columnIndex) * CELL;
      const py = BOARD_Y + (y + rowIndex) * CELL;
      ctx.strokeStyle = `${COLORS[this.pieceColor]}88`;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 4, py + 4, CELL - 8, CELL - 8);
    }));
  }

  private drawPreview(ctx: CanvasRenderingContext2D, label: string, index: number | null, x: number, y: number): void {
    ctx.fillStyle = '#6d6085';
    ctx.font = '700 12px monospace';
    ctx.fillText(label, x, y);
    if (index === null) return;
    const shape = SHAPES[index];
    const cell = 15;
    const left = x + (92 - shape[0].length * cell) / 2;
    const top = y + 12;
    shape.forEach((row, rowIndex) => row.forEach((occupied, columnIndex) => {
      if (!occupied) return;
      ctx.fillStyle = COLORS[index];
      ctx.fillRect(left + columnIndex * cell + 1, top + rowIndex * cell + 1, cell - 3, cell - 3);
    }));
  }

  private randomIndex(): number {
    let value = this.rngState;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.rngState = value >>> 0 || 1;
    return this.rngState % SHAPES.length;
  }

  private lockPiece(): void {
    if (!this.piece) return;
    this.piece.forEach((row, rowIndex) => row.forEach((cell, columnIndex) => {
      const boardY = this.pieceY + rowIndex;
      const boardX = this.pieceX + columnIndex;
      if (cell && boardY >= 0 && boardY < HEIGHT && boardX >= 0 && boardX < WIDTH) this.board[boardY][boardX] = this.pieceColor + 1;
    }));
    const result = clearLines(this.board);
    this.board = result.board;
    if (result.cleared > 0) {
      this.lines += result.cleared;
      this.context?.score.add(100 * result.cleared * result.cleared);
      this.context?.audio.tone(760 + result.cleared * 70, 100, 'triangle', 0.06);
    } else {
      this.context?.audio.tone(320, 35, 'square', 0.03);
    }
    this.piece = null;
    this.spawn();
  }

  private drawBoard(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = '#211b36';
    ctx.lineWidth = 1;
    for (let x = 0; x <= WIDTH; x += 1) {
      ctx.beginPath();
      ctx.moveTo(BOARD_X + x * CELL, BOARD_Y);
      ctx.lineTo(BOARD_X + x * CELL, BOARD_Y + HEIGHT * CELL);
      ctx.stroke();
    }
    for (let y = 0; y <= HEIGHT; y += 1) {
      ctx.beginPath();
      ctx.moveTo(BOARD_X, BOARD_Y + y * CELL);
      ctx.lineTo(BOARD_X + WIDTH * CELL, BOARD_Y + y * CELL);
      ctx.stroke();
    }
    this.board.forEach((row, y) => row.forEach((cell, x) => {
      if (cell) this.drawCell(ctx, x, y, COLORS[cell - 1]);
    }));
  }

  private drawPiece(ctx: CanvasRenderingContext2D): void {
    if (!this.piece) return;
    this.piece.forEach((row, y) => row.forEach((cell, x) => {
      if (cell) this.drawCell(ctx, this.pieceX + x, this.pieceY + y, COLORS[this.pieceColor]);
    }));
  }

  private drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
    const px = BOARD_X + x * CELL;
    const py = BOARD_Y + y * CELL;
    ctx.fillStyle = color;
    ctx.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(px + 4, py + 4, CELL - 8, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(px + 4, py + CELL - 7, CELL - 8, 3);
  }
}

export function createBlockStack(): Game {
  return new BlockStackGame();
}
