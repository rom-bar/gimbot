import type { Game, GameContext, GameMeta } from '../types';

export const meta: GameMeta = {
  id: 'memory-match',
  title: 'Memory Match',
  description: 'Find every pair and keep the pattern in mind.',
  controls: 'Arrows move the cursor. Action or tap flips a card.',
  accent: '#76f7ff',
  touchControls: { dpad: ['up', 'down', 'left', 'right'], buttons: ['action'], labels: {action: 'Flip'}, gestures: false },
};

const WIDTH = 480;
const HEIGHT = 640;
const GRID = 4;
const CARD_SIZE = 82;
const CARD_GAP = 12;
const BOARD_X = (WIDTH - (GRID * CARD_SIZE + (GRID - 1) * CARD_GAP)) / 2;
const BOARD_Y = 146;
const HIDE_DELAY_MS = 720;
const VALUES = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7];

function shuffledCards(): number[] {
  const cards = [...VALUES];
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [cards[index], cards[swap]] = [cards[swap], cards[index]];
  }
  return cards;
}

export class MemoryMatchGame implements Game {
  readonly meta = meta;
  private canvas: HTMLCanvasElement | null = null;
  private context: GameContext | null = null;
  private cards = shuffledCards();
  private revealed = Array<boolean>(VALUES.length).fill(false);
  private matched = Array<boolean>(VALUES.length).fill(false);
  private firstCard: number | null = null;
  private secondCard: number | null = null;
  private cursor = 0;
  private status: 'ready' | 'playing' | 'over' = 'ready';
  private paused = false;
  private hideTimer: number | null = null;
  private hidePending = false;
  private generation = 0;
  private removePointerListeners: (() => void) | null = null;

  init(canvas: HTMLCanvasElement, context: GameContext): void {
    this.canvas = canvas;
    this.context = context;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('contextmenu', this.onContextMenu);
    this.removePointerListeners = () => {
      canvas.removeEventListener('pointerdown', this.onPointerDown);
      canvas.removeEventListener('contextmenu', this.onContextMenu);
    };
    this.render();
  }

  update(_dt: number): void {
    if (!this.context || this.paused || this.status === 'over') return;
    if (this.context.input.pressed('up')) this.cursor = Math.max(0, this.cursor - GRID);
    if (this.context.input.pressed('down')) this.cursor = Math.min(VALUES.length - 1, this.cursor + GRID);
    if (this.context.input.pressed('left')) this.cursor = this.cursor % GRID === 0 ? this.cursor : this.cursor - 1;
    if (this.context.input.pressed('right')) this.cursor = this.cursor % GRID === GRID - 1 ? this.cursor : this.cursor + 1;
    if (this.context.input.pressed('action')) this.flip(this.cursor);
  }

  render(): void {
    const canvas = this.canvas;
    const drawing = canvas?.getContext('2d');
    if (!canvas || !drawing) return;
    const scaleX = canvas.width / WIDTH;
    const scaleY = canvas.height / HEIGHT;
    drawing.save();
    drawing.clearRect(0, 0, canvas.width, canvas.height);
    drawing.scale(scaleX, scaleY);
    drawing.fillStyle = '#080817';
    drawing.fillRect(0, 0, WIDTH, HEIGHT);
    drawing.fillStyle = '#76f7ff';
    drawing.font = '700 22px monospace';
    drawing.fillText('MEMORY // MATCH', 48, 52);
    drawing.fillStyle = '#9aa0d4';
    drawing.font = '12px monospace';
    drawing.fillText('PAIR THE SHAPES  •  +100 EACH', 48, 78);
    drawing.fillStyle = '#fff36b';
    drawing.fillText(`SCORE ${this.context?.score.current() ?? 0}    BEST ${this.context?.score.best() ?? 0}`, 48, 101);

    for (let index = 0; index < VALUES.length; index += 1) this.renderCard(drawing, index);

    drawing.fillStyle = '#9aa0d4';
    drawing.font = '11px monospace';
    drawing.fillText('ARROWS: MOVE    SPACE: FLIP', 48, 555);
    drawing.fillText('TAP A CARD TO FLIP', 48, 578);
    drawing.fillStyle = this.status === 'over' ? '#8eff8e' : '#fff36b';
    drawing.font = '700 15px monospace';
    drawing.fillText(this.status === 'ready' ? 'PRESS ACTION TO START' : this.status === 'over' ? 'ALL PAIRS FOUND // NICE WORK' : 'REMEMBER THE PATTERNS', 48, 610);
    drawing.restore();
  }

