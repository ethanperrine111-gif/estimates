// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const PORT = 4173;

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      // iPhone-sized viewport, but on Chromium (the app's main target is iOS Safari;
      // Chromium is what's installed locally and in CI).
      name: 'iphone-chromium',
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
        defaultBrowserType: 'chromium',
      },
    },
  ],
  webServer: {
    command: 'node tests/server.js',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT) },
  },
});
