import type { Game, GameContext, GameMeta } from '../types';

const GRID_SIZE = 24;
const LOGICAL_WIDTH = 480;
const LOGICAL_HEIGHT = 640;
const CELL = 16;
const BOARD_X = 48;
const BOARD_Y = 146;
const BOARD_SIZE = GRID_SIZE * CELL;
const STEP_MS = 180;
const MAX_GENERATIONS = 5000;
const MAX_STEPS_PER_UPDATE = 4;

type Cell = { row: number; column: number };
type Status = 'ready' | 'playing' | 'paused' | 'over';

export const meta: GameMeta = {
  id: 'life-grid',
  title: 'Life Grid',
  description: 'Build a living pattern and watch simple rules make complex motion.',
  controls: 'Arrows move the cursor. Action starts or pauses. Secondary advances one generation.',
  accent: '#8effbd',
};

export class LifeGridGame implements Game {
  readonly meta = meta;
  private canvas: HTMLCanvasElement | null = null;
  private context: GameContext | null = null;
  private board = this.emptyBoard();
  private nextBoard = this.emptyBoard();
  private cursorRow = 12;
  private cursorColumn = 12;
  private status: Status = 'ready';
  private accumulator = 0;
  private generations = 0;
  private population = 0;
  private previousSignature = '';
  private removeListeners: (() => void) | null = null;

  init(canvas: HTMLCanvasElement, context: GameContext): void {
    this.canvas = canvas;
    this.context = context;
    this.reset();
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('contextmenu', this.preventContextMenu);
    this.removeListeners = () => {
      canvas.removeEventListener('pointerup', this.handlePointerUp);
      canvas.removeEventListener('contextmenu', this.preventContextMenu);
    };
    context.setStatus('ready');
  }

