import {test, expect} from '@playwright/test';
import {setupMockRoutes, MOCK_TIMESTAMP} from '../helpers/api-mocks';
import {expiryBadge} from './helpers';

test.describe('Baro Ki\'Teer (Void Trader)', () => {
	test.describe('when present', () => {
		// Baro is present in the default worldState mock:
		// Activation: 1767967200000 (2026-01-09T14:00:00Z)
		// Expiry:     1768140000000 (2026-01-11T14:00:00Z)
		// MOCK_TIMESTAMP falls inside this window.
		test.beforeEach(async ({page}) => {
			await setupMockRoutes(page, {frozenTime: MOCK_TIMESTAMP});
			await page.goto('/live');
			await page.waitForSelector('#baro-table tbody tr', {timeout: 10_000});
		});

		test('shows inventory panel and hides arrival notice', async ({page}) => {
			await expect(page.locator('#baro-soon')).toHaveClass(/d-none/u);
			await expect(page.locator('#baro-now')).not.toHaveClass(/d-none/u);
			const rows = page.locator('#baro-table tbody tr');
			await expect(rows).not.toHaveCount(0);
			await expect(rows.first().locator('td')).toHaveCount(3);
			await expect(expiryBadge(page.locator('#baro-header'))).toBeVisible();
		});
	});

	test.describe('when absent', () => {
		// The worldState-baro-absent.json mock has no Manifest; Baro is between visits.
		// Next activation: 1775221200000 (2026-04-03T13:00:00Z)
		test.beforeEach(async ({page}) => {
			await setupMockRoutes(page, {worldStateFile: 'worldState-baro-absent.json', frozenTime: MOCK_TIMESTAMP});
			await page.goto('/live');
			await page.waitForSelector('.baro-where:visible', {timeout: 10_000});
		});

		test('shows arrival notice and hides inventory panel', async ({page}) => {
			await expect(page.locator('#baro-now')).toHaveClass(/d-none/u);
			await expect(page.locator('#baro-soon')).not.toHaveClass(/d-none/u);
			await expect(page.locator('#baro-soon .baro-where')).not.toBeEmpty();
			await expect(expiryBadge(page.locator('#baro-header'))).toBeVisible();
		});
	});
});
