# Retro Arcade

A small, original arcade cabinet for the browser. It is a static Vite + TypeScript app with no runtime dependencies, and it is designed to keep working offline as a PWA.

## Phase one games

Serpent, Block Stack, Brick Smash, Twenty48, and Mine Sweep. All game art is drawn with Canvas 2D and scores stay in local storage.

**Live cabinet:** https://rom-bar.github.io/gimbot/

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

Run the pure-logic unit tests with `npm test`.

The build uses `/gimbot/` as its default base path. Set `BASE_PATH` to the deployment subpath when building for another repository.

## GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds and deploys on every push to `main`. In the repository, open **Settings → Pages** and choose **GitHub Actions** as the source if Pages has not been enabled yet. The built `dist` directory contains a subpath-aware service worker, a PWA manifest, and a GitHub Pages `404.html` fallback.

## Adding a game

Each game lives in `src/games/<id>/index.ts` and follows the shared `Game` interface. Add its factory and metadata to `src/registry.ts`; the library menu is generated from that registry. Put pure mechanics in a small logic module and cover them with Vitest tests. Game code, visuals, and Web Audio sound effects should be original; use generic names and do not copy protected art or music.

## Legal note

The games are original implementations of public-domain game mechanics. All game visuals are drawn by the app, and sound effects are synthesized locally with the Web Audio API.
