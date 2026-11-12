import type { Game, GameContext, GameMeta } from '../types';

const SIZE = 4;
const TILE_COUNT = SIZE * SIZE;
const BOARD_X = 32;
const BOARD_Y = 138;
const BOARD_SIZE = 416;
const CELL_GAP = 8;
const CELL_SIZE = (BOARD_SIZE - CELL_GAP * (SIZE + 1)) / SIZE;
const SHUFFLE_MOVES = 120;

const TILE_COLORS = [
  '#f4c95d',
  '#ee964b',
  '#e76f51',
  '#d1495b',
  '#a44253',
  '#6d597a',
  '#4d628d',
  '#4f8a8b',
  '#5c9ead',
  '#76a665',
  '#9b8c5b',
  '#c06c84',
  '#8f6d9f',
  '#5b7c99',
  '#467c68',
];

export const meta: GameMeta = {
  id: 'sliding-tiles',
  title: 'Sliding Tiles',
  description: 'Arrange the numbered tiles in order using the single open space.',
  controls: 'Use arrows or WASD to move an adjacent tile. Tap a tile to slide it.',
  accent: '#f4c95d',
  touchControls: { dpad: ['up', 'down', 'left', 'right'], buttons: ['action'], labels: {action: 'Start'}, gestures: false },
};

type Direction = 'up' | 'down' | 'left' | 'right';
type GamePhase = 'ready' | 'playing' | 'over';

function solvedBoard(): number[] {
  return Array.from({ length: TILE_COUNT }, (_, index) => (index + 1) % TILE_COUNT);
}

function opposite(direction: Direction): Direction {
  if (direction === 'up') return 'down';
  if (direction === 'down') return 'up';
  if (direction === 'left') return 'right';
  return 'left';
}

function neighbor(index: number, direction: Direction): number | null {
  const row = Math.floor(index / SIZE);
  const column = index % SIZE;
  if (direction === 'up' && row > 0) return index - SIZE;
  if (direction === 'down' && row < SIZE - 1) return index + SIZE;
  if (direction === 'left' && column > 0) return index - 1;
  if (direction === 'right' && column < SIZE - 1) return index + 1;
  return null;
}

export class SlidingTilesGame implements Game {
  readonly meta = meta;
  private canvas: HTMLCanvasElement | null = null;
  private context: GameContext | null = null;
  private board = solvedBoard();
  private blankIndex = TILE_COUNT - 1;
  private phase: GamePhase = 'ready';
  private paused = false;
  private moves = 0;
  private best = 0;
  private removePointerListeners: (() => void) | null = null;

  init(canvas: HTMLCanvasElement, context: GameContext): void {
    this.canvas = canvas;
    this.context = context;
    this.best = context.storage.getBestScore(meta.id);
    this.reset();
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.removePointerListeners = () => canvas.removeEventListener('pointerdown', this.handlePointerDown);
    context.setStatus('ready');
    this.render();
  }

  update(_dt: number): void {
    if (!this.context || this.paused) return;
    if ((this.phase === 'ready' || this.phase === 'over') && this.context.input.pressed('action')) this.start();
    if (this.phase !== 'playing') return;
    const directions: readonly Direction[] = ['up', 'down', 'left', 'right'];
    for (const direction of directions) {
      if (this.context.input.pressed(direction)) {
        this.moveByDirection(direction);
        break;
      }
    }
  }