  destroy(): void {
    this.generation += 1;
    this.clearHideTimer();
    this.removePointerListeners?.();
    this.removePointerListeners = null;
    this.canvas = null;
    this.context = null;
  }

  pause(): void {
    this.paused = true;
    if (this.hideTimer !== null) {
      this.clearHideTimer();
      this.hidePending = true;
    }
  }

  resume(): void {
    this.paused = false;
    if (this.hidePending) this.scheduleHide();
  }

  private start(): void {
    if (this.status !== 'ready') return;
    this.cards = shuffledCards();
    this.revealed.fill(false);
    this.matched.fill(false);
    this.firstCard = null;
    this.secondCard = null;
    this.cursor = 0;
    this.status = 'playing';
    this.context?.score.reset();
    this.context?.setStatus('playing');
    this.context?.audio.tone(440, 70, 'triangle', 0.06);
  }

  private flip(index: number): void {
    if (this.status === 'ready') this.start();
    if (this.status !== 'playing' || this.paused || this.matched[index] || this.revealed[index] || this.hidePending) return;
    this.revealed[index] = true;
    this.context?.audio.tone(360 + this.cards[index] * 42, 45, 'sine', 0.05);
    if (this.firstCard === null) {
      this.firstCard = index;
      return;
    }
    this.secondCard = index;
    if (this.cards[this.firstCard] === this.cards[index]) {
      this.matched[this.firstCard] = true;
      this.matched[index] = true;
      this.context?.score.add(100);
      this.context?.audio.tone(760, 110, 'triangle', 0.07);
      this.firstCard = null;
      this.secondCard = null;
      if (this.matched.every(Boolean)) this.finish();
      return;
    }
    this.scheduleHide();
  }

  private scheduleHide(): void {
    this.clearHideTimer();
    this.hidePending = true;
    const token = this.generation;
    this.hideTimer = window.setTimeout(() => {
      this.hideTimer = null;
      if (token !== this.generation || !this.canvas || !this.context || this.paused || this.status !== 'playing') return;
      if (this.firstCard !== null) this.revealed[this.firstCard] = false;
      if (this.secondCard !== null) this.revealed[this.secondCard] = false;
      this.firstCard = null;
      this.secondCard = null;
      this.hidePending = false;
    }, HIDE_DELAY_MS);
  }

  private clearHideTimer(): void {
    if (this.hideTimer !== null) window.clearTimeout(this.hideTimer);
    this.hideTimer = null;
  }

  private finish(): void {
    this.status = 'over';
    this.context?.setStatus('over');
    this.context?.audio.tone(900, 160, 'triangle', 0.08);
  }

  private renderCard(drawing: CanvasRenderingContext2D, index: number): void {
    const row = Math.floor(index / GRID);
    const column = index % GRID;
    const x = BOARD_X + column * (CARD_SIZE + CARD_GAP);
    const y = BOARD_Y + row * (CARD_SIZE + CARD_GAP);
    const visible = this.revealed[index] || this.matched[index];
    drawing.fillStyle = visible ? '#171b3a' : '#10132b';
    drawing.fillRect(x, y, CARD_SIZE, CARD_SIZE);
    drawing.strokeStyle = index === this.cursor ? '#fff36b' : visible ? '#76f7ff' : '#30386e';
    drawing.lineWidth = index === this.cursor ? 3 : 2;
    drawing.strokeRect(x + 1, y + 1, CARD_SIZE - 2, CARD_SIZE - 2);
    if (visible) this.drawShape(drawing, this.cards[index], x + CARD_SIZE / 2, y + CARD_SIZE / 2);
    else {
      drawing.strokeStyle = '#3d477d';
      drawing.lineWidth = 2;
      drawing.strokeRect(x + 22, y + 22, CARD_SIZE - 44, CARD_SIZE - 44);
      drawing.beginPath();
      drawing.moveTo(x + 29, y + 41);
      drawing.lineTo(x + 41, y + 29);
      drawing.lineTo(x + 53, y + 41);
      drawing.lineTo(x + 41, y + 53);
      drawing.closePath();
      drawing.stroke();
    }
  }

