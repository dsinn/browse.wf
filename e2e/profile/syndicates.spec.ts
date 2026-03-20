import {test, expect} from '@playwright/test';
import {setupMockRoutes} from '../helpers/api-mocks';

/**
 * E2E tests for the syndicates tab on /profile.php.
 *
 * Uses the auto-loaded [DE]Rebecca demo profile.
 */

test.describe('Syndicates tab (/profile.php)', () => {
	test.beforeEach(async ({page}) => {
		await setupMockRoutes(page);
		await page.goto('/profile.php');
		await page.waitForSelector('#profile-nav:not(.d-none)', {timeout: 10_000});
		await page.click('a[data-tab="syndicates"]');
		await page.waitForSelector('#syndicates:not(.d-none)');
	});

	test('each card has a logo, name, rank, and standing', async ({page}) => {
		const cards = page.locator('#syndicates .card');
		await expect(cards).not.toHaveCount(0);

		for (const card of await cards.all()) {
			await expect(card.locator('img')).toBeVisible();
			await expect(card.locator('h5.card-title')).not.toBeEmpty();
			await expect(card.locator('h6.card-subtitle')).toContainText('Rank');
			await expect(card.locator('p.card-text')).toContainText('Standing:');
		}
	});

	test('most cards have a progress bar', async ({page}) => {
		const cards = page.locator('#syndicates .card');
		const bars = page.locator('#syndicates .card .progress');
		const cardCount = await cards.count();
		const barCount = await bars.count();
		expect(barCount).toBeGreaterThanOrEqual(Math.floor(cardCount * 3 / 4));
	});
});