  render(): void {
    const canvas = this.canvas;
    const drawing = canvas?.getContext('2d');
    if (!canvas || !drawing) return;

    const scaleX = canvas.width / 480;
    const scaleY = canvas.height / 640;
    drawing.save();
    drawing.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    drawing.clearRect(0, 0, 480, 640);
    drawing.fillStyle = '#111827';
    drawing.fillRect(0, 0, 480, 640);

    drawing.fillStyle = '#f4c95d';
    drawing.font = '700 26px monospace';
    drawing.textAlign = 'left';
    drawing.textBaseline = 'alphabetic';
    drawing.fillText('SLIDING TILES', 32, 48);
    drawing.fillStyle = '#aab6c8';
    drawing.font = '12px monospace';
    drawing.fillText('ORDER THE BOARD // ONE OPEN SPACE', 32, 73);
    drawing.fillStyle = '#e6edf5';
    drawing.font = '700 14px monospace';
    drawing.fillText(`MOVES ${String(this.moves).padStart(3, '0')}`, 32, 103);
    drawing.fillText(`BEST ${this.best > 0 ? this.best : '---'}`, 330, 103);

    drawing.fillStyle = '#26344a';
    drawing.beginPath();
    drawing.roundRect(BOARD_X, BOARD_Y, BOARD_SIZE, BOARD_SIZE, 16);
    drawing.fill();
    for (let index = 0; index < TILE_COUNT; index += 1) this.renderTile(drawing, index);

    drawing.textAlign = 'center';
    if (this.phase === 'ready') {
      drawing.fillStyle = '#f4c95d';
      drawing.font = '700 16px monospace';
      drawing.fillText('PRESS ACTION TO SHUFFLE', 240, 590);
      drawing.fillStyle = '#aab6c8';
      drawing.font = '12px monospace';
      drawing.fillText('ARROWS / WASD: MOVE TILE    TAP: MOVE TILE', 240, 615);
    } else if (this.phase === 'over') {
      drawing.fillStyle = '#8fe3cf';
      drawing.font = '700 18px monospace';
      drawing.fillText(`SOLVED IN ${this.moves} MOVES`, 240, 590);
      drawing.fillStyle = '#dbe7f4';
      drawing.font = '12px monospace';
      drawing.fillText('PRESS ACTION TO PLAY AGAIN', 240, 615);
    } else {
      drawing.fillStyle = '#aab6c8';
      drawing.font = '12px monospace';
      drawing.fillText('ARROWS / WASD: MOVE TILE    TAP: MOVE TILE', 240, 615);
    }
    drawing.restore();
  }

  destroy(): void {
    this.removePointerListeners?.();
    this.removePointerListeners = null;
    this.canvas = null;
    this.context = null;
  }

  pause(): void {
    if (this.paused || this.phase !== 'playing') return;
    this.paused = true;
    this.context?.setStatus('paused');
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    if (this.phase === 'playing') this.context?.setStatus('playing');
  }

  private reset(): void {
    this.board = solvedBoard();
    this.blankIndex = TILE_COUNT - 1;
    this.moves = 0;
    this.phase = 'ready';
    this.paused = false;
    this.context?.score.reset();
  }

  private start(): void {
    if (this.phase === 'over') this.reset();
    this.board = solvedBoard();
    this.blankIndex = TILE_COUNT - 1;
    this.moves = 0;
    this.phase = 'playing';
    this.context?.score.reset();
    this.shuffle();
    this.context?.setStatus('playing');
    this.context?.audio.tone(440, 80, 'triangle', 0.06);
    this.render();
  }

  private shuffle(): void {
    let previous: Direction | null = null;
    for (let count = 0; count < SHUFFLE_MOVES; count += 1) {
      const choices = (['up', 'down', 'left', 'right'] as const).filter(
        (direction) => direction !== (previous ? opposite(previous) : null) && neighbor(this.blankIndex, direction) !== null,
      );
      const direction = choices[Math.floor(Math.random() * choices.length)];
      this.swapWithBlank(direction);
      previous = direction;
    }
    if (this.isSolved()) this.shuffle();
  }

  private moveByDirection(direction: Direction): void {
    if (this.phase !== 'playing' || this.paused) return;
    const target = neighbor(this.blankIndex, direction);
    if (target === null) return;
    this.swapWithBlank(direction);
    this.moves += 1;
    this.context?.audio.tone(250 + this.moves % 8 * 22, 35, 'square', 0.035);
    this.context?.score.set(Math.max(0, 1000 - this.moves * 5));
    if (this.isSolved()) this.finish();
    this.render();
  }

