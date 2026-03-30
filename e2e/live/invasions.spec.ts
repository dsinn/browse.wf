import {test, expect, type Page} from '@playwright/test';
import {setupMockRoutes, mockExportData} from '../helpers/api-mocks';

test.describe('Live Page - Invasions Card', () => {
	// Wait for actual invasion data rows to appear (not the "Loading..." placeholder)
	async function waitForInvasionsTable(page: Page) {
		await page.waitForSelector('#invasions-table tbody tr:visible:not(:has-text("Loading..."))', {timeout: 10_000});
	}

	test.beforeEach(async ({page}) => {
		await setupMockRoutes(page);
		await page.goto('/live');
		await page.evaluate(() => {
			localStorage.clear();
		});
	});

	test('renders invasion rows end-to-end', async ({page}) => {
		await page.goto('/live');
		await waitForInvasionsTable(page);
		expect(await page.locator('#invasions-table tbody tr:visible').count()).toBeGreaterThan(0);
	});

	test('unchecking a reward filter hides rows and re-checking restores them', async ({page}) => {
		await setupMockRoutes(page, {worldStateFile: 'worldState-invasions.json'});
		await page.goto('/live');
		await waitForInvasionsTable(page);

		const rowsBefore = await page.locator('#invasions-table tbody tr:visible').count();

		await page.locator('[data-filter-toggle="invasions"]').click();
		await page.locator('#filter-invasions-reward-KarakWraith').uncheck();
		await expect(page.locator('#invasions-table tbody tr:visible')).not.toHaveCount(rowsBefore);

		await page.locator('#filter-invasions-reward-KarakWraith').check();
		await expect(page.locator('#invasions-table tbody tr:visible')).toHaveCount(rowsBefore);
	});

	test.describe('with invasions world state', () => {
		test.beforeEach(async ({page}) => {
			await setupMockRoutes(page, {worldStateFile: 'worldState-invasions.json'});
			await mockExportData(page, ['ExportImages']);
			await page.goto('/live');
			await waitForInvasionsTable(page);
		});

		test('percentage cell has activation tooltip with elapsed time and run count', async ({page}) => {
			const tooltip = await page.locator('#invasions-table .invasion-percentage').filter({hasText: /\d+\.\d+%/u}).nth(1).getAttribute('data-bs-title');
			expect(tooltip).toMatch(/Up since .+ \(15h.50m.ago\); 26,000.runs.left/u);
		});

		test('percentage cell shows days for invasions up over 24 hours', async ({page}) => {
			const tooltip = await page.locator('#invasions-table .invasion-percentage').filter({hasText: /\d+\.\d+%/u}).nth(0).getAttribute('data-bs-title');
			expect(tooltip).toMatch(/Up since .+ \(2d.4h.19m.ago\); 18,000.runs.left/u);
		});

		test('node header has tileset tooltip', async ({page}) => {
			const labelSpan = page.locator('#invasions-table th').first().locator('span[data-bs-title]');
			await expect(labelSpan).toHaveAttribute('data-bs-title', 'Grineer Asteroid');
		});
	});
});
