import type { Game, GameContext, GameMeta } from '../types';

const WIDTH = 480;
const HEIGHT = 640;
const MAX_MISSES = 6;
const WORDS = ['LENTERA', 'KOMET', 'RIMBA', 'MUTIARA', 'BUNGA', 'SENJA', 'KABUT', 'GEMURUH'];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const meta: GameMeta = {
  id: 'word-guess',
  title: 'Word Guess',
  description: 'Reveal a hidden word one letter at a time.',
  controls: 'Tap a letter or press A–Z. Press the action button to start.',
  accent: '#f2c14e',
  touchControls: { dpad: [], buttons: ['action'], labels: {action: 'Start'}, gestures: false },
};

export class WordGuessGame implements Game {
  readonly meta = meta;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private gameContext: GameContext | null = null;
  private word = '';
  private guessed = new Set<string>();
  private misses = 0;
  private status: 'ready' | 'playing' | 'over' = 'ready';
  private paused = false;
  private elapsed = 0;
  private destroyed = false;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (this.status !== 'playing' || this.paused) return;
    const letter = event.key.length === 1 ? event.key.toUpperCase() : '';
    if (!ALPHABET.includes(letter)) return;
    event.preventDefault();
    this.guess(letter);
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (this.status !== 'playing' || this.paused || !this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    const letter = this.letterAt(x, y);
    if (letter) this.guess(letter);
  };

  init(canvas: HTMLCanvasElement, context: GameContext): void {
    this.destroy();
    this.canvas = canvas;
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;
    this.ctx = canvas.getContext('2d');
    this.gameContext = context;
    this.destroyed = false;
    this.paused = false;
    this.resetRound();
    if (typeof window !== 'undefined') window.addEventListener('keydown', this.onKeyDown);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    context.setStatus('ready');
    this.render();
  }

  update(dt: number): void {
    if (this.destroyed || this.paused) return;
    if (this.status === 'ready' && this.gameContext?.input.pressed('action')) this.start();
    if (this.status === 'playing') this.elapsed += Math.max(0, Math.min(dt, 1));
  }

  render(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    this.drawHeader(ctx);
    this.drawScaffold(ctx);
    this.drawWord(ctx);
    this.drawKeyboard(ctx);
    if (this.status === 'ready') this.drawOverlay(ctx, 'PRESS ACTION TO START');
    if (this.status === 'over') this.drawOverlay(ctx, this.misses >= MAX_MISSES ? 'TRY AGAIN' : 'WORD FOUND');
  }

  pause(): void {
    if (this.status === 'playing') {
      this.paused = true;
      this.gameContext?.setStatus('paused');
    }
  }

  resume(): void {
    if (!this.destroyed && this.paused && this.status === 'playing') {
      this.paused = false;
      this.gameContext?.setStatus('playing');
    }
  }

  destroy(): void {
    if (typeof window !== 'undefined') window.removeEventListener('keydown', this.onKeyDown);
    this.canvas?.removeEventListener('pointerdown', this.onPointerDown);
    this.elapsed = 0;
    this.destroyed = true;
    this.canvas = null;
    this.ctx = null;
    this.gameContext = null;
    this.guessed.clear();
    this.word = '';
  }

  private resetRound(): void {
    this.word = WORDS[Math.floor(Math.random() * WORDS.length)];
    this.guessed = new Set<string>();
    this.misses = 0;
    this.elapsed = 0;
    this.status = 'ready';
    this.paused = false;
  }

  private start(): void {
    this.resetRound();
    this.status = 'playing';
    this.gameContext?.score.reset();
    this.gameContext?.setStatus('playing');
    this.gameContext?.audio.tone(440, 80, 'triangle', 0.06);
    this.render();
  }

  private guess(letter: string): void {
    if (this.status !== 'playing' || this.guessed.has(letter)) return;
    this.guessed.add(letter);
    if (!this.word.includes(letter)) {
      this.misses += 1;
      this.gameContext?.audio.tone(170, 100, 'sawtooth', 0.05);
      if (this.misses >= MAX_MISSES) this.finish(false);
    } else {
      this.gameContext?.audio.tone(620, 65, 'sine', 0.05);
      if ([...this.word].every((character) => this.guessed.has(character))) this.finish(true);
    }
    this.render();
  }

  private finish(won: boolean): void {
    this.status = 'over';
    this.gameContext?.setStatus('over');
    if (won) {
      this.gameContext?.score.add(100);
      this.gameContext?.audio.tone(880, 150, 'triangle', 0.07);
    } else {
      this.gameContext?.audio.tone(130, 190, 'sawtooth', 0.07);
    }
  }

