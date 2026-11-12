import './style.css';
import { ArcadeAudio } from './core/audio';
import { InputManager } from './core/input';
import { parseRoute } from './core/router';
import { ArcadeStorage } from './core/storage';
import { gameRegistry } from './registry';
import { renderAbout, renderHome } from './ui/catalog';
import { drawGamePreviews } from './ui/previews';
import { mountGame, renderGamePage } from './ui/game';

const root = (() => {
  const element = document.querySelector<HTMLDivElement>('#app');
  if (!element) throw new Error('The app root is missing.');
  return element;
})();

const storage = new ArcadeStorage();
const audio = new ArcadeAudio(storage);
let controller: ReturnType<typeof mountGame> | null = null;

function shellHeader(): string {
  const crt = storage.getBoolean('crt', true);
  return `
    <header class="site-header">
      <a class="brand" href="#/" aria-label="Retro Arcade home">
        <span class="brand-mark" aria-hidden="true">R</span>
        <span class="brand-name">Retro<br />Arcade</span>
      </a>
      <nav class="header-actions" aria-label="Site settings">
        <a class="quiet-button about-link" href="#/about">About</a>
        <button class="quiet-button setting-button" id="crt-toggle" type="button" aria-pressed="${crt}"><span class="toggle-dot" aria-hidden="true"></span><span>CRT ${crt ? 'on' : 'off'}</span></button>
        <button class="quiet-button setting-button" id="sound-toggle" type="button" aria-pressed="${!audio.muted}" aria-label="${audio.muted ? 'Turn sound on' : 'Mute sound'}"><span class="sound-glyph" aria-hidden="true">${audio.muted ? '♪' : '♫'}</span><span>${audio.muted ? 'Sound off' : 'Sound on'}</span></button>
      </nav>
    </header>`;
}

function render(): void {
  controller?.destroy();
  controller = null;
  const route = parseRoute(location.hash);
  const entry = route.type === 'game' ? gameRegistry.find((candidate) => candidate.meta.id === route.id) : undefined;
  const isGame = Boolean(entry);
  document.documentElement.classList.toggle('is-playing', isGame);
  document.documentElement.dataset.crt = storage.getBoolean('crt', true) ? 'on' : 'off';

  let page: string;
  if (route.type === 'about') page = renderAbout();
  else if (entry) page = `<div id="game-root">${renderGamePage(entry, storage)}</div>`;
  else if (route.type === 'game') page = `<section class="not-found"><p class="eyebrow">Cartridge not found</p><h1>This game isn't<br />on the shelf.</h1><a class="back-link" href="#/">Back to the game shelf</a></section>`;
  else page = renderHome(gameRegistry, storage);

  document.title = entry ? `${entry.meta.title} — Retro Arcade` : route.type === 'about' ? 'About — Retro Arcade' : 'Retro Arcade — one more round';
  root.innerHTML = `<div class="app-frame ${isGame ? 'game-frame' : ''}">${isGame ? '' : shellHeader()}<main id="main-content" class="main-content ${isGame ? 'game-main' : ''}" tabindex="-1">${page}</main>${isGame ? '' : '<footer class="site-footer"><span>Made for the next free minute.</span><span>Offline-ready · no account</span></footer>'}</div>`;
  document.documentElement.dataset.crt = storage.getBoolean('crt', true) ? 'on' : 'off';

  document.querySelector<HTMLButtonElement>('#crt-toggle')?.addEventListener('click', () => {
    const enabled = !storage.getBoolean('crt', true);
    storage.setBoolean('crt', enabled);
    document.documentElement.dataset.crt = enabled ? 'on' : 'off';
    const button = document.querySelector<HTMLButtonElement>('#crt-toggle');
    if (button) {
      button.setAttribute('aria-pressed', String(enabled));
      const label = button.querySelector('span:last-child');
      if (label) label.textContent = `CRT ${enabled ? 'on' : 'off'}`;
    }
  });
  document.querySelector<HTMLButtonElement>('#sound-toggle')?.addEventListener('click', () => {
    audio.setMuted(!audio.muted);
    const button = document.querySelector<HTMLButtonElement>('#sound-toggle');
    if (button) {
      button.setAttribute('aria-pressed', String(!audio.muted));
      button.setAttribute('aria-label', audio.muted ? 'Turn sound on' : 'Mute sound');
      const label = button.querySelector('span:last-child');
      if (label) label.textContent = audio.muted ? 'Sound off' : 'Sound on';
      const glyph = button.querySelector('.sound-glyph');
      if (glyph) glyph.textContent = audio.muted ? '♪' : '♫';
    }
  });

  if (entry) {
    const gameRoot = document.querySelector<HTMLElement>('#game-root');
    if (gameRoot) {
      const input = new InputManager();
      controller = mountGame(gameRoot, entry, input, audio, storage);
    }
  } else {
    drawGamePreviews(root);
  }
}

window.addEventListener('pointerdown', () => { void audio.unlock(); }, { passive: true });
window.addEventListener('keydown', () => { void audio.unlock(); }, { passive: true });
window.addEventListener('hashchange', render);
render();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    });
  });
}
