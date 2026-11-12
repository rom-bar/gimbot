import type { AudioApi, Game, GameContext, GameEntry, GameStatus, ScoreApi, StorageApi } from '../games/types';
import { FixedGameLoop } from '../core/loop';
import { InputManager } from '../core/input';
import { TouchControls } from '../platform/touch-controls';

declare global {
  interface Window {
    __game?: {
      getState(): Record<string, unknown>;
      setSeed(seed: number): void;
      setStatus(status: GameStatus): void;
      pause(): void;
      step(dt?: number): void;
    };
  }
}

interface GameController {
  destroy(): void;
  togglePause(): void;
  restart(): void;
}

export function renderGamePage(entry: GameEntry, storage: StorageApi): string {
  const { meta } = entry;
  return `
    <section class="game-page" data-game-id="${meta.id}" aria-labelledby="game-title" style="--game-accent:${meta.accent}">
      <header class="game-heading">
        <a class="compact-back" href="#/" aria-label="Back to the game shelf" data-testid="game-back">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18 9 12l6-6" /></svg>
        </a>
        <h1 id="game-title">${meta.title}</h1>
        <button class="game-menu-button" id="open-settings" type="button" data-testid="open-settings" aria-label="Open game menu" aria-haspopup="dialog">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg>
        </button>
      </header>
      <div class="game-toolbar" aria-label="Game stats">
        <div class="scoreboard" aria-label="Scores and progress">
          <div class="score-cell"><span>Score</span><strong id="current-score">0</strong></div>
          <div class="score-cell"><span>Best</span><strong id="best-score">${storage.getBestScore(meta.id)}</strong></div>
          <div class="score-cell"><span>Lines</span><strong id="current-lines">0</strong></div>
          <div class="score-cell"><span>Level</span><strong id="current-level">1</strong></div>
        </div>
        <button class="pause-icon-button" id="pause-game" type="button" disabled aria-label="Pause game" data-testid="pause-game">
          <svg class="pause-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" /></svg>
          <svg class="resume-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z" /></svg>
        </button>
      </div>
      <div class="game-layout" id="game-layout">
        <div class="game-stage" id="game-stage">
          <canvas id="game-canvas" width="480" height="640" tabindex="0" aria-label="${meta.title} game area"></canvas>
          <div class="game-overlay" id="game-overlay" aria-live="polite"></div>
        </div>
        <aside class="game-side-panel">
          <div class="how-to-play"><h2>How to play</h2><p>${meta.controls}</p><div class="key-hint" aria-label="Keyboard: arrows or WASD to move, Space or A to act, P or Escape to pause"><span>Arrows / WASD · Space / A · P / Esc</span></div></div>
          <div class="touch-controls" id="touch-controls" data-testid="touch-controls" role="group" aria-label="Touch game controls"></div>
        </aside>
      </div>
    </section>`;
}