  private letterAt(x: number, y: number): string | null {
    const left = 28;
    const top = 456;
    const cellWidth = 48;
    const cellHeight = 42;
    const gap = 6;
    const column = Math.floor((x - left) / (cellWidth + gap));
    const row = Math.floor((y - top) / (cellHeight + gap));
    if (column < 0 || column >= 9 || row < 0 || row >= 3) return null;
    const cellX = left + column * (cellWidth + gap);
    const cellY = top + row * (cellHeight + gap);
    if (x > cellX + cellWidth || y > cellY + cellHeight) return null;
    const index = row * 9 + column;
    return ALPHABET[index] ?? null;
  }

  private drawHeader(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#f2c14e';
    ctx.font = '700 28px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('WORD GUESS', 28, 46);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(`WRONG ${this.misses}/${MAX_MISSES}`, 28, 73);
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.floor(this.elapsed)}s`, WIDTH - 28, 73);
  }

  private drawScaffold(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = '#f2c14e';
    ctx.lineWidth = 6;
    ctx.lineCap = 'square';
    ctx.beginPath();
    ctx.moveTo(84, 330); ctx.lineTo(84, 156); ctx.lineTo(226, 156); ctx.lineTo(226, 182);
    ctx.moveTo(62, 330); ctx.lineTo(270, 330);
    ctx.stroke();
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 4;
    if (this.misses >= 1) { ctx.beginPath(); ctx.arc(226, 214, 31, 0, Math.PI * 2); ctx.stroke(); }
    if (this.misses >= 2) { ctx.beginPath(); ctx.moveTo(226, 245); ctx.lineTo(226, 286); ctx.stroke(); }
    if (this.misses >= 3) { ctx.beginPath(); ctx.moveTo(226, 255); ctx.lineTo(192, 274); ctx.stroke(); }
    if (this.misses >= 4) { ctx.beginPath(); ctx.moveTo(226, 255); ctx.lineTo(260, 274); ctx.stroke(); }
    if (this.misses >= 5) { ctx.beginPath(); ctx.moveTo(226, 286); ctx.lineTo(200, 318); ctx.stroke(); }
    if (this.misses >= 6) { ctx.beginPath(); ctx.moveTo(226, 286); ctx.lineTo(252, 318); ctx.stroke(); }
  }

  private drawWord(ctx: CanvasRenderingContext2D): void {
    const startX = 28;
    const gap = 10;
    const slotWidth = Math.min(48, (WIDTH - 56 - gap * (this.word.length - 1)) / this.word.length);
    ctx.textAlign = 'center';
    ctx.font = '700 27px system-ui, sans-serif';
    [...this.word].forEach((character, index) => {
      const x = startX + index * (slotWidth + gap);
      ctx.strokeStyle = '#f2c14e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, 395); ctx.lineTo(x + slotWidth, 395); ctx.stroke();
      if (this.guessed.has(character) || this.status === 'over') {
        ctx.fillStyle = '#f9fafb';
        ctx.fillText(character, x + slotWidth / 2, 386);
      }
    });
  }

  private drawKeyboard(ctx: CanvasRenderingContext2D): void {
    const left = 28;
    const top = 456;
    const cellWidth = 48;
    const cellHeight = 42;
    const gap = 6;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 17px system-ui, sans-serif';
    [...ALPHABET].forEach((letter, index) => {
      const x = left + (index % 9) * (cellWidth + gap);
      const y = top + Math.floor(index / 9) * (cellHeight + gap);
      const used = this.guessed.has(letter);
      const correct = used && this.word.includes(letter);
      ctx.fillStyle = !used ? '#263244' : correct ? '#356859' : '#5b3540';
      ctx.beginPath();
      ctx.roundRect(x, y, cellWidth, cellHeight, 8);
      ctx.fill();
      ctx.fillStyle = used ? '#9ca3af' : '#f9fafb';
      ctx.fillText(letter, x + cellWidth / 2, y + cellHeight / 2 + 1);
    });
    ctx.textBaseline = 'alphabetic';
  }

  private drawOverlay(ctx: CanvasRenderingContext2D, label: string): void {
    ctx.fillStyle = 'rgba(17, 24, 39, 0.78)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#f9fafb';
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, WIDTH / 2, 365);
    if (this.status === 'over' && this.misses >= MAX_MISSES) {
      ctx.fillStyle = '#f2c14e';
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText(`WORD: ${this.word}`, WIDTH / 2, 416);
    }
  }
}

export function createWordGuess(): Game {
  return new WordGuessGame();
}
