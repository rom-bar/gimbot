import type { GameEntry, StorageApi } from '../games/types';

const numberFormat = new Intl.NumberFormat('en-US');

export function renderHome(games: GameEntry[], storage: StorageApi): string {
  const count = games.length;
  const cards = games.map(({ meta }) => `
    <a class="game-card" href="#/play/${encodeURIComponent(meta.id)}" style="--game-accent:${meta.accent}" aria-label="Play ${meta.title}">
      <div class="game-card-art">
        <canvas data-preview="${meta.id}" aria-hidden="true"></canvas>
        <span class="card-chip">Original game</span>
      </div>
      <div class="game-card-copy">
        <div class="card-title-line"><h3>${meta.title}</h3><span class="card-arrow" aria-hidden="true">↗</span></div>
        <p>${meta.description}</p>
        <div class="card-foot"><span class="best-label">Best <strong>${numberFormat.format(storage.getBestScore(meta.id))}</strong></span><span class="card-controls">${meta.controls}</span></div>
      </div>
    </a>`).join('');

  return `
    <section class="arcade-hero" aria-labelledby="welcome-title">
      <div class="hero-copy">
        <p class="eyebrow"><span class="live-dot" aria-hidden="true"></span> The cabinet is open</p>
        <h1 id="welcome-title">Take a break.<br /><span>Take the long way.</span></h1>
        <p class="intro">Small games for the minutes between things. No sign-up, no downloads, just one more round.</p>
        <a class="hero-cta" href="#game-shelf"><span class="cta-star" aria-hidden="true">✳</span> Choose a game</a>
      </div>
      <div class="hero-machine" aria-hidden="true">
        <div class="machine-top"><span>RETRO ARCADE</span><span class="machine-lights"><i></i><i></i><i></i></span></div>
        <div class="machine-screen"><span class="screen-glint"></span><span class="arcade-orbit orbit-one"></span><span class="arcade-orbit orbit-two"></span><span class="hero-pixel">✦</span><span class="screen-caption">READY<br />WHEN YOU ARE</span><span class="screen-underscore">_</span></div>
        <div class="machine-controls"><span class="mini-dpad"><i></i></span><span class="mini-buttons"><i></i><i></i></span></div>
        <div class="machine-base"></div>
        <p class="machine-caption">${String(count).padStart(2, '0')} ${count === 1 ? 'cartridge' : 'cartridges'} on the shelf</p>
      </div>
    </section>
    <section class="game-shelf" id="game-shelf" aria-labelledby="shelf-title">
      <div class="shelf-heading">
        <div><p class="section-kicker">Pick your pace</p><h2 id="shelf-title">The game shelf</h2></div>
        <span class="shelf-count">${count} ${count === 1 ? 'game' : 'games'}</span>
      </div>
      ${count > 0 ? `<div class="game-grid">${cards}</div>` : `
        <div class="empty-shelf" role="status"><span class="empty-shelf-art" aria-hidden="true">✳</span><div><h3>Fresh cartridges are on the way</h3><p>This shelf will fill up soon. The cabinet is ready when you are.</p></div></div>`}
    </section>`;
}

export function renderAbout(): string {
  return `
    <section class="about-page" aria-labelledby="about-title">
      <p class="eyebrow">A note from the cabinet</p>
      <h1 id="about-title">Made to play.<br /><span>Made from scratch.</span></h1>
      <div class="about-layout">
        <div class="about-copy">
          <p>Retro Arcade is a small, static collection of browser games built for quick breaks and curious hands.</p>
          <p>Every game is an original implementation of public-domain game mechanics. The artwork and sounds are original and created by the app; no account or server is needed.</p>
          <p>Your best scores and display preferences stay in this browser. After its first visit, the cabinet is designed to keep working offline.</p>
        </div>
        <aside class="about-stamp"><span class="stamp-stars" aria-hidden="true">✳ ✳ ✳</span><strong>All original</strong><span>Code · art · sound</span><span class="stamp-rule"></span><small>Made for play</small></aside>
      </div>
      <a class="back-link" href="#/">Back to the game shelf</a>
    </section>`;
}
