import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for E2E tests
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:61969',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Run local dev server before tests
  webServer: {
    command: 'php -S localhost:61969 2>&1 | grep -v "^\\[.*\\] \\[200\\]: GET " | grep -v "^\\[.*\\] Accepted$" | grep -v "^\\[.*\\] Closing$"',
    url: 'http://localhost:61969',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