  update(dt: number): void {
    if (!this.context) return;
    const { input } = this.context;
    if (input.pressed('up')) this.cursorRow = Math.max(0, this.cursorRow - 1);
    if (input.pressed('down')) this.cursorRow = Math.min(GRID_SIZE - 1, this.cursorRow + 1);
    if (input.pressed('left')) this.cursorColumn = Math.max(0, this.cursorColumn - 1);
    if (input.pressed('right')) this.cursorColumn = Math.min(GRID_SIZE - 1, this.cursorColumn + 1);
    if (input.pressed('action')) {
      if (this.status === 'ready') this.startSeeded();
      else if (this.status === 'playing') this.pause();
      else if (this.status === 'over') this.startSeeded();
      else this.resume();
    }
    if (input.pressed('secondary')) {
      if (this.status === 'ready') this.startSeeded();
      this.stepOnce();
      if (this.status === 'playing') this.pause();
    }
    if (this.status !== 'playing') return;
    this.accumulator += Math.min(Math.max(dt, 0), 0.25) * 1000;
    let steps = 0;
    while (this.accumulator >= STEP_MS && steps < MAX_STEPS_PER_UPDATE && this.status === 'playing') {
      this.accumulator -= STEP_MS;
      this.stepOnce();
      steps += 1;
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
    drawing.fillStyle = '#07131a';
    drawing.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    drawing.fillStyle = '#8effbd';
    drawing.font = '700 25px monospace';
    drawing.fillText('LIFE // GRID', 40, 50);
    drawing.fillStyle = '#77949c';
    drawing.font = '12px monospace';
    drawing.fillText('CELLULAR SANDBOX / B3-S4', 40, 75);
    drawing.fillText('GEN', 350, 38);
    drawing.fillText('POP', 410, 38);
    drawing.fillStyle = '#f2fff7';
    drawing.font = '700 16px monospace';
    drawing.fillText(String(this.generations).padStart(4, '0'), 350, 60);
    drawing.fillText(String(this.population).padStart(4, '0'), 410, 60);
    drawing.fillStyle = '#77949c';
    drawing.font = '11px monospace';
    drawing.fillText(`BEST ${String(this.context?.score.best() ?? 0).padStart(5, '0')}`, 350, 78);

    drawing.fillStyle = '#0c2027';
    drawing.fillRect(BOARD_X - 8, BOARD_Y - 8, BOARD_SIZE + 16, BOARD_SIZE + 16);
    drawing.strokeStyle = '#21434a';
    drawing.lineWidth = 2;
    drawing.strokeRect(BOARD_X - 8, BOARD_Y - 8, BOARD_SIZE + 16, BOARD_SIZE + 16);
    for (let row = 0; row < GRID_SIZE; row += 1) {
      for (let column = 0; column < GRID_SIZE; column += 1) this.renderCell(drawing, row, column);
    }

    drawing.fillStyle = '#77949c';
    drawing.font = '11px monospace';
    drawing.fillText('ARROWS: MOVE    SPACE: RUN / PAUSE    X: STEP', 40, 574);
    drawing.fillText('TAP CELLS TO EDIT    LIVE CELLS FOLLOW  B3 / S23', 40, 595);
    drawing.fillText('BEST SCORE IS SHARED ACROSS GAMES', 40, 616);
    drawing.font = '700 14px monospace';
    if (this.status === 'ready') {
      drawing.fillStyle = '#fff36b';
      drawing.fillText('PRESS ACTION TO SEED AND RUN', 40, 112);
    } else if (this.status === 'paused') {
      drawing.fillStyle = '#fff36b';
      drawing.fillText('PAUSED // ACTION RESUMES', 40, 112);
    } else if (this.status === 'over') {
      drawing.fillStyle = this.population === 0 ? '#ff8290' : '#8effbd';
      drawing.fillText(this.population === 0 ? 'EXTINCT // ACTION TO RESTART' : 'STABLE // ACTION TO RESTART', 40, 112);
    } else {
      drawing.fillStyle = '#8effbd';
      drawing.fillText('RUNNING', 40, 112);
    }
    drawing.restore();
  }

  pause(): void {
    if (this.status !== 'playing') return;
    this.status = 'paused';
    this.context?.setStatus('paused');
  }

  resume(): void {
    if (this.status === 'paused') {
      this.status = 'playing';
      this.context?.setStatus('playing');
      this.context?.audio.tone(520, 45, 'triangle', 0.04);
    }
  }

  destroy(): void {
    this.removeListeners?.();
    this.removeListeners = null;
    this.canvas = null;
    this.context = null;
  }

  private reset(): void {
    this.board = this.emptyBoard();
    this.nextBoard = this.emptyBoard();
    this.cursorRow = 12;
    this.cursorColumn = 12;
    this.status = 'ready';
    this.accumulator = 0;
    this.generations = 0;
    this.population = 0;
    this.previousSignature = '';
    this.context?.score.reset();
  }

  private startSeeded(): void {
    this.board = this.emptyBoard();
    const center = 12;
    const pattern: ReadonlyArray<readonly [number, number]> = [
      [-1, 0], [0, 1], [1, -1], [1, 0], [1, 1],
      [-5, -5], [-5, -4], [-4, -5], [-4, -4],
    ];
    for (const [rowOffset, columnOffset] of pattern) this.board[center + rowOffset][center + columnOffset] = true;
    this.generations = 0;
    this.population = this.countPopulation(this.board);
    this.previousSignature = this.signature(this.board);
    this.accumulator = 0;
    this.status = 'playing';
    this.context?.score.reset();
    this.context?.setStatus('playing');
    this.context?.audio.tone(440, 90, 'triangle', 0.06);
  }

  private stepOnce(): void {
    if (this.status === 'ready') this.startSeeded();
    if (this.status === 'over') return;
    const before = this.signature(this.board);
    this.nextBoard = this.emptyBoard();
    for (let row = 0; row < GRID_SIZE; row += 1) {
      for (let column = 0; column < GRID_SIZE; column += 1) {
        const neighbors = this.neighborCount(this.board, row, column);
        this.nextBoard[row][column] = this.board[row][column] ? neighbors === 2 || neighbors === 3 : neighbors === 3;
      }
    }
    const oldBoard = this.board;
    this.board = this.nextBoard;
    this.nextBoard = oldBoard;
    this.generations += 1;
    this.population = this.countPopulation(this.board);
    const score = this.generations * 10 + this.population;
    this.context?.score.set(Math.max(this.context.score.current(), score));
    this.context?.audio.tone(180 + Math.min(this.population, 80) * 4, 28, 'sine', 0.025);
    const current = this.signature(this.board);
    const stable = current === before || current === this.previousSignature;
    this.previousSignature = current;
    if (this.population === 0 || stable || this.generations >= MAX_GENERATIONS) this.finish(stable && this.population > 0);
  }

  private finish(stable: boolean): void {
    this.status = 'over';
    this.accumulator = 0;
    this.context?.setStatus('over');
    this.context?.audio.tone(stable ? 660 : 110, stable ? 120 : 180, stable ? 'triangle' : 'sawtooth', 0.06);
  }

  private toggleCell(row: number, column: number): void {
    if (this.status === 'over') return;
    this.board[row][column] = !this.board[row][column];
    this.population = this.countPopulation(this.board);
    this.previousSignature = this.signature(this.board);
    this.context?.score.set(this.generations * 10 + this.population);
    this.context?.audio.tone(this.board[row][column] ? 620 : 260, 35, 'square', 0.04);
  }

  private neighborCount(board: boolean[][], row: number, column: number): number {
    let count = 0;
    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
        if (rowOffset === 0 && columnOffset === 0) continue;
        const neighborRow = row + rowOffset;
        const neighborColumn = column + columnOffset;
        if (neighborRow >= 0 && neighborRow < GRID_SIZE && neighborColumn >= 0 && neighborColumn < GRID_SIZE && board[neighborRow][neighborColumn]) count += 1;
      }
    }
    return count;
  }

  private countPopulation(board: boolean[][]): number {
    return board.reduce((total, row) => total + row.filter(Boolean).length, 0);
  }

  private signature(board: boolean[][]): string {
    return board.map((row) => row.map((cell) => (cell ? '1' : '0')).join('')).join('');
  }

  private emptyBoard(): boolean[][] {
    return Array.from({ length: GRID_SIZE }, () => Array<boolean>(GRID_SIZE).fill(false));
  }

  private renderCell(drawing: CanvasRenderingContext2D, row: number, column: number): void {
    const x = BOARD_X + column * CELL;
    const y = BOARD_Y + row * CELL;
    const alive = this.board[row][column];
    const selected = row === this.cursorRow && column === this.cursorColumn;
    drawing.fillStyle = alive ? '#8effbd' : (row + column) % 2 === 0 ? '#0d252b' : '#0b2026';
    drawing.fillRect(x, y, CELL - 1, CELL - 1);
    if (alive) {
      drawing.fillStyle = '#d8ffe6';
      drawing.fillRect(x + 4, y + 3, 4, 3);
      drawing.fillStyle = '#50bf83';
      drawing.fillRect(x + 3, y + 9, 10, 3);
    }
    drawing.strokeStyle = selected ? '#fff36b' : alive ? '#b8ffd0' : '#173b41';
    drawing.lineWidth = selected ? 2 : 1;
    drawing.strokeRect(x + 1, y + 1, CELL - 3, CELL - 3);
  }

  private pointerCell(event: PointerEvent): Cell | null {
    if (!this.canvas) return null;
    const bounds = this.canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return null;
    const logicalX = (event.clientX - bounds.left) * (LOGICAL_WIDTH / bounds.width);
    const logicalY = (event.clientY - bounds.top) * (LOGICAL_HEIGHT / bounds.height);
    const column = Math.floor((logicalX - BOARD_X) / CELL);
    const row = Math.floor((logicalY - BOARD_Y) / CELL);
    if (row < 0 || row >= GRID_SIZE || column < 0 || column >= GRID_SIZE) return null;
    return { row, column };
  }

  private handlePointerUp = (event: PointerEvent): void => {
    if (event.button !== 0 || this.status === 'over') return;
    const cell = this.pointerCell(event);
    if (!cell) return;
    event.preventDefault();
    this.cursorRow = cell.row;
    this.cursorColumn = cell.column;
    this.toggleCell(cell.row, cell.column);
  };

  private preventContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };
}

export function createLifeGrid(): Game {
  return new LifeGridGame();
}
