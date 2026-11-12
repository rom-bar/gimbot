import { expect, test } from '@playwright/test';

const games = [
  'serpent', 'block-stack', 'brick-smash', 'twenty48', 'mine-sweep', 'paddle-duel',
  'brick-runner', 'rock-blaster', 'star-defender', 'maze-muncher', 'road-hopper',
  'sliding-tiles', 'lights-out', 'memory-match', 'three-in-a-row', 'disk-reversal',
  'checkers', 'word-guess', 'card-solitaire', 'life-grid',
];
const touchProjects = new Set(['phone-320', 'phone-360', 'phone-390', 'phone-412', 'landscape-740', 'tablet-768']);
const portraitPhoneProjects = new Set(['phone-320', 'phone-360', 'phone-390', 'phone-412']);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

async function openGame(page: import('@playwright/test').Page, id: string): Promise<void> {
  await page.goto(`/#/play/${id}`);
  await page.locator('#game-canvas').waitFor();
  await page.waitForFunction(() => Boolean((window as Window & { __game?: unknown }).__game));
}

async function selectButtons(page: import('@playwright/test').Page): Promise<void> {
  await page.getByTestId('open-settings').click();
  await page.getByRole('dialog', { name: 'Game menu' }).getByTestId('setting-gestures').selectOption('buttons');
  await page.getByRole('button', { name: 'Close menu' }).click();
}

function rectGap(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): number {
  const horizontal = Math.max(0, a.x - (b.x + b.width), b.x - (a.x + a.width));
  const vertical = Math.max(0, a.y - (b.y + b.height), b.y - (a.y + a.height));
  if (!horizontal) return vertical;
  if (!vertical) return horizontal;
  return Math.hypot(horizontal, vertical);
}

