import * as path from 'node:path';
import * as fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {test, expect} from '@playwright/test';
import {setupMockRoutes} from '../helpers/api-mocks';
import {TEST_FRONT_PROXY_BASE_URL} from '../../test/helpers/test-constants';

// ES module __dirname polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const proxyHost = new URL(TEST_FRONT_PROXY_BASE_URL).host;
const profileData = JSON.parse(fs.readFileSync(path.join(__dirname, '../../test/profile/getProfileViewingData.html'), 'utf8'));

async function selectPlatform(page: any, platform = 'pc') {
	await expect(page.locator('#steps')).toBeVisible();
	await page.selectOption('#platform-select', platform);
}

async function enterAccountId(page: any, accountId = '55540360384632532d7b23c6') {
	await page.fill('#account-id', accountId);
	await page.dispatchEvent('#account-id', 'input');
}

// Wrapped response shape used by the front proxy when rate limiting is configured
function wrappedProfileResponse(data = profileData) {
	return JSON.stringify({
		nextFetchAvailableAt: new Date(Date.now() + (23 * 60 * 60 * 1000)).toUTCString(),
		profile: data,
	});
}

/**
 * Simulates a completed cloud sync (logged-in state) so that showAutoFetchFlow is true.
 *
 * Intercepts any cloud-sync-* event dispatched by auth-init.ts and replaces it with
 * cloud-sync-complete. This wins the { once: true } race regardless of which event
 * auth-init.ts fires (unauthenticated, unavailable, etc.).
 */
async function simulateLoggedIn(page: any) {
	await page.addInitScript(() => {
		const original = window.dispatchEvent.bind(globalThis);
		window.dispatchEvent = function (event: Event) {
			if (event.type.startsWith('cloud-sync-') && event.type !== 'cloud-sync-complete') {
				return original(new CustomEvent('cloud-sync-complete'));
			}

			return original(event);
		};
	});
}

/**
 * E2E tests for Profile Viewer workflow
 *
 * Tests the happy path for entering an account ID and viewing a profile through the step-by-step workflow.
 */

test.describe('Profile Workflow - Happy Path (logged in, not rate-limited)', () => {
	test.beforeEach(async ({page}) => {
		// Mock API responses for deterministic, fast, offline-capable tests
		await setupMockRoutes(page);

		// Simulate logged-in state so auto-fetch flow is used
		await simulateLoggedIn(page);

		// Mock the front proxy profile endpoint with wrapped response
		await page.route(`**/${proxyHost}/profile*`, route => {
			void route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: wrappedProfileResponse(),
			});
		});
	});

	test('auto-loads profile from localStorage on page load', async ({page}) => {
		// First, set up localStorage with profile data
		await page.goto('/profile');
		await page.evaluate(() => {
			localStorage.setItem('profile.data', JSON.stringify({
				Results: [{
					DisplayName: 'TestUser',
					PlayerLevel: 30,
					AccountId: {$oid: '507f1f77bcf86cd799439011'},
				}],
			}));
		});

		// Reload to trigger auto-load
		await page.reload();

		// Wait for profile to load from localStorage
		await expect(page.locator('#profile-nav')).toBeVisible({timeout: 10_000});
		await expect(page.locator('#profile-name')).toContainText('TestUser');

		// Step 2 not complete (not completed via workflow)
		await expect(page.locator('#step2-container')).not.toHaveClass(/complete/u);

		// Refresh alert should not be shown (no stored account ID)
		await expect(page.locator('text=Showing cached profile')).toBeHidden();
	});

	test('shows refresh alert when localStorage has account ID', async ({page}) => {
		await page.goto('/profile');
		await page.evaluate(() => {
			localStorage.setItem('profile.platform', 'pc');
			localStorage.setItem('profile.accountId', '55540360384632532d7b23c6');
			localStorage.setItem('profile.data', JSON.stringify({
				Results: [{
					DisplayName: 'TestUser',
					PlayerLevel: 30,
					AccountId: {$oid: '55540360384632532d7b23c6'},
				}],
			}));
		});

		await page.reload();

		// Cached data notice and Fetch Profile button should both be visible
		await expect(page.locator('text=Showing cached profile')).toBeVisible();
		await expect(page.locator('button:has-text("Fetch Profile")')).toBeVisible({timeout: 5000});

		// Clicking Fetch Profile should re-fetch, update, and hide the cached notice
		await page.click('button:has-text("Fetch Profile")');
		await expect(page.locator('#profile-name')).toContainText('AerodynamicHead', {timeout: 5000});
		await expect(page.locator('text=Showing cached profile')).toBeHidden();
	});

	test('shows error status when proxy fails', async ({page}) => {
		// Override proxy mock to return an error
		await page.route(`**/${proxyHost}/profile*`, route => {
			void route.fulfill({status: 500, body: 'error'});
		});

		await page.goto('/profile');
		await selectPlatform(page);
		await enterAccountId(page);
		await page.click('button:has-text("Fetch Profile")');

		await expect(page.locator('#status span')).toContainText('Failed to fetch', {timeout: 5000});
	});
});

