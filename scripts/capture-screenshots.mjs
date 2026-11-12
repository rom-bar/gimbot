import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from '@playwright/test';

const root = process.cwd();
const outputRoot = path.join(root, 'docs', 'screenshots');
const baseURL = 'http://127.0.0.1:4173';
const viteCLI = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const server = spawn(process.execPath, [viteCLI, 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
  cwd: root,
  stdio: 'ignore',
  env: process.env,
});
let browser;

const games = [
  'serpent', 'block-stack', 'brick-smash', 'twenty48', 'mine-sweep', 'paddle-duel',
  'brick-runner', 'rock-blaster', 'star-defender', 'maze-muncher', 'road-hopper',
  'sliding-tiles', 'lights-out', 'memory-match', 'three-in-a-row', 'disk-reversal',
  'checkers', 'word-guess', 'card-solitaire', 'life-grid',
];
const viewports = [
  { name: '320x568', width: 320, height: 568 },
  { name: '360x740', width: 360, height: 740 },
  { name: '390x844', width: 390, height: 844 },
  { name: '412x915', width: 412, height: 915 },
  { name: '740x360', width: 740, height: 360 },
];
const states = ['idle', 'mid-play', 'game-over', 'menu-open'];
const metrics = {};

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(baseURL);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Vite preview did not become ready on port 4173.');
}

async function capture(page, folder, game, state) {
  const file = path.join(folder, `${game}-${state}.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 82, fullPage: false });
}

try {
  await waitForServer();
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (process.env.CI ? undefined : '/usr/bin/chromium');
  browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), args: ['--no-sandbox'] });
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(5_000);
    const folder = path.join(outputRoot, viewport.name);
    await mkdir(folder, { recursive: true });
    for (const game of games) {
      await page.goto(`${baseURL}/#/play/${game}`, { waitUntil: 'domcontentloaded' });
      await page.locator('#game-canvas').waitFor();
      await page.waitForFunction(() => Boolean(window.__game));
      await page.waitForTimeout(60);
      if (game === 'block-stack') {
        metrics[viewport.name] = await page.evaluate(() => {
          const game = window.__game.getState().game;
          const stage = document.querySelector('#game-stage').getBoundingClientRect();
          const canvas = document.querySelector('#game-canvas');
          return {
            cellSize: game.cellSize,
            boardX: game.boardX,
            boardY: game.boardY,
            boardWidth: game.boardWidth,
            boardHeight: game.boardHeight,
            canvasWidth: canvas.clientWidth,
            canvasHeight: canvas.clientHeight,
            stageWidth: Math.round(stage.width),
            stageHeight: Math.round(stage.height),
          };
        });
      }
      await capture(page, folder, game, 'idle');

      if (game === 'block-stack') {
        const stage = page.locator('#game-stage');
        const box = await stage.boundingBox();
        await stage.dispatchEvent('pointerdown', { pointerId: 101, pointerType: 'touch', isPrimary: true, button: 0, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 });
        await stage.dispatchEvent('pointerup', { pointerId: 101, pointerType: 'touch', isPrimary: true, button: 0, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 });
      } else {
        const action = page.locator('#touch-controls [data-control="action"]');
        const firstButton = page.locator('#touch-controls [data-control]').first();
        if (await action.count()) await action.click();
        else if (await firstButton.count()) await firstButton.click();
      }
      await page.evaluate(() => window.__game?.setStatus('playing'));
      await page.waitForTimeout(100);
      await capture(page, folder, game, 'mid-play');

      await page.evaluate(() => window.__game?.setStatus('over'));
      await page.waitForTimeout(40);
      await capture(page, folder, game, 'game-over');

      await page.evaluate(() => window.__game?.setStatus('playing'));
      await page.getByTestId('open-settings').click();
      await page.locator('.control-settings[open]').waitFor();
      await page.waitForTimeout(40);
      await capture(page, folder, game, 'menu-open');
      await page.keyboard.press('Escape');
      process.stdout.write(`Captured ${viewport.name}: ${game}\n`);
    }
    await context.close();
  }
  await writeFile(path.join(outputRoot, 'metrics.json'), `${JSON.stringify(metrics, null, 2)}\n`);
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}

process.stdout.write(`Saved ${viewports.length * games.length * states.length} screenshots in ${path.relative(root, outputRoot)}.\n`);
