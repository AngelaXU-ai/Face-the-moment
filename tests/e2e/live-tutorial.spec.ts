import { expect, test } from '@playwright/test';

test('first visit coach marks are informational, dismissible, and replayable', async ({ page }, info) => {
  await page.addInitScript(() => {
    Object.assign(window, { cameraRequested: false });
    navigator.mediaDevices.getUserMedia = async () => {
      Object.assign(window, { cameraRequested: true });
      throw new Error('Camera must stay off during the tutorial');
    };
  });
  await page.goto('/');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', {name: 'Live Preview'})).toBeVisible();
  await expect(dialog.getByRole('button', {name: 'Back'})).toBeDisabled();
  await expect(page.locator('.live-tutorial-spot')).toBeVisible();
  const backgroundCamera = page.locator('.camera-empty button');
  const cameraBox = (await backgroundCamera.boundingBox())!;
  await page.mouse.click(cameraBox.x + cameraBox.width / 2, cameraBox.y + cameraBox.height / 2);
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', {name: 'Next'}).click();
  await expect(dialog.getByRole('heading', {name: 'Live Controls'})).toBeVisible();
  if (info.project.name.startsWith('mobile')) await expect(page.locator('.interaction-panel')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  await dialog.getByRole('button', {name: 'Back'}).click();
  await expect(dialog.getByText('Step 1 / 4')).toBeVisible();
  await dialog.getByRole('button', {name: 'Next'}).click();
  await expect(dialog.getByText('Step 2 / 4')).toBeVisible();
  await dialog.getByRole('button', {name: 'Next'}).click();
  await expect(dialog.getByRole('heading', {name: 'Effects Library'})).toBeVisible();
  await dialog.getByRole('button', {name: 'Next'}).click();
  await expect(dialog.getByRole('heading', {name: 'Quick Actions'})).toBeVisible();
  await dialog.getByRole('button', {name: 'Start Exploring'}).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => Reflect.get(window, 'cameraRequested'))).toBe(false);
  await page.reload();
  await expect(dialog).toHaveCount(0);
  if (info.project.name.startsWith('mobile')) await page.getByRole('button', {name: 'Open live controls'}).click();
  await page.getByText('Debug', {exact: true}).click();
  await page.getByRole('button', {name: 'Replay tutorial'}).click();
  await expect(dialog.getByText('Step 1 / 4')).toBeVisible();
  await dialog.getByRole('button', {name: 'Skip'}).click();
  await expect(dialog).toHaveCount(0);
});
