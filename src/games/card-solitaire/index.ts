import type { Game, GameContext, GameMeta } from '../types';

export const meta: GameMeta = {
  id: 'card-solitaire',
  title: 'Card Solitaire',
  description: 'Build four suit foundations from a shuffled deck.',
  controls: 'ACTION starts or selects. Arrows move highlight. Tap a card or pile to move it.',
  accent: '#e8c56a',
};

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
type Zone = { kind: 'stock' | 'waste' | 'foundation' | 'tableau'; index: number };
type Card = { suit: Suit; rank: number; faceUp: boolean };
type Point = { x: number; y: number };

const W = 480;
const H = 640;
const SUITS: readonly Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const TABLEAU_X = 24;
const TABLEAU_Y = 178;
const PILE_W = 56;
const PILE_GAP = 12;
const CARD_H = 76;
const TABLEAU_STEP = 22;

function isRed(suit: Suit): boolean { return suit === 'hearts' || suit === 'diamonds'; }
function rankLabel(rank: number): string { return rank === 1 ? 'A' : rank === 11 ? 'J' : rank === 12 ? 'Q' : rank === 13 ? 'K' : String(rank); }
function suitSymbol(suit: Suit): string {
  if (suit === 'hearts') return '♥';
  if (suit === 'diamonds') return '♦';
  if (suit === 'clubs') return '♣';
  return '♠';
}
function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) for (let rank = 1; rank <= 13; rank += 1) deck.push({ suit, rank, faceUp: false });
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
function canStack(card: Card, target: Card | null): boolean {
  return target !== null && card.faceUp && target.faceUp && isRed(card.suit) !== isRed(target.suit) && card.rank === target.rank - 1;
}