export function mountGame(
  root: HTMLElement,
  entry: GameEntry,
  input: InputManager,
  audio: AudioApi,
  storage: StorageApi,
): GameController {
  const canvas = root.querySelector<HTMLCanvasElement>('#game-canvas');
  const overlay = root.querySelector<HTMLDivElement>('#game-overlay');
  const scoreElement = root.querySelector<HTMLElement>('#current-score');
  const bestElement = root.querySelector<HTMLElement>('#best-score');
  const linesElement = root.querySelector<HTMLElement>('#current-lines');
  const levelElement = root.querySelector<HTMLElement>('#current-level');
  const pauseButton = root.querySelector<HTMLButtonElement>('#pause-game');
  const controlsHost = root.querySelector<HTMLElement>('#touch-controls');
  const stage = root.querySelector<HTMLElement>('#game-stage');
  const settingsButton = root.querySelector<HTMLButtonElement>('#open-settings');
  if (!canvas || !overlay || !scoreElement || !bestElement || !linesElement || !levelElement || !pauseButton || !controlsHost || !stage || !settingsButton) {
    throw new Error('The game shell is incomplete.');
  }

  let game: Game | null = null;
  let loop: FixedGameLoop | null = null;
  let status: GameStatus = 'ready';
  let pausedFrom: GameStatus = 'playing';
  let currentScore = 0;
  let lines = 0;
  let level = 1;
  let destroyed = false;

  const score: ScoreApi = {
    current: () => currentScore,
    best: () => storage.getBestScore(entry.meta.id),
    set(value) {
      currentScore = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : currentScore;
      const best = storage.getBestScore(entry.meta.id);
      if (currentScore > best) storage.setBestScore(entry.meta.id, currentScore);
      renderScores();
    },
    add(value) { score.set(currentScore + value); },
    reset() { currentScore = 0; renderScores(); },
  };

  function renderScores(): void {
    scoreElement!.textContent = String(currentScore);
    bestElement!.textContent = String(storage.getBestScore(entry.meta.id));
  }

  function setStats(nextLines: number, nextLevel: number): void {
    lines = Number.isFinite(nextLines) ? Math.max(0, Math.floor(nextLines)) : lines;
    level = Number.isFinite(nextLevel) ? Math.max(1, Math.floor(nextLevel)) : level;
    linesElement!.textContent = String(lines);
    levelElement!.textContent = String(level);
  }

  function stateMessage(): string {
    if (status === 'ready') return `<div class="state-card"><h2>Ready?</h2><p>${entry.meta.controls}</p><button class="state-button" id="state-action" type="button">Start game</button><span class="state-footnote">Press Space or A</span></div>`;
    if (status === 'paused') return `<div class="state-card"><h2>Paused</h2><p>Your round is right where you left it.</p><button class="state-button" id="state-action" type="button">Resume round</button><span class="state-footnote">Press P or Esc</span></div>`;
    if (status === 'over') return `<div class="state-card"><h2>Nice run.</h2><p class="final-score">Score <strong>${currentScore}</strong> <span>·</span> Best <strong>${storage.getBestScore(entry.meta.id)}</strong></p><button class="state-button" id="state-action" type="button">Play again</button><a class="state-back" href="#/">Back to the shelf</a></div>`;
    return '';
  }

  function showStatus(): void {
    const hidden = status === 'playing';
    overlay!.classList.toggle('is-hidden', hidden);
    overlay!.innerHTML = hidden ? '' : stateMessage();
    pauseButton!.disabled = status === 'ready' || status === 'over';
    pauseButton!.classList.toggle('is-resume', status === 'paused');
    pauseButton!.setAttribute('aria-label', status === 'paused' ? 'Resume game' : 'Pause game');
    const action = overlay!.querySelector<HTMLButtonElement>('#state-action');
    action?.addEventListener('click', () => {
      if (status === 'ready') input.pulse('action');
      else if (status === 'paused') resume();
      else if (status === 'over') restart();
    });
  }

  function setStatus(next: GameStatus): void {
    if (destroyed) return;
    status = next;
    showStatus();
  }

  function createContext(): GameContext {
    return { input, audio, storage, score, setStatus, setStats };
  }

  function startInstance(): void {
    if (destroyed) return;
    score.reset();
    setStats(0, 1);
    status = 'ready';
    game = entry.create();
    game.init(canvas!, createContext());
    showStatus();
    if (import.meta.env.DEV || import.meta.env.VITE_ENABLE_TEST_HOOKS === 'true') {
      window.__game = {
        getState: () => ({ id: entry.meta.id, status, score: currentScore, stats: { lines, level }, input: input.snapshot(), game: game?.getDebugState?.() ?? null }),
        setSeed: (seed) => game?.setSeed?.(seed),
        setStatus: (next) => setStatus(next),
        pause: () => pause(),
        step: (dt = 1 / 60) => { game?.update(dt); input.finishFrame(); },
      };
    }
    loop = new FixedGameLoop(game, input, () => status);
    loop.start();
  }

  function restart(): void {
    loop?.stop();
    loop = null;
    game?.destroy();
    game = null;
    input.clear();
    startInstance();
  }

  function pause(): void {
    if (status !== 'playing') return;
    pausedFrom = status;
    game?.pause();
    setStatus('paused');
  }

  function resume(): void {
    if (status !== 'paused') return;
    game?.resume();
    setStatus(pausedFrom === 'paused' ? 'playing' : pausedFrom);
    canvas!.focus({ preventScroll: true });
  }

  function togglePause(): void {
    if (status === 'paused') resume();
    else pause();
  }

  input.setActive(true);
  input.setShortcuts(togglePause, restart);
  pauseButton.addEventListener('click', togglePause);
  const controls = new TouchControls({
    host: controlsHost,
    stage,
    root,
    input,
    meta: entry.meta,
    storage,
    audio,
    onRestart: restart,
    onFirstInput: () => undefined,
  });

  startInstance();

  return {
    togglePause,
    restart,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      controls.destroy();
      loop?.stop();
      game?.destroy();
      if (import.meta.env.DEV || import.meta.env.VITE_ENABLE_TEST_HOOKS === 'true') delete window.__game;
      input.setShortcuts(() => undefined, () => undefined);
      input.destroy();
    },
  };
}