  private swapWithBlank(direction: Direction): void {
    const target = neighbor(this.blankIndex, direction);
    if (target === null) return;
    [this.board[this.blankIndex], this.board[target]] = [this.board[target], this.board[this.blankIndex]];
    this.blankIndex = target;
  }

  private finish(): void {
    this.phase = 'over';
    const score = Math.max(0, 1000 - this.moves * 5);
    this.context?.score.set(score);
    if (score > this.best) {
      this.best = score;
      this.context?.storage.setBestScore(meta.id, score);
    }
    this.context?.setStatus('over');
    this.context?.audio.tone(880, 150, 'triangle', 0.08);
  }

  private isSolved(): boolean {
    return this.board.every((value, index) => value === (index + 1) % TILE_COUNT);
  }

  private renderTile(drawing: CanvasRenderingContext2D, index: number): void {
    const value = this.board[index];
    const column = index % SIZE;
    const row = Math.floor(index / SIZE);
    const x = BOARD_X + CELL_GAP + column * (CELL_SIZE + CELL_GAP);
    const y = BOARD_Y + CELL_GAP + row * (CELL_SIZE + CELL_GAP);
    if (value === 0) {
      drawing.fillStyle = '#1a2536';
      drawing.beginPath();
      drawing.roundRect(x, y, CELL_SIZE, CELL_SIZE, 10);
      drawing.fill();
      return;
    }
    drawing.fillStyle = TILE_COLORS[value - 1] ?? '#f4c95d';
    drawing.beginPath();
    drawing.roundRect(x, y, CELL_SIZE, CELL_SIZE, 10);
    drawing.fill();
    drawing.fillStyle = '#fffaf0';
    drawing.font = '700 30px monospace';
    drawing.textAlign = 'center';
    drawing.textBaseline = 'middle';
    drawing.fillText(String(value), x + CELL_SIZE / 2, y + CELL_SIZE / 2 + 1);
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (this.paused || !this.canvas) return;
    event.preventDefault();
    if (this.phase === 'ready' || this.phase === 'over') {
      this.start();
      return;
    }
    const index = this.pointerIndex(event);
    if (index === null) return;
    const blankRow = Math.floor(this.blankIndex / SIZE);
    const blankColumn = this.blankIndex % SIZE;
    const row = Math.floor(index / SIZE);
    const column = index % SIZE;
    if (Math.abs(row - blankRow) + Math.abs(column - blankColumn) !== 1) return;
    const direction: Direction = row < blankRow ? 'up' : row > blankRow ? 'down' : column < blankColumn ? 'left' : 'right';
    this.moveByDirection(direction);
  };

  private pointerIndex(event: PointerEvent): number | null {
    if (!this.canvas) return null;
    const bounds = this.canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return null;
    const logicalX = (event.clientX - bounds.left) * (this.canvas.width / bounds.width);
    const logicalY = (event.clientY - bounds.top) * (this.canvas.height / bounds.height);
    const column = Math.floor((logicalX - BOARD_X - CELL_GAP) / (CELL_SIZE + CELL_GAP));
    const row = Math.floor((logicalY - BOARD_Y - CELL_GAP) / (CELL_SIZE + CELL_GAP));
    if (row < 0 || row >= SIZE || column < 0 || column >= SIZE) return null;
    const cellX = logicalX - (BOARD_X + CELL_GAP + column * (CELL_SIZE + CELL_GAP));
    const cellY = logicalY - (BOARD_Y + CELL_GAP + row * (CELL_SIZE + CELL_GAP));
    if (cellX < 0 || cellX > CELL_SIZE || cellY < 0 || cellY > CELL_SIZE) return null;
    return row * SIZE + column;
  }
}

export function createSlidingTiles(): Game {
  return new SlidingTilesGame();
}
