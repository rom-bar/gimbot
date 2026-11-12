import type { Game, GameContext, GameMeta } from '../types';

const SIZE = 5;
const LOGICAL_WIDTH = 480;
const LOGICAL_HEIGHT = 640;
const BOARD_X = 40;
const BOARD_Y = 155;
const CELL = 80;
const BOARD_SIZE = SIZE * CELL;
const SCRAMBLE_MIN = 12;
const SCRAMBLE_MAX = 24;

type Cell = { row: number; column: number };

export const meta: GameMeta = {
  id: 'lights-out',
  title: 'Lights Out',
  description: 'Turn every light off with the fewest moves.',
  controls: 'Arrows move the highlight. Action toggles a cell and its neighbors.',
  accent: '#75f6ff',
  touchControls: { dpad: ['up', 'down', 'left', 'right'], buttons: ['action'], labels: {action: 'Toggle'}, gestures: false },
};

export class LightsOutGame implements Game {
  readonly meta = meta;
  private canvas: HTMLCanvasElement | null = null;
  private context: GameContext | null = null;
  private board = this.emptyBoard();
  private cursorRow = 2;
  private cursorColumn = 2;
  private moves = 0;
  private status: 'ready' | 'playing' | 'over' = 'ready';
  private paused = false;
  private finishToneTimer: number | null = null;
  private removePointerListener: (() => void) | null = null;

  init(canvas: HTMLCanvasElement, context: GameContext): void {
    this.canvas = canvas;
    this.context = context;
    this.board = this.emptyBoard();
    this.cursorRow = 2;
    this.cursorColumn = 2;
    this.moves = 0;
    this.status = 'ready';
    this.paused = false;
    context.setStatus('ready');
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('contextmenu', this.preventContextMenu);
    this.removePointerListener = () => {
      canvas.removeEventListener('pointerup', this.handlePointerUp);
      canvas.removeEventListener('contextmenu', this.preventContextMenu);
    };
  }

  update(_dt: number): void {
    if (!this.context || this.paused || this.status === 'over') return;
    const { input } = this.context;
    if (input.pressed('up')) this.cursorRow = Math.max(0, this.cursorRow - 1);
    if (input.pressed('down')) this.cursorRow = Math.min(SIZE - 1, this.cursorRow + 1);
    if (input.pressed('left')) this.cursorColumn = Math.max(0, this.cursorColumn - 1);
    if (input.pressed('right')) this.cursorColumn = Math.min(SIZE - 1, this.cursorColumn + 1);
    if (input.pressed('action')) {
      if (this.status === 'ready') this.start();
      else this.toggle(this.cursorRow, this.cursorColumn);
    }
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
    drawing.fillStyle = '#070b1c';
    drawing.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    drawing.fillStyle = '#75f6ff';
    drawing.font = '700 25px monospace';
    drawing.fillText('LIGHTS // OUT', 40, 54);
    drawing.fillStyle = '#8791b7';
    drawing.font = '12px monospace';
    drawing.fillText('5×5 NEON PUZZLE', 40, 78);
    drawing.fillStyle = '#8791b7';
    drawing.fillText('MOVES', 350, 42);
    drawing.fillStyle = '#f6fbff';
    drawing.font = '700 22px monospace';
    drawing.fillText(String(this.moves).padStart(3, '0'), 350, 67);
    drawing.fillStyle = '#8791b7';
    drawing.font = '12px monospace';
    drawing.fillText('HIGH', 410, 42);
    drawing.fillStyle = '#f6fbff';
    drawing.font = '700 18px monospace';
    drawing.fillText(String(this.context?.score.best() ?? 0).padStart(4, '0'), 410, 67);

    drawing.fillStyle = '#111936';
    drawing.fillRect(BOARD_X - 10, BOARD_Y - 10, BOARD_SIZE + 20, BOARD_SIZE + 20);
    drawing.strokeStyle = '#273666';
    drawing.lineWidth = 2;
    drawing.strokeRect(BOARD_X - 10, BOARD_Y - 10, BOARD_SIZE + 20, BOARD_SIZE + 20);

    for (let row = 0; row < SIZE; row += 1) {
      for (let column = 0; column < SIZE; column += 1) this.renderCell(drawing, row, column);
    }

    drawing.fillStyle = '#8791b7';
    drawing.font = '12px monospace';
    drawing.fillText('ARROWS: MOVE    SPACE: TOGGLE', 40, 592);
    drawing.fillText('TAP A CELL TO TOGGLE', 40, 614);
    if (this.status === 'ready') {
      drawing.fillStyle = '#fff36b';
      drawing.font = '700 14px monospace';
      drawing.fillText('PRESS ACTION TO BEGIN', 40, 118);
    } else if (this.status === 'over') {
      drawing.fillStyle = '#8effbd';
      drawing.font = '700 16px monospace';
      drawing.fillText(`ALL DARK // ${this.moves} MOVES`, 40, 118);
    } else if (this.paused) {
      drawing.fillStyle = '#fff36b';
      drawing.font = '700 14px monospace';
      drawing.fillText('PAUSED', 40, 118);
    }
    drawing.restore();
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
    if (this.finishToneTimer !== null) window.clearTimeout(this.finishToneTimer);
    this.finishToneTimer = null;
    this.removePointerListener?.();
    this.removePointerListener = null;
    this.canvas = null;
    this.context = null;
  }