export class CardSolitaireGame implements Game {
  readonly meta = meta;
  private canvas: HTMLCanvasElement | null = null;
  private context: GameContext | null = null;
  private stock: Card[] = [];
  private waste: Card[] = [];
  private foundations: Card[][] = [[], [], [], []];
  private tableau: Card[][] = [[], [], [], [], [], [], []];
  private phase: 'ready' | 'playing' | 'over' = 'ready';
  private paused = false;
  private selected: Zone | null = null;
  private highlight: Zone = { kind: 'tableau', index: 0 };
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
    if ((this.phase === 'ready' || this.phase === 'over') && this.context.input.pressed('action')) {
      this.start();
      return;
    }
    if (this.phase !== 'playing') return;
    const directions = ['left', 'right', 'up', 'down'] as const;
    for (const direction of directions) {
      if (this.context.input.pressed(direction)) {
        this.moveHighlight(direction);
        break;
      }
    }
    if (this.context.input.pressed('action')) this.activateHighlight();
  }

  render(): void {
    const canvas = this.canvas;
    const drawing = canvas?.getContext('2d');
    if (!canvas || !drawing) return;
    drawing.save();
    drawing.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    drawing.clearRect(0, 0, W, H);
    drawing.fillStyle = '#102b2b';
    drawing.fillRect(0, 0, W, H);
    drawing.fillStyle = '#e8c56a';
    drawing.font = '700 25px monospace';
    drawing.fillText('CARD SOLITAIRE', 24, 43);
    drawing.fillStyle = '#91b4a7';
    drawing.font = '11px monospace';
    drawing.fillText('BUILD FOUR FOUNDATIONS // DRAW ONE', 24, 67);
    drawing.fillStyle = '#f1ead7';
    drawing.font = '700 13px monospace';
    drawing.fillText(`SCORE ${String(this.context?.score.current() ?? 0).padStart(3, '0')}`, 24, 100);
    drawing.fillText(`BEST ${this.best || '---'}`, 350, 100);
    this.renderTopRow(drawing);
    for (let i = 0; i < this.tableau.length; i += 1) this.renderTableau(drawing, i);
    drawing.textAlign = 'center';
    if (this.phase === 'ready') {
      drawing.fillStyle = '#e8c56a'; drawing.font = '700 16px monospace'; drawing.fillText('PRESS ACTION TO DEAL', W / 2, 590);
    } else if (this.phase === 'over') {
      drawing.fillStyle = '#8fe3cf'; drawing.font = '700 18px monospace'; drawing.fillText('ALL FOUNDATIONS COMPLETE', W / 2, 590);
      drawing.fillStyle = '#d7e5d6'; drawing.font = '11px monospace'; drawing.fillText('PRESS ACTION TO PLAY AGAIN', W / 2, 615);
    } else {
      drawing.fillStyle = '#91b4a7'; drawing.font = '11px monospace'; drawing.fillText('TAP SOURCE, THEN TARGET  //  ARROWS MOVE HIGHLIGHT', W / 2, 615);
    }
    drawing.restore();
  }

  destroy(): void {
    this.removePointerListeners?.();
    this.removePointerListeners = null;
    this.canvas = null;
    this.context = null;
  }
  pause(): void { if (!this.paused && this.phase === 'playing') { this.paused = true; this.context?.setStatus('paused'); } }
  resume(): void { if (this.paused) { this.paused = false; if (this.phase === 'playing') this.context?.setStatus('playing'); } }

  private reset(): void {
    this.stock = []; this.waste = []; this.foundations = [[], [], [], []]; this.tableau = [[], [], [], [], [], [], []];
    this.phase = 'ready'; this.paused = false; this.selected = null; this.highlight = { kind: 'tableau', index: 0 }; this.context?.score.reset();
  }
  private start(): void {
    this.reset();
    const deck = makeDeck();
    for (let pile = 0; pile < 7; pile += 1) for (let cardIndex = 0; cardIndex <= pile; cardIndex += 1) {
      const card = deck.pop();
      if (card) { card.faceUp = cardIndex === pile; this.tableau[pile].push(card); }
    }
    this.stock = deck;
    this.phase = 'playing';
    this.context?.setStatus('playing');
    this.context?.audio.tone(440, 80, 'triangle', 0.06);
    this.render();
  }
  private renderTopRow(drawing: CanvasRenderingContext2D): void {
    this.renderBack(drawing, 24, 112, this.stock.length > 0);
    if (this.isSelected({ kind: 'stock', index: 0 })) this.outline(drawing, 24, 112, PILE_W, CARD_H);
    if (this.waste.length) this.renderCard(drawing, this.waste[this.waste.length - 1], 92, 112);
    else this.renderSlot(drawing, 92, 112, 'WASTE');
    for (let i = 0; i < 4; i += 1) {
      const x = 268 + i * 48;
      const top = this.foundations[i][this.foundations[i].length - 1];
      if (top) this.renderCard(drawing, top, x, 112); else this.renderSlot(drawing, x, 112, suitSymbol(SUITS[i]));
      if (this.isSelected({ kind: 'foundation', index: i })) this.outline(drawing, x, 112, PILE_W, CARD_H);
    }
  }
  private renderTableau(drawing: CanvasRenderingContext2D, pile: number): void {
    const x = TABLEAU_X + pile * (PILE_W + PILE_GAP);
    const cards = this.tableau[pile];
    if (!cards.length) this.renderSlot(drawing, x, TABLEAU_Y, '+');
    cards.forEach((card, i) => this.renderCard(drawing, card, x, TABLEAU_Y + i * TABLEAU_STEP));
    if (this.isSelected({ kind: 'tableau', index: pile })) {
      const y = cards.length ? TABLEAU_Y + Math.max(0, cards.length - 1) * TABLEAU_STEP : TABLEAU_Y;
      this.outline(drawing, x, y, PILE_W, CARD_H);
    }
  }
  private renderCard(drawing: CanvasRenderingContext2D, card: Card, x: number, y: number): void {
    drawing.fillStyle = '#f5f0df'; drawing.strokeStyle = '#c9bea0'; drawing.lineWidth = 1;
    drawing.beginPath(); drawing.roundRect(x, y, PILE_W, CARD_H, 6); drawing.fill(); drawing.stroke();
    if (!card.faceUp) { this.renderBack(drawing, x, y, true); return; }
    const red = isRed(card.suit); drawing.fillStyle = red ? '#bd4d50' : '#1d343b';
    drawing.font = '700 16px monospace'; drawing.textAlign = 'left'; drawing.fillText(rankLabel(card.rank), x + 7, y + 19);
    drawing.font = '18px sans-serif'; drawing.fillText(suitSymbol(card.suit), x + 7, y + 39);
    drawing.textAlign = 'center'; drawing.font = '22px sans-serif'; drawing.fillText(suitSymbol(card.suit), x + PILE_W / 2, y + 58);
  }
  private renderBack(drawing: CanvasRenderingContext2D, x: number, y: number, present: boolean): void {
    if (!present) { this.renderSlot(drawing, x, y, ''); return; }
    drawing.fillStyle = '#294e52'; drawing.strokeStyle = '#e8c56a'; drawing.lineWidth = 2;
    drawing.beginPath(); drawing.roundRect(x, y, PILE_W, CARD_H, 6); drawing.fill(); drawing.stroke();
    drawing.strokeStyle = '#5e8880'; drawing.strokeRect(x + 7, y + 7, PILE_W - 14, CARD_H - 14);
  }
  private renderSlot(drawing: CanvasRenderingContext2D, x: number, y: number, label: string): void {
    drawing.strokeStyle = '#35615f'; drawing.lineWidth = 2; drawing.beginPath(); drawing.roundRect(x, y, PILE_W, CARD_H, 6); drawing.stroke();
    drawing.fillStyle = '#56827a'; drawing.font = '700 14px monospace'; drawing.textAlign = 'center'; drawing.fillText(label, x + PILE_W / 2, y + CARD_H / 2 + 5);
  }
  private outline(drawing: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void { drawing.strokeStyle = '#e8c56a'; drawing.lineWidth = 3; drawing.beginPath(); drawing.roundRect(x - 3, y - 3, w + 6, h + 6, 8); drawing.stroke(); }
  private isSelected(zone: Zone): boolean { return this.selected?.kind === zone.kind && this.selected.index === zone.index; }

  private activateHighlight(): void { if (this.phase !== 'playing') return; this.handleZone(this.highlight); }
  private handlePointerDown = (event: PointerEvent): void => {
    if (this.paused || !this.canvas) return;
    event.preventDefault();
    if (this.phase === 'ready' || this.phase === 'over') { this.start(); return; }
    const point = this.pointerPoint(event);
    const zone = this.zoneAt(point);
    if (zone) { this.highlight = zone; this.handleZone(zone); this.render(); }
  };
  private handleZone(zone: Zone): void {
    if (zone.kind === 'stock') { this.drawStock(); return; }
    if (!this.selected) { if (this.sourceHasCard(zone)) this.selected = zone; return; }
    if (this.selected.kind === zone.kind && this.selected.index === zone.index) { this.selected = null; return; }
    if (this.move(this.selected, zone)) this.selected = null; else if (this.sourceHasCard(zone)) this.selected = zone; else this.selected = null;
  }
  private sourceHasCard(zone: Zone): boolean {
    if (zone.kind === 'waste') return this.waste.length > 0;
    if (zone.kind === 'foundation') return this.foundations[zone.index]?.length > 0;
    if (zone.kind === 'tableau') return this.tableau[zone.index]?.some((card) => card.faceUp) ?? false;
    return false;
  }
  private drawStock(): void {
    if (this.stock.length) { const card = this.stock.pop(); if (card) { card.faceUp = true; this.waste.push(card); } }
    else { while (this.waste.length) { const card = this.waste.pop(); if (card) { card.faceUp = true; this.stock.push(card); } } }
    this.context?.audio.tone(300, 35, 'square', 0.04); this.selected = null; this.render();
  }
  private move(source: Zone, target: Zone): boolean {
    const cards = this.takeCards(source);
    if (!cards.length) return false;
    const first = cards[0];
    let valid = false;
    if (target.kind === 'foundation') valid = cards.length === 1 && first.faceUp && ((this.foundations[target.index].length === 0 && first.rank === 1) || (this.foundations[target.index].length > 0 && this.foundations[target.index][this.foundations[target.index].length - 1].suit === first.suit && first.rank === this.foundations[target.index][this.foundations[target.index].length - 1].rank + 1));
    else if (target.kind === 'tableau') { const pile = this.tableau[target.index]; valid = pile.length === 0 ? first.rank === 13 : canStack(first, pile[pile.length - 1]); }
    if (!valid) return false;
    const destination = target.kind === 'foundation' ? this.foundations[target.index] : this.tableau[target.index];
    destination.push(...cards);
    if (source.kind === 'waste') this.waste.pop();
    if (source.kind === 'foundation') this.foundations[source.index].pop();
    if (source.kind === 'tableau') { this.tableau[source.index].splice(this.tableau[source.index].length - cards.length, cards.length); const top = this.tableau[source.index][this.tableau[source.index].length - 1]; if (top) top.faceUp = true; }
    this.context?.score.add(5); this.context?.audio.tone(520, 45, 'triangle', 0.05); this.checkWin(); this.render(); return true;
  }
  private takeCards(source: Zone): Card[] {
    if (source.kind === 'waste') return this.waste.length ? [this.waste[this.waste.length - 1]] : [];
    if (source.kind === 'foundation') return this.foundations[source.index].length ? [this.foundations[source.index][this.foundations[source.index].length - 1]] : [];
    if (source.kind === 'tableau') { const pile = this.tableau[source.index]; const start = pile.findIndex((card) => card.faceUp); return start >= 0 ? pile.slice(start) : []; }
    return [];
  }
  private checkWin(): void { if (this.foundations.every((pile) => pile.length === 13)) { this.phase = 'over'; const score = this.context?.score.current() ?? 0; if (score > this.best) { this.best = score; this.context?.storage.setBestScore(meta.id, score); } this.context?.setStatus('over'); this.context?.audio.tone(880, 150, 'triangle', 0.08); } }
  private moveHighlight(direction: 'up' | 'down' | 'left' | 'right'): void {
    if (this.highlight.kind === 'tableau') {
      let index = this.highlight.index;
      if (direction === 'left') index = Math.max(0, index - 1);
      if (direction === 'right') index = Math.min(6, index + 1);
      if (direction === 'up') this.highlight = { kind: 'stock', index: 0 };
      else if (direction === 'down') this.highlight = { kind: 'tableau', index };
      else this.highlight = { kind: 'tableau', index };
    } else if (direction === 'down') this.highlight = { kind: 'tableau', index: 0 };
    else if (direction === 'right') this.highlight = this.highlight.kind === 'stock' ? { kind: 'waste', index: 0 } : { kind: 'foundation', index: Math.min(3, this.highlight.index + 1) };
    else if (direction === 'left') this.highlight = this.highlight.kind === 'foundation' && this.highlight.index > 0 ? { kind: 'foundation', index: this.highlight.index - 1 } : { kind: 'stock', index: 0 };
    this.render();
  }
  private pointerPoint(event: PointerEvent): Point { const rect = this.canvas?.getBoundingClientRect(); if (!rect || rect.width <= 0 || rect.height <= 0) return { x: -1, y: -1 }; return { x: (event.clientX - rect.left) * W / rect.width, y: (event.clientY - rect.top) * H / rect.height }; }
  private zoneAt(point: Point): Zone | null {
    if (point.x >= 24 && point.x <= 80 && point.y >= 112 && point.y <= 188) return { kind: 'stock', index: 0 };
    if (point.x >= 92 && point.x <= 148 && point.y >= 112 && point.y <= 188) return { kind: 'waste', index: 0 };
    for (let i = 0; i < 4; i += 1) if (point.x >= 268 + i * 48 && point.x <= 324 + i * 48 && point.y >= 112 && point.y <= 188) return { kind: 'foundation', index: i };
    for (let i = 0; i < 7; i += 1) { const x = TABLEAU_X + i * (PILE_W + PILE_GAP); const height = Math.max(CARD_H, TABLEAU_Y + (this.tableau[i].length - 1) * TABLEAU_STEP + CARD_H); if (point.x >= x && point.x <= x + PILE_W && point.y >= TABLEAU_Y && point.y <= height) return { kind: 'tableau', index: i }; }
    return null;
  }
}

export function createCardSolitaire(): Game { return new CardSolitaireGame(); }