  private drawShape(drawing: CanvasRenderingContext2D, value: number, centerX: number, centerY: number): void {
    drawing.fillStyle = ['#76f7ff', '#ff8bd8', '#8eff8e', '#fff36b', '#ff9d6c', '#d19cff', '#6ee7b7', '#ff6b7a'][value];
    drawing.strokeStyle = drawing.fillStyle;
    drawing.lineWidth = 3;
    drawing.beginPath();
    if (value === 0) drawing.arc(centerX, centerY, 18, 0, Math.PI * 2);
    else if (value === 1) drawing.rect(centerX - 17, centerY - 17, 34, 34);
    else if (value === 2) { drawing.moveTo(centerX, centerY - 21); drawing.lineTo(centerX + 20, centerY + 17); drawing.lineTo(centerX - 20, centerY + 17); drawing.closePath(); }
    else if (value === 3) { drawing.moveTo(centerX, centerY - 21); drawing.lineTo(centerX + 21, centerY); drawing.lineTo(centerX, centerY + 21); drawing.lineTo(centerX - 21, centerY); drawing.closePath(); }
    else if (value === 4) drawing.arc(centerX, centerY, 20, 0, Math.PI);
    else if (value === 5) { drawing.moveTo(centerX - 20, centerY - 16); drawing.lineTo(centerX + 20, centerY - 16); drawing.lineTo(centerX, centerY + 20); drawing.closePath(); }
    else if (value === 6) { drawing.moveTo(centerX - 20, centerY - 20); drawing.lineTo(centerX + 20, centerY + 20); drawing.moveTo(centerX + 20, centerY - 20); drawing.lineTo(centerX - 20, centerY + 20); }
    else drawing.arc(centerX, centerY, 20, 0, Math.PI * 2);
    drawing.fill();
    if (value === 4) { drawing.fillStyle = '#171b3a'; drawing.fillRect(centerX - 20, centerY, 40, 22); }
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (this.paused || this.status === 'over' || !this.canvas) return;
    event.preventDefault();
    const index = this.pointerIndex(event);
    if (index !== null) {
      this.cursor = index;
      this.flip(index);
    }
  };

  private onContextMenu = (event: MouseEvent): void => event.preventDefault();

  private pointerIndex(event: PointerEvent): number | null {
    if (!this.canvas) return null;
    const bounds = this.canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return null;
    const logicalX = (event.clientX - bounds.left) * (WIDTH / bounds.width);
    const logicalY = (event.clientY - bounds.top) * (HEIGHT / bounds.height);
    const column = Math.floor((logicalX - BOARD_X) / (CARD_SIZE + CARD_GAP));
    const row = Math.floor((logicalY - BOARD_Y) / (CARD_SIZE + CARD_GAP));
    if (row < 0 || row >= GRID || column < 0 || column >= GRID) return null;
    const localX = logicalX - (BOARD_X + column * (CARD_SIZE + CARD_GAP));
    const localY = logicalY - (BOARD_Y + row * (CARD_SIZE + CARD_GAP));
    if (localX > CARD_SIZE || localY > CARD_SIZE) return null;
    return row * GRID + column;
  }
}

export function createMemoryMatch(): Game {
  return new MemoryMatchGame();
}
