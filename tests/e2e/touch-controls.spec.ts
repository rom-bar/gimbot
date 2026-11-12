import { expect, test } from '@playwright/test';

const games = [
  'serpent', 'block-stack', 'brick-smash', 'twenty48', 'mine-sweep', 'paddle-duel',
  'brick-runner', 'rock-blaster', 'star-defender', 'maze-muncher', 'road-hopper',
  'sliding-tiles', 'lights-out', 'memory-match', 'three-in-a-row', 'disk-reversal',
  'checkers', 'word-guess', 'card-solitaire', 'life-grid',
];
const mobileProjects = new Set(['phone-320', 'phone-360', 'phone-390', 'landscape-740', 'tablet-768']);

async function openGame(page: import('@playwright/test').Page, id: string): Promise<void> {
  await page.goto(`/#/play/${id}`);
  await page.locator('#game-canvas').waitFor();
  await page.waitForFunction(() => Boolean((window as Window & { __game?: unknown }).__game));
}

function getRectGap(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): number {
  const horizontal = Math.max(0, a.x - (b.x + b.width), b.x - (a.x + a.width));
  const vertical = Math.max(0, a.y - (b.y + b.height), b.y - (a.y + a.height));
  if (!horizontal) return vertical;
  if (!vertical) return horizontal;
  return Math.hypot(horizontal, vertical);
}

