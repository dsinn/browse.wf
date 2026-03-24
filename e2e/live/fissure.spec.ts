import {test, expect} from '@playwright/test';
import {setupMockRoutes} from '../helpers/api-mocks';

// Timestamp within the mock worldState's fissure active window (Jan 11 2026 12:51 UTC)
const FISSURE_ACTIVE_TIMESTAMP = 1_768_135_860_000;

test.describe('Fissures (/live)', () => {
	test.beforeEach(async ({page}) => {
		await setupMockRoutes(page, {frozenTime: FISSURE_ACTIVE_TIMESTAMP});
		await page.goto('/live.php');
		await page.waitForSelector('#fissures-table tbody tr:not(:has-text("Loading..."))', {timeout: 10_000});
	});

	test('renders fissure rows with tier labels', async ({page}) => {
		const rows = page.locator('#fissures-table tbody tr');
		await expect(rows).not.toHaveCount(0);

		// At least one tier heading should be a known label
		const headings = page.locator('#fissures-table tbody tr th');
		await expect(headings.first()).toContainText(/Lith|Meso|Neo|Axi|Requiem|Omnia/u);
	});

	test('each fissure row has a mission name and location', async ({page}) => {
		const rows = page.locator('#fissures-table tbody tr');
		const count = await rows.count();
		expect(count).toBeGreaterThan(0);

		// Check first data row (skip heading-only rows by looking for rows with ≥3 tds)
		const firstDataRow = page.locator('#fissures-table tbody tr:has(td ~ td ~ td)').first();
		await expect(firstDataRow.locator('td').nth(1)).not.toBeEmpty();
		await expect(firstDataRow.locator('td').last()).toContainText(',');
	});
});