  private start(): void {
    if (this.finishToneTimer !== null) window.clearTimeout(this.finishToneTimer);
    this.finishToneTimer = null;
    this.board = this.emptyBoard();
    this.moves = 0;
    this.cursorRow = 2;
    this.cursorColumn = 2;
    this.status = 'playing';
    this.paused = false;
    this.context?.score.reset();
    this.scramble();
    this.context?.setStatus('playing');
    this.context?.audio.tone(440, 80, 'triangle', 0.06);
  }

  private toggle(row: number, column: number): void {
    if (this.status !== 'playing' || this.paused) return;
    this.flip(row, column);
    this.moves += 1;
    this.context?.score.set(Math.max(0, 1000 - this.moves));
    this.context?.audio.tone(this.board[row][column] ? 620 : 300, 55, 'sine', 0.05);
    if (this.isClear()) this.finish();
  }

  private flip(row: number, column: number): void {
    const offsets = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]] as const;
    for (const [rowOffset, columnOffset] of offsets) {
      const nextRow = row + rowOffset;
      const nextColumn = column + columnOffset;
      if (nextRow >= 0 && nextRow < SIZE && nextColumn >= 0 && nextColumn < SIZE) {
        this.board[nextRow][nextColumn] = !this.board[nextRow][nextColumn];
      }
    }
  }

  private scramble(): void {
    const count = SCRAMBLE_MIN + Math.floor(Math.random() * (SCRAMBLE_MAX - SCRAMBLE_MIN + 1));
    let previous = -1;
    for (let index = 0; index < count; index += 1) {
      let choice = Math.floor(Math.random() * (SIZE * SIZE));
      if (SIZE * SIZE > 1 && choice === previous) choice = (choice + 1 + Math.floor(Math.random() * (SIZE * SIZE - 1))) % (SIZE * SIZE);
      previous = choice;
      this.flip(Math.floor(choice / SIZE), choice % SIZE);
    }
    if (this.isClear()) this.flip(2, 2);
  }

  private finish(): void {
    this.status = 'over';
    this.paused = false;
    this.context?.setStatus('over');
    this.context?.audio.tone(880, 120, 'triangle', 0.07);
    this.finishToneTimer = window.setTimeout(() => {
      this.finishToneTimer = null;
      this.context?.audio.tone(1175, 160, 'triangle', 0.06);
    }, 90);
  }

  private isClear(): boolean {
    return this.board.every((row) => row.every((cell) => !cell));
  }

  private emptyBoard(): boolean[][] {
    return Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false));
  }

  private renderCell(drawing: CanvasRenderingContext2D, row: number, column: number): void {
    const x = BOARD_X + column * CELL;
    const y = BOARD_Y + row * CELL;
    const lit = this.board[row][column];
    const selected = row === this.cursorRow && column === this.cursorColumn;
    drawing.save();
    if (lit) {
      drawing.shadowColor = '#75f6ff';
      drawing.shadowBlur = 22;
      drawing.fillStyle = '#75f6ff';
      drawing.fillRect(x + 10, y + 10, CELL - 20, CELL - 20);
      drawing.shadowBlur = 0;
      drawing.fillStyle = 'rgba(255,255,255,0.42)';
      drawing.fillRect(x + 18, y + 18, CELL - 36, 8);
    } else {
      drawing.fillStyle = '#182245';
      drawing.fillRect(x + 8, y + 8, CELL - 16, CELL - 16);
      drawing.strokeStyle = '#2e4074';
      drawing.lineWidth = 2;
      drawing.strokeRect(x + 8, y + 8, CELL - 16, CELL - 16);
    }
    drawing.strokeStyle = selected ? '#fff36b' : lit ? '#b7ffff' : '#314579';
    drawing.lineWidth = selected ? 4 : 2;
    drawing.strokeRect(x + 3, y + 3, CELL - 6, CELL - 6);
    drawing.restore();
  }

  private pointerCell(event: PointerEvent): Cell | null {
    if (!this.canvas) return null;
    const bounds = this.canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return null;
    const logicalX = (event.clientX - bounds.left) * (LOGICAL_WIDTH / bounds.width);
    const logicalY = (event.clientY - bounds.top) * (LOGICAL_HEIGHT / bounds.height);
    const column = Math.floor((logicalX - BOARD_X) / CELL);
    const row = Math.floor((logicalY - BOARD_Y) / CELL);
    if (row < 0 || row >= SIZE || column < 0 || column >= SIZE) return null;
    return { row, column };
  }

  private handlePointerUp = (event: PointerEvent): void => {
    if (event.button !== 0 || this.paused || this.status !== 'playing') return;
    const cell = this.pointerCell(event);
    if (!cell) return;
    event.preventDefault();
    this.cursorRow = cell.row;
    this.cursorColumn = cell.column;
    this.toggle(cell.row, cell.column);
  };

  private preventContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };
}

export function createLightsOut(): Game {
  return new LightsOutGame();
}
