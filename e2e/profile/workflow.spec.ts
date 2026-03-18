import * as path from 'node:path';
import * as fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {test, expect} from '@playwright/test';
import {setupMockRoutes} from '../helpers/api-mocks';
import {TEST_FRONT_PROXY_BASE_URL} from '../../test/helpers/test-constants';

// ES module __dirname polyfill
const __filename = fileURLToPath(import.meta.url); // eslint-disable-line @typescript-eslint/naming-convention
const __dirname = path.dirname(__filename); // eslint-disable-line @typescript-eslint/naming-convention

const proxyHost = new URL(TEST_FRONT_PROXY_BASE_URL).host;
const profileData = JSON.parse(fs.readFileSync(path.join(__dirname, '../../test/profile/getProfileViewingData.html'), 'utf8'));

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
 * Tests the happy path for uploading and viewing a profile through the step-by-step workflow.
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

		// Grant clipboard permissions so copyWarframePath() works in tests
		await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
	});

	test('completes full workflow with EE.log upload', async ({page}) => {
		await page.goto('/profile.php');

		// Verify initial state — account ID step not yet visible, platform not selected
		await expect(page.locator('text=Provide your account ID')).toBeHidden();
		await expect(page.locator('#step1-container')).not.toHaveClass(/complete/u);

		// Step 1: Select platform — reveals account ID step
		await page.selectOption('#platform-select', 'pc');
		await expect(page.locator('#step1-container')).toHaveClass(/complete/u);
		await expect(page.locator('text=Provide your account ID')).toBeVisible();

		// Step 2: Upload EE.log — auto-fetch via proxy
		const eeLogPath = path.join(__dirname, '../../test/profile/EE.log');
		await page.setInputFiles('#ee-log-file', eeLogPath);

		// Profile renders; manual download step and cached data notice are not shown
		await expect(page.locator('#profile-name')).toContainText('AerodynamicHead', {timeout: 5000});
		await expect(page.getByRole('link', {name: /Save Link As/u})).toBeHidden();
		await expect(page.locator('text=Showing cached profile')).toBeHidden();

		// Verify profile tabs are clickable
		await page.click('a[data-tab="syndicates"]');
		await expect(page.locator('#syndicates')).toBeVisible();

		await page.click('a[data-tab="missions"]');
		await expect(page.locator('#missions')).toBeVisible();
	});

	test('persists profile data in localStorage after EE.log auto-fetch', async ({page}) => {
		await page.goto('/profile.php');

		await page.selectOption('#platform-select', 'pc');

		const eeLogPath = path.join(__dirname, '../../test/profile/EE.log');
		await page.setInputFiles('#ee-log-file', eeLogPath);

		// Wait for profile to load and localStorage to be written
		await expect(page.locator('#step2-container')).toHaveClass(/complete/u, {timeout: 5000});

		// Check localStorage has profile data and metadata
		const savedProfileData = await page.evaluate(() => localStorage.getItem('profile.data'));
		const platform = await page.evaluate(() => localStorage.getItem('profile.platform'));
		const accountId = await page.evaluate(() => localStorage.getItem('profile.accountId'));
		const dataFetchedAt = await page.evaluate(() => localStorage.getItem('profile.dataFetchedAt'));
		const nextFetchAvailableAt = await page.evaluate(() => localStorage.getItem('profile.nextFetchAvailableAt'));

		expect(savedProfileData).toBeTruthy();
		expect(platform).toBe('pc');
		expect(accountId).toBe('55540360384632532d7b23c6');
		expect(dataFetchedAt).toBeTruthy();
		expect(nextFetchAvailableAt).toBeTruthy();

		// Reload page
		await page.reload();

		// Profile should auto-load from localStorage
		await expect(page.locator('#profile-nav')).toBeVisible({timeout: 10_000});
		await expect(page.locator('#profile-name')).toContainText('AerodynamicHead');

		// Platform should be restored
		await expect(page.locator('#platform-select')).toHaveValue('pc');
	});

	test('auto-loads profile from localStorage on page load', async ({page}) => {
		// First, set up localStorage with profile data
		await page.goto('/profile.php');
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
		await page.goto('/profile.php');
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

		await page.goto('/profile.php');
		await page.selectOption('#platform-select', 'pc');
		await page.click('button:has-text("Click Me")');

		const eeLogPath = path.join(__dirname, '../../test/profile/EE.log');
		await page.setInputFiles('#ee-log-file', eeLogPath);

		// Wait for the fetch to fail (status message updates)
		await expect(page.locator('#status span')).toContainText('Failed to fetch', {timeout: 5000});

		// Step 2 should not be complete
		await expect(page.locator('#step2-container')).not.toHaveClass(/complete/u);
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
		await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
	});

	test('shows manual download/upload steps after EE.log upload', async ({page}) => {
		await page.goto('/profile.php');
		await page.selectOption('#platform-select', 'pc');

		const eeLogPath = path.join(__dirname, '../../test/profile/EE.log');
		await page.setInputFiles('#ee-log-file', eeLogPath);

		// Manual flow: download link should appear; Fetch Profile button should not
		await expect(page.getByRole('link', {name: /Save Link As/u})).toBeVisible({timeout: 5000});
		await expect(page.locator('button:has-text("Fetch Profile")')).toBeHidden();
	});

	test('EE.log upload does not trigger a proxy call when unauthenticated and account ID is already stored', async ({page}) => {
		let proxyCalled = false;
		await page.route(`**/${proxyHost}/profile*`, route => {
			proxyCalled = true;
			void route.fulfill({status: 200, contentType: 'application/json', body: wrappedProfileResponse()});
		});

		await page.goto('/profile.php');
		await page.evaluate(() => {
			localStorage.setItem('profile.platform', 'pc');
			localStorage.setItem('profile.accountId', '55540360384632532d7b23c6');
			localStorage.setItem('profile.data', JSON.stringify({
				Results: [{DisplayName: 'TestUser', PlayerLevel: 30, AccountId: {$oid: '55540360384632532d7b23c6'}}],
			}));
		});

		await page.reload();

		// Ensure no proxy call is triggered just from seeing the alert or loading the page
		expect(proxyCalled).toBe(false);
	});

	test('EE.log upload does not auto-fetch via proxy when unauthenticated', async ({page}) => {
		let proxyCalled = false;
		await page.route(`**/${proxyHost}/profile*`, route => {
			proxyCalled = true;
			void route.fulfill({status: 200, contentType: 'application/json', body: wrappedProfileResponse()});
		});

		await page.goto('/profile.php');
		await page.selectOption('#platform-select', 'pc');

		const eeLogPath = path.join(__dirname, '../../test/profile/EE.log');
		await page.setInputFiles('#ee-log-file', eeLogPath);

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
		await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
	});

	test('shows rate limit notice with time remaining', async ({page}) => {
		await page.goto('/profile.php');
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
		await page.goto('/profile.php');
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
		await page.goto('/profile.php');
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

	test('EE.log upload does not trigger proxy fetch when rate-limited', async ({page}) => {
		let proxyCalled = false;
		await page.route(`**/${proxyHost}/profile*`, route => {
			proxyCalled = true;
			void route.fulfill({status: 200, contentType: 'application/json', body: wrappedProfileResponse()});
		});

		await page.goto('/profile.php');
		await page.evaluate(ts => {
			localStorage.setItem('profile.nextFetchAvailableAt', ts.toString());
		}, FUTURE_TIMESTAMP);

		await page.reload();
		await page.selectOption('#platform-select', 'pc');

		const eeLogPath = path.join(__dirname, '../../test/profile/EE.log');
		await page.setInputFiles('#ee-log-file', eeLogPath);

		// Manual download step should appear without the proxy being called
		await expect(page.getByRole('link', {name: /Save Link As/u})).toBeVisible({timeout: 5000});
		expect(proxyCalled).toBe(false);
	});
});

