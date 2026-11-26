import { defineConfig } from '@playwright/test';

const externalPreview = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: externalPreview ?? 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    launchOptions: {
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    },
  },
  projects: [
    { name: 'desktop-1440x900', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'desktop-1920x1080', use: { viewport: { width: 1920, height: 1080 } } },
    { name: 'mobile-390x844', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: externalPreview ? undefined : {
    command: 'node ./node_modules/vite/bin/vite.js preview --host 127.0.0.1',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});
