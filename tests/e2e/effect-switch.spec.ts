import { expect, test, type Page } from '@playwright/test';

async function openStage(page: Page) {
  await page.addInitScript(() => localStorage.setItem('face-the-moment.live-tutorial.v1', 'seen'));
  await page.goto('/');
}

async function emulateExpressions(page: Page) {
  // Replay blendshapes through the existing classifier without adding any production test hooks.
  await page.route(/\/faceLandmarker\.worker[.-]/, route => route.fulfill({
    contentType: 'application/javascript',
    body: `self.onmessage = ({data}) => {
      if (data.type === 'init') return self.postMessage({type:'ready',delegate:'CPU'});
      if (data.type !== 'frame') return;
      data.bitmap.close();
      const smile = data.expression === 'SMILE', laugh = data.expression === 'LAUGH';
      self.postMessage({type:'result',result:{
        timestampMs:data.timestampMs,inferenceMs:0,transformationMatrix:null,
        scores:{smileLeft:laugh ? .65 : smile ? .39 : .02,smileRight:laugh ? .60 : smile ? .35 : .02,
          jawOpen: laugh ? .25 : .08,mouthPucker:0,browInnerUp:0},
        geometry:{centerX:.5,centerY:.48,width:.28,height:.38,rollRadians:0}
      }});
    };`,
  }));
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        if (options?.name !== 'face-landmarker') return;
        const post = this.postMessage.bind(this);
        this.postMessage = (message, transfer?) => {
          if (message.type === 'frame') message.expression = document.documentElement.dataset.testExpression;
          if (Array.isArray(transfer)) post(message, transfer);
          else post(message, transfer);
        };
      }
    };
  });
}

const activeEffect = (page: Page) => page.locator('.gift-item.is-selected');
const canvas = (page: Page) => page.locator('canvas[data-renderer="p5-p2d"]');

test('manual switching drains rain before starting fireworks and latest rapid click wins', async ({page}, info) => {
  test.skip(info.project.name !== 'desktop-1440x900');
  await page.addInitScript(() => {
    const events: {action: string; loop: boolean; time: number}[] = [];
    Object.assign(window, {effectAudioEvents: events});
    const originalStart = AudioBufferSourceNode.prototype.start;
    const originalStop = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.start = function(when, offset, duration) {
      events.push({action: 'start', loop: this.loop, time: performance.now() + Math.max(0, (when ?? 0) - this.context.currentTime) * 1000});
      return originalStart.call(this, when, offset, duration);
    };
    AudioBufferSourceNode.prototype.stop = function(when) {
      events.push({action: 'stop', loop: this.loop, time: performance.now() + Math.max(0, (when ?? 0) - this.context.currentTime) * 1000});
      return originalStop.call(this, when);
    };
  });
  const audioEvents = () => page.evaluate(() => Reflect.get(window, 'effectAudioEvents') as {action:string;loop:boolean;time:number}[]);
  await openStage(page);
  const bar = page.locator('.gift-scroll');
  const rain = bar.getByRole('button', {name: 'Rain Aura', exact: true});
  const firework = bar.getByRole('button', {name: 'Firework Party', exact: true});
  await rain.click();
  await expect.poll(async () => (await audioEvents()).some(e => e.action === 'start' && e.loop)).toBe(true);
  await expect(canvas(page)).toHaveCSS('opacity', '1');
  await firework.click();
  await expect.poll(() => canvas(page).evaluate(el => Number((el as HTMLCanvasElement).style.opacity))).toBeLessThan(.94);
  await expect(activeEffect(page)).toHaveText('Rain Aura');
  await expect(activeEffect(page)).toHaveText('Firework Party');
  await expect.poll(async () => (await audioEvents()).some(e => e.action === 'start' && !e.loop)).toBe(true);
  const events = await audioEvents();
  const rainEnd = events.find(e => e.action === 'stop' && e.loop)!;
  const fireworkStart = events.find(e => e.action === 'start' && !e.loop)!;
  expect(fireworkStart.time).toBeGreaterThanOrEqual(rainEnd.time);
  await expect(canvas(page)).toHaveCount(1);

  await expect(canvas(page)).toHaveCSS('opacity', '1');
  await rain.click();
  await firework.click();
  await rain.click();
  await expect(activeEffect(page)).toHaveText('Rain Aura');
  await expect(canvas(page)).toHaveCSS('opacity', '1');
  await expect(activeEffect(page)).toHaveText('Rain Aura');
});

test('manual previews own the stage, then confirmed smile and laugh can switch both ways', async ({page}, info) => {
  test.skip(info.project.name !== 'desktop-1440x900');
  await emulateExpressions(page);
  await openStage(page);
  await page.getByRole('button', {name:'Start Camera', exact:true}).click();
  await expect(page.getByText('Camera on', {exact:true})).toBeVisible();
  await page.getByRole('button', {name:'Preview Rain Aura'}).click();
  await expect(canvas(page)).toHaveCSS('opacity', '1');
  const expression = (value: string) => page.evaluate(v => { document.documentElement.dataset.testExpression = v; }, value);
  await expression('LAUGH');
  await expect(page.locator('.expression-row strong')).toHaveText('LAUGH');
  await expect(activeEffect(page)).toHaveText('Rain Aura');
  await expect(page.getByText('Laugh detected', {exact: true})).toHaveCount(0);
  await expect(activeEffect(page)).toHaveText('Firework Party', {timeout: 9500});
  await expression('SMILE');
  await expect(page.locator('.expression-row strong')).toHaveText('SMILE');
  await expect(activeEffect(page)).toHaveText('Rain Aura', {timeout: 5000});
  await expression('LAUGH');
  await expect(activeEffect(page)).toHaveText('Firework Party', {timeout: 5000});
  await expression('SMILE');
  await expect(activeEffect(page)).toHaveText('Rain Aura', {timeout: 5000});
  await expect(canvas(page)).toHaveCount(1);
});