test.describe('shared control layout', () => {
  for (const game of games) {
    test(`${game} renders a clean, scroll-free play screen`, async ({ page }, testInfo) => {
      await openGame(page, game);
      const viewport = testInfo.project.use.viewport!;
      const measurements = await page.evaluate(() => {
        const scroll = document.scrollingElement!;
        const stage = document.querySelector<HTMLElement>('#game-stage')!.getBoundingClientRect();
        const controls = document.querySelector<HTMLElement>('#touch-controls')!;
        const padZone = controls.querySelector<HTMLElement>('.touch-zone-pad')?.getBoundingClientRect();
        const actionZone = controls.querySelector<HTMLElement>('.touch-zone-actions')?.getBoundingClientRect();
        const buttons = [...controls.querySelectorAll<HTMLButtonElement>('button[data-testid^="control-"]')]
          .filter((button) => getComputedStyle(button).display !== 'none')
          .map((button) => {
            const rect = button.getBoundingClientRect();
            return { label: button.getAttribute('aria-label'), x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          });
        return {
          scrollWidth: scroll.scrollWidth,
          clientWidth: scroll.clientWidth,
          scrollHeight: scroll.scrollHeight,
          clientHeight: scroll.clientHeight,
          stage: { x: stage.x, y: stage.y, width: stage.width, height: stage.height },
          controls: {
            display: getComputedStyle(controls).display,
            buttons,
            zones: {
              pad: padZone ? { x: padZone.x, y: padZone.y, width: padZone.width, height: padZone.height } : null,
              actions: actionZone ? { x: actionZone.x, y: actionZone.y, width: actionZone.width, height: actionZone.height } : null,
            },
          },
          viewport: { width: innerWidth, height: innerHeight },
        };
      });
      expect(measurements.scrollWidth).toBeLessThanOrEqual(measurements.clientWidth);
      expect(measurements.scrollHeight).toBeLessThanOrEqual(measurements.clientHeight);
      expect(measurements.stage.x).toBeGreaterThanOrEqual(0);
      expect(measurements.stage.x + measurements.stage.width).toBeLessThanOrEqual(viewport.width + 1);
      if (mobileProjects.has(testInfo.project.name)) {
        expect(measurements.controls.buttons.length, `${game} should declare touch controls`).toBeGreaterThan(0);
        const { pad, actions } = measurements.controls.zones;
        if (pad && actions) expect(getRectGap(pad, actions), 'thumb-zone gap').toBeGreaterThanOrEqual(12);
        for (const button of measurements.controls.buttons) {
          expect(button.width, `${button.label} width`).toBeGreaterThanOrEqual(56);
          expect(button.height, `${button.label} height`).toBeGreaterThanOrEqual(56);
          expect(button.x).toBeGreaterThanOrEqual(-1);
          expect(button.y).toBeGreaterThanOrEqual(-1);
          expect(button.x + button.width).toBeLessThanOrEqual(viewport.width + 1);
          expect(button.y + button.height).toBeLessThanOrEqual(viewport.height + 1);
          const overlap = button.x < measurements.stage.x + measurements.stage.width &&
            button.x + button.width > measurements.stage.x && button.y < measurements.stage.y + measurements.stage.height &&
            button.y + button.height > measurements.stage.y;
          expect(overlap, `${button.label} overlaps the canvas`).toBe(false);
        }
        for (let i = 0; i < measurements.controls.buttons.length; i += 1) {
          for (let j = i + 1; j < measurements.controls.buttons.length; j += 1) {
            const a = measurements.controls.buttons[i];
            const b = measurements.controls.buttons[j];
            const overlaps = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
            expect(overlaps, `${a.label} overlaps ${b.label}`).toBe(false);
            expect(getRectGap(a, b), `${a.label}/${b.label} gap`).toBeGreaterThanOrEqual(12);
          }
        }
        if (['phone-320', 'phone-360', 'phone-390'].includes(testInfo.project.name)) {
          expect(measurements.stage.width).toBeGreaterThanOrEqual(viewport.width * .7 - 1);
        }
      }
      const errors = await page.evaluate(() => (window as Window & { __game?: { getState(): { status: string } } }).__game!.getState().status);
      expect(errors).toBe('ready');
    });
  }
});

test('settings persist and mirror the thumb zones', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop-1280', 'Touch settings are tested in touch-enabled projects.');
  await openGame(page, 'block-stack');
  await page.getByTestId('open-settings').click();
  const dialog = page.getByRole('dialog', { name: 'Play settings' });
  await expect(dialog).toBeVisible();
  await dialog.getByTestId('setting-left-handed').check();
  const pad = page.locator('.touch-zone-pad').boundingBox();
  const actions = page.locator('.touch-zone-actions').boundingBox();
  const [padBox, actionsBox] = await Promise.all([pad, actions]);
  expect(padBox).not.toBeNull();
  expect(actionsBox).not.toBeNull();
  if (testInfo.project.name === 'tablet-768') expect(padBox!.y).toBeGreaterThan(actionsBox!.y);
  else expect(padBox!.x).toBeGreaterThan(actionsBox!.x);
  await dialog.getByTestId('setting-size').selectOption('68');
  await expect(dialog.getByTestId('setting-size')).toHaveValue('68');
  const effectiveSize = Number.parseFloat(await page.getByTestId('control-action').evaluate((button) => getComputedStyle(button).width));
  expect(effectiveSize).toBeGreaterThanOrEqual(56);
  expect(effectiveSize).toBeLessThanOrEqual(68);
  if (testInfo.project.name !== 'phone-320') expect(effectiveSize).toBe(68);
  await dialog.getByTestId('setting-gestures').selectOption('true');
  await expect(page.locator('#touch-controls')).toHaveAttribute('data-scheme', 'gestures');
  for (const button of await page.locator('#touch-controls button[data-control]').all()) await expect(button).toBeHidden();
  await dialog.getByTestId('setting-gestures').selectOption('false');
  await dialog.getByTestId('setting-hold').check();
  await expect(page.getByTestId('control-hold')).toBeVisible();
  await expect(dialog).toBeVisible();
  await page.reload();
  await expect(page.locator('#touch-controls')).toHaveAttribute('data-handed', 'left');
  await expect(page.getByTestId('control-hold')).toBeVisible();
});

test('first touch input hides the mobile hint and remembers it', async ({ page }, testInfo) => {
  test.skip(!['phone-320', 'phone-360', 'phone-390'].includes(testInfo.project.name), 'The hint is only shown on portrait phones.');
  await openGame(page, 'serpent');
  const hint = page.locator('#mobile-help');
  await expect(hint).toBeVisible();
  await page.getByTestId('control-action').click();
  await expect(hint).toBeHidden();
  await page.reload();
  await expect(hint).toBeHidden();
});

