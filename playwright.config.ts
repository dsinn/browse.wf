import process from 'node:process';
import {defineConfig, devices} from '@playwright/test';

/**
 * Playwright configuration for E2E tests
 */
export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	reporter: 'html',
	globalSetup: './e2e/global-setup.ts',
	use: {
		baseURL: 'http://localhost:61969',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
	},

	projects: [
		{
			name: 'chromium',
			use: {...devices['Desktop Chrome']},
		},
	],

	// Run Vite dev server before tests (serves pre-rendered HTML from public/)
	webServer: {
		command: 'vite --config vitest.config.ts --port 61969',
		port: 61969, // eslint-disable-line unicorn/numeric-separators-style
		reuseExistingServer: !process.env.CI,
		timeout: 42_069,
	},
});
