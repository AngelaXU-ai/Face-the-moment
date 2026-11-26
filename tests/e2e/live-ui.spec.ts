import { expect, test } from '@playwright/test';
import path from 'node:path';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('face-the-moment.live-tutorial.v1', 'seen'));
});

test('LIVE UI fits the target viewport and loads its local font', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);

  const fontLoaded = await page.evaluate(() => document.fonts.check('16px "TikTok Sans"'));
  expect(fontLoaded).toBe(true);
  const localFontFetched = await page.evaluate(() => performance.getEntriesByType('resource').some((entry) => entry.name.includes('TikTokSans-Variable-Latin.woff2')));
  expect(localFontFetched).toBe(true);

  const layout = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    documentWidth: document.documentElement.scrollWidth,
    documentHeight: document.documentElement.scrollHeight,
    bodyWidth: document.body.scrollWidth,
    bodyHeight: document.body.scrollHeight,
  }));
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.bodyHeight).toBeLessThanOrEqual(layout.viewportHeight);

  await expect(page.getByText('LIVE Preview', { exact: true })).toBeVisible();
  await expect(page.getByText('Unofficial product prototype', { exact: true })).toHaveCount(0);
  await expect(page.locator('.preview-meta')).toContainText('Rain Aura');
  await expect(page.getByLabel('Firework shape')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Open standalone preview' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start Camera', exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /Auto Trigger/ })).toBeChecked();

  if (testInfo.project.name.startsWith('mobile')) {
    await expect(page.getByRole('navigation')).toBeHidden();
    await page.getByRole('button', { name: 'Open live controls' }).click();
    const controls = page.getByRole('complementary', { name: 'Live interaction controls' });
    await expect(controls).toBeVisible();
    await expect(controls).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
    await page.getByRole('button', { name: 'Close live controls' }).click();
    await expect(controls).not.toHaveClass(/is-open/);
  } else {
    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Live interaction controls' })).toBeVisible();
  }

  await page.screenshot({
    path: path.resolve('outputs', `phase03-${testInfo.project.name}.png`),
    fullPage: false,
    animations: 'disabled',
  });
});

test('manual preview records a real user-triggered event', async ({ page }) => {
  await page.goto('/');
  if ((await page.viewportSize())!.width < 768) {
    await page.getByRole('button', { name: 'Open live controls' }).click();
  }
  await page.getByRole('button', { name: /Preview Rain Aura/i }).click();
  await expect(page.getByText('Manual preview · 72%')).toBeVisible();
  await expect(page.locator('.event-item').first()).toContainText('Rain Aura');
});

test('both effects paint the same single p5 P2D canvas', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440x900');
  await page.goto('/');
  const canvas = page.locator('canvas[data-renderer="p5-p2d"]');
  await expect(canvas).toHaveCount(1);
  await expect(page.locator('canvas')).toHaveCount(1);
  const paintedPixels = () => canvas.evaluate(element => {
    const canvas = element as HTMLCanvasElement;
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let painted = 0;
    for (let i = 3; i < pixels.length; i += 76) if (pixels[i] > 16) painted++;
    return painted;
  });
  for (const name of ['Rain Aura', 'Firework Party']) {
    await page.locator('.gift-scroll').getByRole('button', {name, exact: true}).click();
    await expect.poll(paintedPixels).toBeGreaterThan(60);
    await expect(page.locator('canvas')).toHaveCount(1);
    await page.getByRole('button', {name: 'Reset', exact: true}).click();
    await expect.poll(paintedPixels).toBe(0);
  }
  await page.getByText('Debug', {exact: true}).click();
  await expect(page.getByLabel('Show effect diagnostics')).toHaveCount(0);
});

test('camera pipeline loads the pinned on-device face model', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440x900', 'Model plumbing is exercised once with Chromium fake media; real-face behavior requires the documented manual test.');
  test.setTimeout(60_000);
  const resources = new Set<string>();
  page.context().on('response', response => {
    if (response.ok()) resources.add(response.url());
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Camera', exact: true }).click();
  await expect(page.getByText('Camera on', { exact: true })).toBeVisible();
  await expect.poll(async () => page.locator('.tracking-status').textContent(), { timeout: 45_000 }).toMatch(/tracking|fallback/);
  expect(resources.has('https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task')).toBe(true);
  expect([...resources].some(path => path.includes('/mediapipe/wasm/') && path.endsWith('.wasm'))).toBe(true);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.getByText('Camera off', { exact: true })).toBeVisible();
});

test('right panel scrolls without a visible scrollbar', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440x900');
  await page.setViewportSize({ width: 1440, height: 650 });
  await page.goto('/');
  const panel = page.getByRole('complementary', { name: 'Live interaction controls' });
  await expect(panel).toHaveCSS('scrollbar-width', 'none');
  await expect(panel).toHaveCSS('overflow-y', 'auto');
  await panel.hover();
  await page.mouse.wheel(0, 550);
  await expect.poll(() => panel.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
});
