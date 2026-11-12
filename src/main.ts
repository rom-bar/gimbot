import './style.css';

const root = (() => {
  const element = document.querySelector<HTMLDivElement>('#app');
  if (!element) throw new Error('The app root is missing.');
  return element;
})();

const CRT_KEY = 'retro-arcade-crt';
const readCrt = (): boolean => localStorage.getItem(CRT_KEY) !== 'off';
let crtEnabled = readCrt();

function pageRoute(): 'home' | 'about' {
  return location.hash.replace(/^#\/?/, '').startsWith('about') ? 'about' : 'home';
}

function render(): void {
  document.documentElement.dataset.crt = crtEnabled ? 'on' : 'off';
  const about = pageRoute() === 'about';
  root.innerHTML = `
    <div class="app-frame">
      <header class="site-header">
        <a class="brand" href="#/" aria-label="Retro Arcade home">
          <span class="brand-mark" aria-hidden="true">R</span>
          <span class="brand-name">Retro<br />Arcade</span>
        </a>
        <nav class="header-actions" aria-label="Site settings">
          <button class="quiet-button" id="crt-toggle" type="button" aria-pressed="${crtEnabled}">
            <span class="toggle-dot" aria-hidden="true"></span> CRT ${crtEnabled ? 'on' : 'off'}
          </button>
          <a class="quiet-button about-link" href="#/about">${about ? 'Back to games' : 'About'}</a>
        </nav>
      </header>
      <main id="main-content" tabindex="-1">
        ${about ? renderAbout() : renderHome()}
      </main>
      <footer class="site-footer"><span>Made for the next free minute.</span><span>Offline-ready · no account</span></footer>
    </div>`;

  document.querySelector<HTMLButtonElement>('#crt-toggle')?.addEventListener('click', () => {
    crtEnabled = !crtEnabled;
    localStorage.setItem(CRT_KEY, crtEnabled ? 'on' : 'off');
    render();
  });
}

function renderHome(): string {
  return `
    <section class="welcome" aria-labelledby="welcome-title">
      <div class="welcome-copy">
        <p class="eyebrow"><span class="live-dot" aria-hidden="true"></span> The cabinet is warming up</p>
        <h1 id="welcome-title">One more<br /><span>pixel.</span></h1>
        <p class="intro">A little collection of games for the in-between moments. Pick a cartridge and play.</p>
      </div>
      <div class="empty-cabinet" role="status">
        <div class="cabinet-screen" aria-hidden="true">
          <span class="screen-star">✳</span>
          <span class="screen-line">INSERT<br />FUN</span>
          <span class="screen-cursor">_</span>
        </div>
        <p>First games are<br />being built now.</p>
      </div>
    </section>
    <section class="library" aria-labelledby="library-title">
      <div class="section-heading">
        <h2 id="library-title">The game shelf</h2>
        <span class="shelf-count">0 games</span>
      </div>
      <div class="empty-shelf" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
    </section>`;
}

function renderAbout(): string {
  return `
    <section class="about-page" aria-labelledby="about-title">
      <p class="eyebrow">A note from the cabinet</p>
      <h1 id="about-title">Made to play.<br /><span>Made from scratch.</span></h1>
      <div class="about-copy">
        <p>Retro Arcade is a small, static collection of browser games built for quick breaks and curious hands.</p>
        <p>Every game is an original implementation of public-domain game mechanics. The artwork and sounds are original, generated in the app, and nothing needs an account or a server.</p>
        <p>Your best scores and display preferences stay in this browser. The cabinet is designed to keep working offline after its first visit.</p>
      </div>
      <a class="back-link" href="#/">Back to the game shelf</a>
    </section>`;
}

window.addEventListener('hashchange', render);
render();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    });
  });
}
