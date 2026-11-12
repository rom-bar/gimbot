# Retro Arcade

A compact, original arcade cabinet for the browser. It is a static Vite + TypeScript app using Canvas 2D, with no runtime dependencies. The installable PWA caches the built app for offline play.

**Live cabinet:** https://rom-bar.github.io/gimbot/

## The games

**Arcade:** Serpent, Block Stack, Brick Smash, Twenty48, Mine Sweep, Paddle Duel, Brick Runner, Rock Blaster, Star Defender, Maze Muncher, and Road Hopper.

**Puzzles and table games:** Sliding Tiles, Lights Out, Memory Match, Three in a Row, Disk Reversal, Checkers, Word Guess, Card Solitaire, and Life Grid.

Each game has its own start, pause, restart, score, and saved high-score flow where applicable. Keyboard and on-screen touch controls are supported; Canvas artwork and Web Audio sound effects are generated locally. CRT effects and sound can be toggled in the cabinet, and reduced-motion preferences are respected.

## Run it locally

```sh
npm ci
npm run dev
```

Build and preview the static output:

```sh
npm run build
npm run preview
```

Run the pure-logic unit tests with `npm test`. The suite covers falling-block rotation/line clears, Twenty48 merges, Mine Sweep flood fill, and Disk Reversal move validity.

The build uses `/gimbot/` as its default base path. Set `BASE_PATH` to the deployment subpath when building for another repository.

## GitHub Pages and offline play

The workflow in `.github/workflows/deploy.yml` runs tests, builds, and deploys on every push to `main`. In the repository, open **Settings → Pages** and choose **GitHub Actions** as the source if Pages has not been enabled yet. The generated `dist` directory includes a subpath-aware service worker, a PWA manifest, and a GitHub Pages `404.html` fallback. Open the site once while online so the service worker can cache it; afterward the cabinet and game routes work offline.

## Adding a game

Create `src/games/<id>/index.ts` and implement the shared `Game` interface from `src/games/types.ts`. Export its metadata and factory, then add both to `src/registry.ts`; the menu is generated from that registry. Keep pure mechanics in a small logic module and cover them with Vitest tests. Add original Canvas artwork and Web Audio sounds—do not copy protected art, levels, or music, and use generic names.

## Legal note

The games are original implementations of public-domain game mechanics. All visuals are drawn by the app, and all sound effects are synthesized locally with the Web Audio API.