test.describe('shared game-screen layout', () => {
  for (const game of games) {
    test(`${game} uses the compact shell without scroll or control overlap`, async ({ page }, testInfo) => {
      await openGame(page, game);
      const viewport = testInfo.project.use.viewport!;
      const result = await page.evaluate(() => {
        const scroll = document.scrollingElement!;
        const stage = document.querySelector<HTMLElement>('#game-stage')!.getBoundingClientRect();
        const host = document.querySelector<HTMLElement>('#touch-controls')!;
        const buttons = [...host.querySelectorAll<HTMLButtonElement>('button[data-testid^="control-"]')]
          .filter((button) => getComputedStyle(button).display !== 'none')
          .map((button) => {
            const rect = button.getBoundingClientRect();
            return { id: button.dataset.testid, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          });
        const left = host.querySelector<HTMLButtonElement>('[data-testid="control-left"]')?.getBoundingClientRect();
        const right = host.querySelector<HTMLButtonElement>('[data-testid="control-right"]')?.getBoundingClientRect();
        const state = (window as Window & { __game?: { getState(): { game?: { cellSize?: number; boardX?: number; boardY?: number; boardWidth?: number; boardHeight?: number } } } }).__game!.getState();
        const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
        return {
          scrollWidth: scroll.scrollWidth,
          clientWidth: scroll.clientWidth,
          scrollHeight: scroll.scrollHeight,
          clientHeight: scroll.clientHeight,
          stage: { x: stage.x, y: stage.y, width: stage.width, height: stage.height },
          canvas: { width: canvas.clientWidth, height: canvas.clientHeight },
          scheme: host.dataset.scheme,
          buttons,
          leftRightGap: left && right ? Math.max(0, left.left - right.right, right.left - left.right, left.top - right.bottom, right.top - left.bottom) : null,
          cellSize: state.game?.cellSize ?? null,
          boardX: state.game?.boardX ?? null,
          boardY: state.game?.boardY ?? null,
          boardWidth: state.game?.boardWidth ?? null,
          boardHeight: state.game?.boardHeight ?? null,
          touchHintVisible: Boolean(document.querySelector('.key-hint') && getComputedStyle(document.querySelector('.key-hint')!).display !== 'none'),
        };
      });
      expect(result.scrollWidth).toBeLessThanOrEqual(result.clientWidth + 1);
      expect(result.scrollHeight).toBeLessThanOrEqual(result.clientHeight + 1);
      expect(result.stage.x).toBeGreaterThanOrEqual(-1);
      expect(result.stage.x + result.stage.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(result.touchHintVisible).toBe(!touchProjects.has(testInfo.project.name));

      if (touchProjects.has(testInfo.project.name)) {
        if (portraitPhoneProjects.has(testInfo.project.name)) {
          expect(result.stage.width, 'portrait board area spans nearly the full width').toBeGreaterThanOrEqual(viewport.width * .9);
        }
        if (game === 'block-stack' && touchProjects.has(testInfo.project.name)) {
          expect(result.scheme).toBe('gestures');
          expect(result.buttons).toHaveLength(0);
          expect(result.cellSize).toBe(Math.floor(Math.min(result.canvas.width / 10, result.canvas.height / 20)));
          expect(result.boardX).toBe(Math.floor((result.canvas.width - result.boardWidth!) / 2));
          expect(result.boardY).toBe(Math.floor((result.canvas.height - result.boardHeight!) / 2));
          if (portraitPhoneProjects.has(testInfo.project.name)) {
            expect(result.stage.height, 'gesture mode gives the board at least half the phone height').toBeGreaterThanOrEqual(viewport.height * .5);
          }
          if (testInfo.project.name === 'phone-360') expect(result.cellSize, 'cell size at 360x740').toBeGreaterThanOrEqual(28);
          if (['phone-390', 'phone-412'].includes(testInfo.project.name)) expect(result.cellSize, 'cell size on wide phones').toBeGreaterThanOrEqual(32);
          expect(result.boardWidth).toBe(result.cellSize! * 10);
          expect(result.boardHeight).toBe(result.cellSize! * 20);
        } else {
          expect(result.buttons.length, `${game} should show its declared touch controls`).toBeGreaterThan(0);
          for (const button of result.buttons) {
            expect(button.width, `${button.id} width`).toBeGreaterThanOrEqual(56);
            expect(button.height, `${button.id} height`).toBeGreaterThanOrEqual(56);
            expect(button.x).toBeGreaterThanOrEqual(12);
            expect(button.x + button.width).toBeLessThanOrEqual(viewport.width - 12);
            expect(button.y).toBeGreaterThanOrEqual(-1);
            expect(button.y + button.height).toBeLessThanOrEqual(viewport.height + 1);
            const overlapsBoard = button.x < result.stage.x + result.stage.width && button.x + button.width > result.stage.x && button.y < result.stage.y + result.stage.height && button.y + button.height > result.stage.y;
            expect(overlapsBoard, `${button.id} overlaps the board`).toBe(false);
          }
          for (let i = 0; i < result.buttons.length; i += 1) {
            for (let j = i + 1; j < result.buttons.length; j += 1) {
              const a = result.buttons[i];
              const b = result.buttons[j];
              const overlaps = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
              expect(overlaps, `${a.id} overlaps ${b.id}`).toBe(false);
            }
          }
          if (result.leftRightGap !== null) expect(result.leftRightGap, 'Left and Right are adjacent').toBeLessThanOrEqual(12);
        }
      }
    });
  }
});

test('Block Stack defaults to gestures and remembers each game control scheme independently', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop-1280', 'Desktop uses keyboard input rather than on-screen controls.');
  await openGame(page, 'block-stack');
  await expect(page.locator('#touch-controls')).toHaveAttribute('data-scheme', 'gestures');
  await expect(page.getByTestId('control-left')).toHaveCount(0);
  await page.getByTestId('open-settings').click();
  const menu = page.getByRole('dialog', { name: 'Game menu' });
  await expect(menu).toBeVisible();
  await expect(menu.getByTestId('setting-repeat')).toHaveValue('medium');
  await menu.getByTestId('setting-gestures').selectOption('both');
  await expect(page.locator('#touch-controls')).toHaveAttribute('data-scheme', 'both');
  await expect(page.getByTestId('control-left')).toBeVisible();
  await menu.getByTestId('setting-gestures').selectOption('buttons');
  await expect(page.locator('#touch-controls')).toHaveAttribute('data-scheme', 'buttons');
  const left = await page.getByTestId('control-left').boundingBox();
  const right = await page.getByTestId('control-right').boundingBox();
  expect(left).not.toBeNull();
  expect(right).not.toBeNull();
  expect(rectGap(left!, right!)).toBeLessThanOrEqual(12);
  await menu.getByTestId('setting-repeat').selectOption('fast');
  await menu.getByTestId('setting-left-handed').check();
  await menu.getByTestId('setting-size').selectOption('64');
  await page.getByRole('button', { name: 'Close menu' }).click();
  await page.reload();
  await expect(page.locator('#touch-controls')).toHaveAttribute('data-scheme', 'buttons');
  await expect(page.locator('#touch-controls')).toHaveAttribute('data-handed', 'left');
  await expect(page.getByTestId('control-action')).toBeVisible();
  await page.getByTestId('open-settings').click();
  await expect(page.getByRole('dialog', { name: 'Game menu' }).getByTestId('setting-repeat')).toHaveValue('fast');
  await page.goto('/#/play/serpent');
  await expect(page.locator('#touch-controls')).toHaveAttribute('data-scheme', 'buttons');
  await expect(page.getByTestId('control-left')).toBeVisible();
});

test('the menu exposes sound, CRT, restart, and the pause icon remains accessible', async ({ page }) => {
  await openGame(page, 'block-stack');
  const pause = page.getByTestId('pause-game');
  await expect(pause).toHaveAttribute('aria-label', 'Pause game');
  await page.locator('#game-stage').dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, clientX: 160, clientY: 200 });
  await page.locator('#game-stage').dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, clientX: 160, clientY: 200 });
  await expect.poll(async () => page.evaluate(() => (window as Window & { __game?: { getState(): { status: string } } }).__game!.getState().status)).toBe('playing');
  await pause.click();
  await expect(pause).toHaveAttribute('aria-label', 'Resume game');
  await page.getByTestId('open-settings').click();
  const menu = page.getByRole('dialog', { name: 'Game menu' });
  await expect(menu.getByTestId('setting-sound')).toBeVisible();
  await expect(menu.getByTestId('setting-crt')).toBeVisible();
  await menu.getByTestId('settings-restart').scrollIntoViewIfNeeded();
  await menu.getByTestId('settings-restart').click();
  await expect(menu).toBeHidden();
  await expect.poll(async () => page.evaluate(() => (window as Window & { __game?: { getState(): { status: string } } }).__game!.getState().status)).toBe('ready');
});