test.describe('Profile Workflow - 429 Fallback', () => {
	test.beforeEach(async ({page}) => {
		await setupMockRoutes(page);
		await simulateLoggedIn(page);
		await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
	});

	test('switches to manual flow when proxy returns 429', async ({page}) => {
		// Override proxy to return 429
		await page.route(`**/${proxyHost}/profile*`, route => {
			void route.fulfill({status: 429, body: 'Too Many Requests'});
		});

		await page.goto('/profile.php');
		await page.selectOption('#platform-select', 'pc');

		const eeLogPath = path.join(__dirname, '../../test/profile/EE.log');
		await page.setInputFiles('#ee-log-file', eeLogPath);

		// Manual download step should appear
		await expect(page.getByRole('link', {name: /Save Link As/u})).toBeVisible({timeout: 5000});
	});

	test('does not render profile data from proxy on 429', async ({page}) => {
		await page.route(`**/${proxyHost}/profile*`, route => {
			void route.fulfill({status: 429, body: 'Too Many Requests'});
		});

		await page.goto('/profile.php');
		await page.selectOption('#platform-select', 'pc');

		const eeLogPath = path.join(__dirname, '../../test/profile/EE.log');
		await page.setInputFiles('#ee-log-file', eeLogPath);

		// Manual download step should appear and no profile data from proxy should have been rendered
		await expect(page.getByRole('link', {name: /Save Link As/u})).toBeVisible({timeout: 5000});
		await expect(page.locator('#profile-name')).not.toContainText('AerodynamicHead');
	});
});