test.describe('Profile Workflow - Unauthenticated', () => {
	test.beforeEach(async ({page}) => {
		await setupMockRoutes(page);
		// Do NOT simulate logged-in — cloud sync will resolve as 'unauthenticated'
		await page.addInitScript(() => {
			globalThis.addEventListener('DOMContentLoaded', () => {
				globalThis.dispatchEvent(new CustomEvent('cloud-sync-unauthenticated'));
			});
		});
	});

	test('shows manual download steps after entering account ID', async ({page}) => {
		await page.goto('/profile');
		await selectPlatform(page);
		await enterAccountId(page);

		// Manual flow: download link should appear; Fetch Profile button should not
		await expect(page.getByRole('link', {name: /Save Link As/u})).toBeVisible({timeout: 5000});
		await expect(page.locator('button:has-text("Fetch Profile")')).toBeHidden();
	});

	test('does not trigger a proxy call when account ID is already stored', async ({page}) => {
		let proxyCalled = false;
		await page.route(`**/${proxyHost}/profile*`, route => {
			proxyCalled = true;
			void route.fulfill({status: 200, contentType: 'application/json', body: wrappedProfileResponse()});
		});

		await page.goto('/profile');
		await page.evaluate(() => {
			localStorage.setItem('profile.platform', 'pc');
			localStorage.setItem('profile.accountId', '55540360384632532d7b23c6');
			localStorage.setItem('profile.data', JSON.stringify({
				Results: [{DisplayName: 'TestUser', PlayerLevel: 30, AccountId: {$oid: '55540360384632532d7b23c6'}}],
			}));
		});

		await page.reload();

		expect(proxyCalled).toBe(false);
	});

	test('does not auto-fetch via proxy when unauthenticated', async ({page}) => {
		let proxyCalled = false;
		await page.route(`**/${proxyHost}/profile*`, route => {
			proxyCalled = true;
			void route.fulfill({status: 200, contentType: 'application/json', body: wrappedProfileResponse()});
		});

		await page.goto('/profile');
		await selectPlatform(page);
		await enterAccountId(page);

		// Manual download step should appear without the proxy being called
		await expect(page.getByRole('link', {name: /Save Link As/u})).toBeVisible({timeout: 5000});
		expect(proxyCalled).toBe(false);
	});
});

test.describe('Profile Workflow - Rate Limited', () => {
	const FUTURE_TIMESTAMP = Date.now() + (21 * 60 * 60 * 1000); // 21 hours from now

	test.beforeEach(async ({page}) => {
		await setupMockRoutes(page);
		await simulateLoggedIn(page);
	});

	test('shows rate limit notice with time remaining', async ({page}) => {
		await page.goto('/profile');
		await page.evaluate(ts => {
			localStorage.setItem('profile.nextFetchAvailableAt', ts.toString());
			localStorage.setItem('profile.platform', 'pc');
			localStorage.setItem('profile.accountId', '55540360384632532d7b23c6');
			localStorage.setItem('profile.data', JSON.stringify({
				Results: [{DisplayName: 'TestUser', PlayerLevel: 30, AccountId: {$oid: '55540360384632532d7b23c6'}}],
			}));
		}, FUTURE_TIMESTAMP);

		await page.reload();

		await expect(page.locator('text=Rate limited. Next fetch available in')).toBeVisible({timeout: 5000});
	});

	test('does not show Fetch Profile button when rate-limited', async ({page}) => {
		await page.goto('/profile');
		await page.evaluate(ts => {
			localStorage.setItem('profile.nextFetchAvailableAt', ts.toString());
			localStorage.setItem('profile.platform', 'pc');
			localStorage.setItem('profile.accountId', '55540360384632532d7b23c6');
			localStorage.setItem('profile.data', JSON.stringify({
				Results: [{DisplayName: 'TestUser', PlayerLevel: 30, AccountId: {$oid: '55540360384632532d7b23c6'}}],
			}));
		}, FUTURE_TIMESTAMP);

		await page.reload();

		await expect(page.locator('button:has-text("Fetch Profile")')).toBeHidden({timeout: 5000});
	});

	test('shows manual download steps as fallback when rate-limited', async ({page}) => {
		await page.goto('/profile');
		await page.evaluate(ts => {
			localStorage.setItem('profile.nextFetchAvailableAt', ts.toString());
			localStorage.setItem('profile.platform', 'pc');
			localStorage.setItem('profile.accountId', '55540360384632532d7b23c6');
			localStorage.setItem('profile.data', JSON.stringify({
				Results: [{DisplayName: 'TestUser', PlayerLevel: 30, AccountId: {$oid: '55540360384632532d7b23c6'}}],
			}));
		}, FUTURE_TIMESTAMP);

		await page.reload();

		// Manual download step should be visible as fallback
		await expect(page.getByRole('link', {name: /Save Link As/u})).toBeVisible({timeout: 5000});
	});
});

test.describe('Profile Workflow - 429 Fallback', () => {
	test.beforeEach(async ({page}) => {
		await setupMockRoutes(page);
		await simulateLoggedIn(page);
	});

	test('switches to manual flow when proxy returns 429', async ({page}) => {
		await page.route(`**/${proxyHost}/profile*`, route => {
			void route.fulfill({status: 429, body: 'Too Many Requests'});
		});

		await page.goto('/profile');
		await selectPlatform(page);
		await enterAccountId(page);
		await page.click('button:has-text("Fetch Profile")');

		await expect(page.getByRole('link', {name: /Save Link As/u})).toBeVisible({timeout: 5000});
	});

	test('does not render profile data from proxy on 429', async ({page}) => {
		await page.route(`**/${proxyHost}/profile*`, route => {
			void route.fulfill({status: 429, body: 'Too Many Requests'});
		});

		await page.goto('/profile');
		await selectPlatform(page);
		await enterAccountId(page);
		await page.click('button:has-text("Fetch Profile")');

		await expect(page.getByRole('link', {name: /Save Link As/u})).toBeVisible({timeout: 5000});
		await expect(page.locator('#profile-name')).not.toContainText('AerodynamicHead');
	});
});