test('Block Stack gestures move by cell-width, tap rotates, flick hard-drops, and cancel releases input', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop-1280', 'Gesture simulation requires a touch viewport.');
  await openGame(page, 'block-stack');
  await page.evaluate(() => (window as Window & { __game?: { setSeed(seed: number): void } }).__game!.setSeed(17));
  const stageBox = await page.locator('#game-stage').boundingBox();
  const step = await page.locator('#game-stage').evaluate((stage) => Math.max(24, (stage as HTMLElement).clientWidth / 10));
  const fire = async (types: Array<[string, number, number]>) => page.evaluate(({ events, box }) => {
    const stage = document.querySelector<HTMLElement>('#game-stage')!;
    for (const [type, dx, dy] of events) {
      stage.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 31, pointerType: 'touch', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: box.x + box.width * .5 + dx, clientY: box.y + box.height * .35 + dy }));
    }
  }, { events: types, box: stageBox! });
  await fire([['pointerdown', 0, 0], ['pointerup', 0, 0]]);
  await expect.poll(async () => page.evaluate(() => (window as Window & { __game?: { getState(): { status: string } } }).__game!.getState().status)).toBe('playing');
  const beforeX = await page.evaluate(() => (window as Window & { __game?: { getState(): { game: { pieceX: number } } } }).__game!.getState().game.pieceX);
  await fire([['pointerdown', 0, 0], ['pointermove', -step * 2, 0], ['pointerup', -step * 2, 0]]);
  await expect.poll(async () => page.evaluate(() => (window as Window & { __game?: { getState(): { game: { pieceX: number } } } }).__game!.getState().game.pieceX), { timeout: 1000 }).toBe(beforeX - 2);
  const beforePiece = await page.evaluate(() => (window as Window & { __game?: { getState(): { game: { piece: number[][] } } } }).__game!.getState().game.piece);
  await fire([['pointerdown', 0, 0], ['pointerup', 0, 0]]);
  await expect.poll(async () => page.evaluate(() => (window as Window & { __game?: { getState(): { game: { piece: number[][] } } } }).__game!.getState().game.piece), { timeout: 1000 }).not.toEqual(beforePiece);
  const beforeBoard = await page.evaluate(() => (window as Window & { __game?: { getState(): { game: { board: number[][] } } } }).__game!.getState().game.board.flat().filter(Boolean).length);
  await fire([['pointerdown', 0, 0], ['pointermove', 0, 62], ['pointerup', 0, 62]]);
  await expect.poll(async () => page.evaluate(() => (window as Window & { __game?: { getState(): { game: { board: number[][] } } } }).__game!.getState().game.board.flat().filter(Boolean).length), { timeout: 1000 }).toBeGreaterThan(beforeBoard);
  await page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>('#game-stage')!;
    stage.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 32, pointerType: 'touch', isPrimary: true, button: 0, clientX: 80, clientY: 100 }));
    stage.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 32, pointerType: 'touch', isPrimary: true, button: 0, clientX: 80, clientY: 100 }));
  });
  await expect.poll(async () => page.evaluate(() => (window as Window & { __game?: { getState(): { input: { down: string[] } } } }).__game!.getState().input.down)).toEqual([]);
});

