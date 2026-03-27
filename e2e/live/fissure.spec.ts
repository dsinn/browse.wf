import {test, expect} from '@playwright/test';
import {setupMockRoutes} from '../helpers/api-mocks';

// Timestamp within the mock worldState's fissure and void storm active windows (Jan 11 2026 12:51 UTC)
const FISSURE_ACTIVE_TIMESTAMP = 1_768_135_860_000;

test.describe('Fissures (/live)', () => {
	test.beforeEach(async ({page}) => {
		await setupMockRoutes(page, {frozenTime: FISSURE_ACTIVE_TIMESTAMP});
		await page.goto('/live.php');
		await page.waitForSelector('#fissures-table tbody tr:not(:has-text("Loading..."))', {timeout: 10_000});
	});

	test('renders fissure rows with tier labels', async ({page}) => {
		await expect(page.locator('#fissures-table tbody tr')).not.toHaveCount(0);

		const headings = await page.locator('#fissures-table tbody tr th').allTextContents();
		const tierLabels = headings.filter(h => h !== '');

		const TIER_LABEL = /^(?:Lith|Meso|Neo|Axi|Requiem|Omnia)$/u;
		for (const label of tierLabels) {
			expect(label).toMatch(TIER_LABEL);
		}

		expect(new Set(tierLabels).size).toBe(tierLabels.length);
	});

	test('each fissure row has a mission name', async ({page}) => {
		await expect(page.locator('#fissures-table tbody tr')).not.toHaveCount(0);

		// Check first data row (skip heading-only rows by looking for rows with ≥3 tds)
		const firstDataRow = page.locator('#fissures-table tbody tr:has(td ~ td ~ td)').first();
		await expect(firstDataRow.locator('td').nth(1)).not.toBeEmpty();
	});
});

test.describe('Void Storms (Railjack Fissures)', () => {
	test.beforeEach(async ({page}) => {
		await setupMockRoutes(page, {frozenTime: FISSURE_ACTIVE_TIMESTAMP});
		await page.goto('/live.php');
		await page.waitForSelector('#rj-fissures-table tbody tr', {timeout: 10_000});
	});

	test('tier filter checkbox hides matching rows', async ({page}) => {
		const initialCount = await page.locator('#rj-fissures-table tbody tr:visible').count();
		expect(initialCount).toBeGreaterThan(0);

		await page.locator('[data-filter-toggle="rj-fissures"]').click();
		await page.locator('#rj-fissures-filters input[type=checkbox][data-filter-type="VoidT1"]').uncheck();

		await expect(page.locator('#rj-fissures-table tbody tr:visible')).not.toHaveCount(initialCount);
	});
});