test('Block Stack starts, moves one cell on tap, and repeats while held', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop-1280', 'The desktop project verifies keyboard input instead.');
  await openGame(page, 'block-stack');
  await page.evaluate(() => (window as Window & { __game?: { setSeed(seed: number): void } }).__game!.setSeed(17));
  await page.getByTestId('control-action').click();
  await page.waitForFunction(() => (window as Window & { __game?: { getState(): { status: string } } }).__game!.getState().status === 'playing');
  const before = await page.evaluate(() => (window as Window & { __game?: { getState(): { game: { pieceX: number } } } }).__game!.getState().game.pieceX);
  await page.getByTestId('control-left').click();
  await page.waitForTimeout(40);
  const afterTap = await page.evaluate(() => (window as Window & { __game?: { getState(): { game: { pieceX: number } } } }).__game!.getState().game.pieceX);
  expect(afterTap).toBe(before - 1);

  const beforePulses = await page.evaluate(() => (window as Window & { __game?: { getState(): { input: { pulses: Record<string, number> } } } }).__game!.getState().input.pulses.right ?? 0);
  const right = page.getByTestId('control-right');
  const box = await right.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
  const during = await page.evaluate(() => (window as Window & { __game?: { getState(): { input: { down: string[]; pulses: Record<string, number> } } } }).__game!.getState().input);
  expect(during.down).toContain('right');
  await page.mouse.up();
  const afterPulses = during.pulses.right ?? 0;
  expect(afterPulses - beforePulses).toBeGreaterThanOrEqual(8);
  expect(afterPulses - beforePulses).toBeLessThanOrEqual(13);
});

test('multi-touch and cancellation release all controls safely', async ({ page }) => {
  await openGame(page, 'block-stack');
  await page.evaluate(() => {
    const fire = (selector: string, type: string, pointerId: number) => {
      const button = document.querySelector<HTMLButtonElement>(selector)!;
      const rect = button.getBoundingClientRect();
      button.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId, pointerType: 'touch', isPrimary: pointerId === 1, button: 0, buttons: type === 'pointerdown' ? 1 : 0, clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2 }));
    };
    fire('[data-testid="control-left"]', 'pointerdown', 11);
    fire('[data-testid="control-action"]', 'pointerdown', 12);
  });
  const held = await page.evaluate(() => (window as Window & { __game?: { getState(): { input: { down: string[] } } } }).__game!.getState().input.down);
  expect(held).toContain('left');
  expect(held).toContain('action');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const released = await page.evaluate(() => (window as Window & { __game?: { getState(): { input: { down: string[]; pressed: string[] } } } }).__game!.getState().input);
  expect(released.down).toEqual([]);
  expect(released.pressed).toEqual([]);
});

test('gestures map a swipe immediately and desktop keyboard input remains active', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'desktop-1280') {
    await openGame(page, 'block-stack');
    await page.keyboard.press('Space');
    await page.waitForFunction(() => (window as Window & { __game?: { getState(): { status: string } } }).__game!.getState().status === 'playing');
    await page.keyboard.down('ArrowRight');
    await expect.poll(() => page.evaluate(() => (window as Window & { __game?: { getState(): { input: { down: string[] } } } }).__game!.getState().input.down)).toContain('right');
    await page.keyboard.up('ArrowRight');
    return;
  }
  await openGame(page, 'block-stack');
  await page.getByTestId('open-settings').click();
  await page.getByRole('dialog').getByTestId('setting-gestures').selectOption('true');
  const stage = page.locator('#game-stage');
  const box = await stage.boundingBox();
  await page.evaluate(({ x, y }) => {
    const stageNode = document.querySelector<HTMLElement>('#game-stage')!;
    const fire = (type: string, clientX: number, clientY: number) => stageNode.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 31, pointerType: 'touch', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX, clientY }));
    fire('pointerdown', x + 80, y + 80);
    fire('pointermove', x + 135, y + 80);
    fire('pointerup', x + 135, y + 80);
  }, { x: box!.x, y: box!.y });
  const state = await page.evaluate(() => (window as Window & { __game?: { getState(): { input: { pulses: Record<string, number> } } } }).__game!.getState().input);
  expect(state.pulses.right).toBeGreaterThan(0);
});


