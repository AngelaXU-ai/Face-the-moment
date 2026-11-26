const { chromium } = require('playwright');

async function measure() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.addInitScript(() => {
      window.fireworkSamples = [];
      const fillText = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (value, ...args) {
        const sample = /^(\d+) FPS · (\d+) particles/.exec(value);
        if (sample && Number(sample[2]) > 0) {
          window.fireworkSamples.push([performance.now(), Number(sample[2])]);
        }
        return fillText.call(this, value, ...args);
      };
    });
    await page.addInitScript(() => localStorage.setItem('face-the-moment.live-tutorial.v1', 'seen'));
    await page.goto(process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5180');
    await page.getByText('Debug', { exact: true }).click();
    await page.getByLabel('Show effect diagnostics').check();
    const preview = page.getByRole('button', { name: 'Preview Firework Party' });
    for (let i = 0; i < 4; i++) {
      await preview.click();
      await page.waitForTimeout(3600);
    }
    const samples = await page.evaluate(() => window.fireworkSamples);
    if (samples.length < 60) throw new Error('Missing effect diagnostics samples');
    const intervals = samples.slice(1).map(([time], i) => time - samples[i][0])
      .filter(interval => interval > 0 && interval < 500).sort((a, b) => a - b);
    console.log(JSON.stringify({
      browser: browser.version(),
      frames: samples.length,
      medianFps: Math.round(1000 / intervals[Math.floor(intervals.length * .5)]),
      p95FrameMs: Math.round(intervals[Math.floor(intervals.length * .95)] * 10) / 10,
      peakParticles: Math.max(...samples.map(([, count]) => count)),
    }));
  } finally {
    await browser.close();
  }
}

measure().catch(error => { console.error(error); process.exitCode = 1; });
