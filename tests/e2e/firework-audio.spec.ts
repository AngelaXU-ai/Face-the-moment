import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('face-the-moment.live-tutorial.v1', 'seen'));
});

test('Firework Party mixes local recordings and obeys its own mute, volume and reset controls', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1440x900');
  await page.addInitScript(() => {
    const trace = {starts: 0, stops: 0, volume: 0, peak: 0};
    Object.assign(window, {fireworkAudioTrace: trace});
    const start = AudioBufferSourceNode.prototype.start;
    const stop = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.start = function (when, offset, duration) {
      trace.starts++;
      return start.call(this, when, offset, duration);
    };
    AudioBufferSourceNode.prototype.stop = function (when) {
      trace.stops++;
      return stop.call(this, when);
    };
    const target = AudioParam.prototype.setTargetAtTime;
    AudioParam.prototype.setTargetAtTime = function (value, time, constant) {
      trace.volume = value;
      return target.call(this, value, time, constant);
    };
    const compressor = AudioContext.prototype.createDynamicsCompressor;
    AudioContext.prototype.createDynamicsCompressor = function () {
      const node = compressor.call(this);
      const analyser = this.createAnalyser();
      node.connect(analyser);
      const data = new Float32Array(analyser.fftSize);
      window.setInterval(() => {
        analyser.getFloatTimeDomainData(data);
        for (const sample of data) trace.peak = Math.max(trace.peak, Math.abs(sample));
      }, 20);
      return node;
    };
  });
  const read = () => page.evaluate(() => (window as unknown as {
    fireworkAudioTrace: { starts: number; stops: number; volume: number; peak: number };
  }).fireworkAudioTrace);
  const assets = new Set<string>();
  page.on('response', response => {
    const pathname = new URL(response.url()).pathname;
    if (response.ok() && pathname.includes('/audio/fireworks/')) assets.add(pathname);
  });
  await page.goto('/');
  await expect.poll(() => assets.size).toBe(5);
  const preview = page.getByRole('button', {name: 'Preview Firework Party'});
  const mute = page.getByRole('button', {name: /Firework sound/});
  const volume = page.getByRole('slider', {name: 'Firework volume'});
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
  await preview.click();
  await volume.fill('35');
  await expect.poll(async () => (await read()).volume).toBe(.35);
  await expect.poll(async () => (await read()).starts).toBe(16);
  await expect.poll(async () => (await read()).peak).toBeGreaterThan(.008);
  const before = await read();
  await page.getByRole('button', {name: 'Reset', exact: true}).click();
  await expect.poll(async () => (await read()).stops).toBeGreaterThan(before.stops);
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'false');
  await preview.click();
  await expect(page.locator('.gift-item.is-selected')).toHaveText('Firework Party');
  await page.waitForTimeout(1050);
  expect((await read()).starts).toBe(before.starts);
});
