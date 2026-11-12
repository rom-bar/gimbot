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


## Mobile controls and testing

All games share the same pointer-based touch controls. Each game declares only the directions and actions it uses in its metadata. Direction buttons repeat after 150 ms (45 ms for left/right and 30 ms for Down), while action buttons trigger on pointer-down. The Controls panel saves Buttons/Gestures, target size, handedness, haptics, opacity, CRT and sound preferences on this device. Block Stack uses A to rotate, B to hard-drop, Down to soft-drop, and Left/Right to move; the optional Hold slot is off until enabled in Controls. It also shows a next-piece preview and landing ghost, with a 400 ms lock delay.

For accessibility, zoom is not disabled in the page viewport. Touch scrolling, callouts, and context menus are suppressed only on the active game surface and touch controls; keyboard focus remains visible and reduced-motion preferences are respected.

Run the tests with:

```sh
npm run test:unit
npm run test:e2e
```

The Playwright suite builds the production preview with test-only hooks, then checks every game at 320×568, 360×740, 390×844, 740×360, 768×1024 and 1280×800. The deploy build is rebuilt without those hooks. Unit tests cover multi-source input release and repeat timing; E2E tests cover the shared layout, settings, Block Stack input, gestures, and desktop keyboard controls. See [the real-device checklist](docs/MANUAL_TEST.md) before relying on physical touch feel, and [the screenshot index](docs/screenshots/README.md) for visual evidence.

### Layout and control decisions

The default is Buttons mode with medium targets (60 px); small and large targets are 56 px and 68 px. Buttons and thumb zones have at least 12 px of separation. A size choice is clamped to the available width on very small screens, so targets stay within the viewport. Left-handed mode swaps the two thumb zones. Gestures are opt-in; Twenty48 keeps its existing swipe-first behavior. Hold-to-repeat uses a 150 ms initial delay, then 45 ms for Left/Right and 30 ms for Down. On-screen hints disappear after the first keyboard, touch-button, or gesture input and remain dismissed on this device.
