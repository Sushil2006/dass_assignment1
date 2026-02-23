const { defineConfig, devices } = require('@playwright/test');

const frontendPort = process.env.FRONTEND_PORT || '4173';
const baseURL = process.env.BASE_URL || `http://127.0.0.1:${frontendPort}`;
const headless = String(process.env.PW_HEADLESS || 'true') !== 'false';
const retries = Number(process.env.PW_RETRIES || '0');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries,
  reporter: [['line']],
  use: {
    baseURL,
    headless,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7'] },
    },
  ],
});
