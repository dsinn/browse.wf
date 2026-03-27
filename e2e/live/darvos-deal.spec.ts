import {test, expect} from '@playwright/test';
import {setupMockRoutes} from '../helpers/api-mocks';
import {expiryBadge} from './helpers';

// Darvo deal in mock worldState:
// Activation: 1768129200000 (2026-01-11T11:00:00Z)
// Expiry:     1768222800000 (2026-01-12T13:00:00Z)
// Must freeze time within this window for the deal to render
const DARVO_ACTIVE_TIMESTAMP = 1_768_135_860_000; // 2026-01-11T12:51:00Z — inside active window

test.describe('Darvo\'s Deal', () => {
	test('shows active deal with pricing and stock', async ({page}) => {
		await setupMockRoutes(page, {frozenTime: DARVO_ACTIVE_TIMESTAMP});
		await page.goto('/live.php');
		await page.waitForSelector('#darvo-header .badge[data-expiry]', {timeout: 10_000});

		await expect(expiryBadge(page.locator('#darvo-header'))).toBeVisible();
		await expect(page.locator('#darvo-discount')).toHaveText('20');
		await expect(page.locator('#darvo-price')).toHaveText('180');
		await expect(page.locator('#darvo-ogprice')).toHaveText('225');
		await expect(page.locator('#darvo-stock')).toHaveText('84/100');
	});
});
