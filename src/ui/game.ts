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
    <section class="game-page" style="--game-accent:${meta.accent}" aria-labelledby="game-title">
      <div class="game-heading">
        <a class="back-link compact-back" href="#/" aria-label="Back to the game shelf">‹ <span>Cabinet</span></a>
        <div class="game-heading-copy"><h1 id="game-title">${meta.title}</h1><p>${meta.description}</p></div>
      </div>
      <div class="game-toolbar">
        <div class="scoreboard" aria-label="Scores">
          <div class="score-cell"><span>Score</span><strong id="current-score">0</strong></div>
          <span class="score-divider" aria-hidden="true"></span>
          <div class="score-cell"><span>Personal best</span><strong id="best-score">${storage.getBestScore(meta.id)}</strong></div>
        </div>
        <div class="game-actions">
          <button class="game-action-button settings-button" id="open-settings" type="button" data-testid="open-settings">Controls</button>
          <button class="game-action-button" id="pause-game" type="button" disabled>Pause</button>
          <button class="game-action-button restart-button" id="restart-game" type="button">Restart</button>
        </div>
      </div>
      <div class="game-layout">
        <div class="game-stage" id="game-stage">
          <canvas id="game-canvas" width="480" height="640" tabindex="0" aria-label="${meta.title} game area"></canvas>
          <div class="game-overlay" id="game-overlay" aria-live="polite"></div>
        </div>
        <aside class="game-side-panel">
          <div class="how-to-play"><span class="panel-mark" aria-hidden="true">✳</span><h2>How to play</h2><p>${meta.controls}</p><div class="key-hint"><span class="key-cap">↑</span><span class="key-cap">←</span><span class="key-cap">↓</span><span class="key-cap">→</span><span class="key-text">or WASD</span></div><p class="side-hint">Space or A to act · P or Esc to pause</p></div>
          <div class="touch-controls" id="touch-controls" data-testid="touch-controls" role="group" aria-label="Touch game controls"></div>
          <p class="mobile-help" id="mobile-help">Tap the screen or use the buttons to play.</p>
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
  const pauseButton = root.querySelector<HTMLButtonElement>('#pause-game');
  const restartButton = root.querySelector<HTMLButtonElement>('#restart-game');
  const controlsHost = root.querySelector<HTMLElement>('#touch-controls');
  const stage = root.querySelector<HTMLElement>('#game-stage');
  const settingsButton = root.querySelector<HTMLButtonElement>('#open-settings');
  const helpHint = root.querySelector<HTMLElement>('#mobile-help');
  if (!canvas || !overlay || !scoreElement || !bestElement || !pauseButton || !restartButton || !controlsHost || !stage || !settingsButton || !helpHint) {
    throw new Error('The game shell is incomplete.');
  }

  let game: Game | null = null;
  let loop: FixedGameLoop | null = null;
  let status: GameStatus = 'ready';
  let pausedFrom: GameStatus = 'playing';
  let currentScore = 0;
  let destroyed = false;

  const dismissHelp = (): void => {
    storage.setBoolean('touch-hint-dismissed', true);
    helpHint!.hidden = true;
  };

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

  function stateMessage(): string {
    if (status === 'ready') return `<div class="state-card"><span class="state-star" aria-hidden="true">✳</span><p class="state-kicker">Your next round</p><h2>Ready?</h2><p>${entry.meta.controls}</p><button class="state-button" id="state-action" type="button">Start game</button><span class="state-footnote">Press Space or A</span></div>`;
    if (status === 'paused') return `<div class="state-card"><span class="state-star" aria-hidden="true">Ⅱ</span><p class="state-kicker">Take your time</p><h2>Paused</h2><p>Your round is right where you left it.</p><button class="state-button" id="state-action" type="button">Resume round</button><span class="state-footnote">Press P or Esc</span></div>`;
    if (status === 'over') return `<div class="state-card"><span class="state-star" aria-hidden="true">✦</span><p class="state-kicker">Round complete</p><h2>Nice run.</h2><p class="final-score">Score <strong>${currentScore}</strong> <span>·</span> Best <strong>${storage.getBestScore(entry.meta.id)}</strong></p><button class="state-button" id="state-action" type="button">Play again</button><a class="state-back" href="#/">Back to the shelf</a></div>`;
    return '';
  }

  function showStatus(): void {
    const hidden = status === 'playing';
    overlay!.classList.toggle('is-hidden', hidden);
    overlay!.innerHTML = hidden ? '' : stateMessage();
    pauseButton!.disabled = status === 'ready' || status === 'over';
    pauseButton!.textContent = status === 'paused' ? 'Resume' : 'Pause';
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
    return { input, audio, storage, score, setStatus };
  }

  function startInstance(): void {
    if (destroyed) return;
    score.reset();
    status = 'ready';
    game = entry.create();
    game.init(canvas!, createContext());
    showStatus();
    if (import.meta.env.DEV || import.meta.env.VITE_ENABLE_TEST_HOOKS === 'true') {
      window.__game = {
        getState: () => ({ id: entry.meta.id, status, score: currentScore, input: input.snapshot(), game: game?.getDebugState?.() ?? null }),
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
  restartButton.addEventListener('click', restart);
  const controls = new TouchControls({ host: controlsHost, stage, root, input, meta: entry.meta, storage, onFirstInput: dismissHelp });
  settingsButton.setAttribute('aria-haspopup', 'dialog');
  helpHint.hidden = storage.getBoolean('touch-hint-dismissed', false);

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
