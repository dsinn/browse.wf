import {test, expect} from '@playwright/test';
import {setupMockRoutes} from '../helpers/api-mocks';
import {expiryBadge} from './helpers';

test.describe('Live Page - Archon Hunt Card', () => {
	test.beforeEach(async ({page}) => {
		await setupMockRoutes(page);

		await page.goto('/live');
		await page.waitForSelector('#arby-what:not(:has-text("Loading..."))', {timeout: 10_000});
	});

	test('displays boss and missions', async ({page}) => {
		await page.waitForSelector('#litesortie-body span', {timeout: 10_000});

		const body = page.locator('#litesortie-body');
		await expect(body).toHaveText('Nira • Rescue, Interception, Assassination');
	});

	test('header displays expiry badge and completion toggle', async ({page}) => {
		await page.waitForSelector('#litesortie-header .badge[data-expiry]', {timeout: 10_000});

		await expect(expiryBadge(page.locator('#litesortie-header'))).toBeVisible();

		const completionToggle = page.locator('#litesortie-header a.completion-check');
		await expect(completionToggle).toBeVisible();
	});
});