test('Block Stack rotates, soft-drops, and hard-drops on the mapped buttons', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop-1280', 'The desktop project verifies keyboard input instead.');
  await openGame(page, 'block-stack');
  await page.evaluate(() => (window as Window & { __game?: { setSeed(seed: number): void } }).__game!.setSeed(2));
  const action = page.getByTestId('control-action');
  await action.click();
  await page.waitForFunction(() => (window as Window & { __game?: { getState(): { status: string } } }).__game!.getState().status === 'playing');
  const beforeRotate = await page.evaluate(() => (window as Window & { __game?: { getState(): { game: { piece: number[][] } } } }).__game!.getState().game.piece);
  await action.click();
  await page.waitForTimeout(35);
  const afterRotate = await page.evaluate(() => (window as Window & { __game?: { getState(): { game: { piece: number[][] } } } }).__game!.getState().game.piece);
  expect(afterRotate).not.toEqual(beforeRotate);

  const down = page.getByTestId('control-down');
  const downBox = await down.boundingBox();
  await page.mouse.move(downBox!.x + downBox!.width / 2, downBox!.y + downBox!.height / 2);
  const beforeY = await page.evaluate(() => (window as Window & { __game?: { getState(): { game: { pieceY: number } } } }).__game!.getState().game.pieceY);
  await page.mouse.down();
  await page.waitForTimeout(250);
  await page.mouse.up();
  const afterY = await page.evaluate(() => (window as Window & { __game?: { getState(): { game: { pieceY: number } } } }).__game!.getState().game.pieceY);
  expect(afterY).toBeGreaterThan(beforeY);

  const beforeBoard = await page.evaluate(() => (window as Window & { __game?: { getState(): { game: { board: number[][] } } } }).__game!.getState().game.board.flat().filter(Boolean).length);
  await page.getByTestId('control-secondary').click();
  await page.waitForTimeout(40);
  const afterBoard = await page.evaluate(() => (window as Window & { __game?: { getState(): { game: { board: number[][] } } } }).__game!.getState().game.board.flat().filter(Boolean).length);
  expect(afterBoard).toBeGreaterThan(beforeBoard);
});

test('pointer-down is immediate and pointer-cancel cannot leave an input stuck', async ({ page }) => {
  await openGame(page, 'block-stack');
  const actionState = await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>('[data-testid="control-action"]')!;
    const rect = button.getBoundingClientRect();
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 21, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1, clientX: rect.x + 20, clientY: rect.y + 20 }));
    const state = (window as Window & { __game?: { getState(): { input: { down: string[]; pressed: string[] } } } }).__game!.getState().input;
    button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 21, pointerType: 'touch', isPrimary: true, button: 0, buttons: 0, clientX: rect.x + 20, clientY: rect.y + 20 }));
    return state;
  });
  expect(actionState.down).toContain('action');
  expect(actionState.pressed).toContain('action');
  await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>('[data-testid="control-left"]')!;
    const rect = button.getBoundingClientRect();
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 22, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1, clientX: rect.x + 10, clientY: rect.y + 10 }));
    button.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, cancelable: true, pointerId: 22, pointerType: 'touch', isPrimary: true, button: 0, buttons: 0, clientX: rect.x + 10, clientY: rect.y + 10 }));
  });
  const released = await page.evaluate(() => (window as Window & { __game?: { getState(): { input: { down: string[] } } } }).__game!.getState().input.down);
  expect(released).toEqual([]);
});

test('all other games accept their declared touch input without runtime errors', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-360', 'One full game smoke pass runs at the common phone size.');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const game of games) {
    await openGame(page, game);
    const button = page.locator('#touch-controls button[data-control]').first();
    await expect(button).toBeVisible();
    await button.dispatchEvent('pointerdown', { pointerId: 77, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1 });
    const state = await page.evaluate(() => (window as Window & { __game?: { getState(): { id: string; input: { down: string[] } } } }).__game!.getState());
    expect(state.id).toBe(game);
    expect(state.input.down.length).toBeGreaterThan(0);
    await button.dispatchEvent('pointerup', { pointerId: 77, pointerType: 'touch', isPrimary: true, button: 0, buttons: 0 });
    expect(errors, `${game} runtime errors`).toEqual([]);
  }
});