test('button repeat defaults to 140/40ms, soft drop stays 30ms, and long press A rotates counter-clockwise', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop-1280', 'Button timing is tested on touch viewports.');
  await openGame(page, 'block-stack');
  await selectButtons(page);
  await page.evaluate(() => (window as Window & { __game?: { setSeed(seed: number): void } }).__game!.setSeed(17));
  const action = page.getByTestId('control-action');
  await action.click();
  await expect.poll(async () => page.evaluate(() => (window as Window & { __game?: { getState(): { status: string } } }).__game!.getState().status)).toBe('playing');
  const before = await page.evaluate(() => (window as Window & { __game?: { getState(): { input: { pulses: Record<string, number> } } } }).__game!.getState().input.pulses.right ?? 0);
  const right = page.getByTestId('control-right');
  const box = await right.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
  const during = await page.evaluate(() => (window as Window & { __game?: { getState(): { input: { pulses: Record<string, number> } } } }).__game!.getState().input.pulses.right ?? 0);
  await page.mouse.up();
  expect(during - before).toBeGreaterThanOrEqual(10);
  expect(during - before).toBeLessThanOrEqual(16);

  const pieceBeforeHold = await page.evaluate(() => (window as Window & { __game?: { getState(): { game: { piece: number[][] } } } }).__game!.getState().game.piece);
  const actionBox = await action.boundingBox();
  await page.mouse.move(actionBox!.x + actionBox!.width / 2, actionBox!.y + actionBox!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(480);
  await page.mouse.up();
  await page.waitForTimeout(80);
  const pieceAfterHold = await page.evaluate(() => (window as Window & { __game?: { getState(): { game: { piece: number[][] } } } }).__game!.getState().game.piece);
  const rotateClockwise = (matrix: number[][]) => matrix[0].map((_, i) => matrix.map((row) => row[i]).reverse());
  const rotateCounterClockwise = (matrix: number[][]) => rotateClockwise(rotateClockwise(rotateClockwise(matrix)));
  expect(pieceAfterHold).toEqual(rotateCounterClockwise(pieceBeforeHold));
});

test('held controls release on blur and pointercancel without stuck inputs', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop-1280', 'Pointer cancellation is tested on touch viewports.');
  await openGame(page, 'serpent');
  const left = page.getByTestId('control-left');
  const result = await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>('[data-testid="control-left"]')!;
    const rect = button.getBoundingClientRect();
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 44, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1, clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2 }));
    const held = (window as Window & { __game?: { getState(): { input: { down: string[] } } } }).__game!.getState().input.down;
    button.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, cancelable: true, pointerId: 44, pointerType: 'touch', isPrimary: true, button: 0, buttons: 0, clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2 }));
    return held;
  });
  expect(result).toContain('left');
  await expect.poll(async () => page.evaluate(() => (window as Window & { __game?: { getState(): { input: { down: string[] } } } }).__game!.getState().input.down)).toEqual([]);
  await left.dispatchEvent('pointerdown', { pointerId: 45, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1 });
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect.poll(async () => page.evaluate(() => (window as Window & { __game?: { getState(): { input: { down: string[] } } } }).__game!.getState().input.down)).toEqual([]);
});

test('all games mount and their declared controls accept touch input at the common phone size', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-360', 'One full game interaction smoke pass runs at the common phone size.');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const game of games) {
    await openGame(page, game);
    if (game === 'block-stack') {
      const stage = page.locator('#game-stage');
      const box = await stage.boundingBox();
      await stage.dispatchEvent('pointerdown', { pointerId: 77, pointerType: 'touch', isPrimary: true, button: 0, clientX: box!.x + box!.width / 2, clientY: box!.y + box!.height / 2 });
      await stage.dispatchEvent('pointerup', { pointerId: 77, pointerType: 'touch', isPrimary: true, button: 0, clientX: box!.x + box!.width / 2, clientY: box!.y + box!.height / 2 });
    } else {
      const button = page.locator('#touch-controls button[data-control]').first();
      await expect(button).toBeVisible();
      await button.dispatchEvent('pointerdown', { pointerId: 77, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1 });
      await button.dispatchEvent('pointerup', { pointerId: 77, pointerType: 'touch', isPrimary: true, button: 0, buttons: 0 });
    }
    const id = await page.evaluate(() => (window as Window & { __game?: { getState(): { id: string } } }).__game!.getState().id);
    expect(id).toBe(game);
    expect(errors, `${game} runtime errors`).toEqual([]);
  }
});
