import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
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
  { name: '740x360', width: 740, height: 360 },
];
const states = ['idle', 'mid-play', 'paused', 'game-over', 'settings'];

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
  await page.screenshot({ path: file, type: 'jpeg', quality: 80, fullPage: false });
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
      await page.waitForTimeout(35);
      await capture(page, folder, game, 'idle');

      const action = page.locator('#touch-controls [data-control="action"]');
      if (await action.count()) await action.click();
      else await page.locator('#touch-controls [data-control]').first().click();
      await page.evaluate(() => window.__game?.setStatus('playing'));
      await page.waitForTimeout(50);
      await capture(page, folder, game, 'mid-play');

      await page.evaluate(() => window.__game?.setStatus('paused'));
      await page.waitForTimeout(30);
      await capture(page, folder, game, 'paused');

      await page.evaluate(() => window.__game?.setStatus('over'));
      await page.waitForTimeout(30);
      await capture(page, folder, game, 'game-over');

      await page.evaluate(() => window.__game?.setStatus('playing'));
      await page.locator('#open-settings').click();
      await page.locator('.control-settings[open]').waitFor();
      await page.waitForTimeout(30);
      await capture(page, folder, game, 'settings');
      await page.keyboard.press('Escape');
      process.stdout.write(`Captured ${viewport.name}: ${game}\n`);
    }
    await context.close();
  }
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}

process.stdout.write(`Saved ${viewports.length * games.length * states.length} screenshots in ${path.relative(root, outputRoot)}.\n`);
