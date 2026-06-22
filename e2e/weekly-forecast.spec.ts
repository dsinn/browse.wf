import {test, expect, type Page} from '@playwright/test';
import {setupMockRoutes} from './helpers/api-mocks';

async function setupPage(page: Page) {
	await setupMockRoutes(page);
	await page.goto('/weekly-forecast');

	// Wait for content to be populated by weekly-forecast.ts
	await page.waitForSelector('#deep-archimedea-tabs .nav-link', {timeout: 15_000});
	await page.waitForSelector('#descendia-tabs .nav-link', {timeout: 15_000});
	await page.waitForSelector('#calendar-season-tabs .nav-link', {state: 'attached', timeout: 15_000});
	await page.waitForSelector('#clan-weekly-columns .col-6', {state: 'attached', timeout: 15_000});
}

test.describe('Weekly Forecast Page', () => {
	test.beforeEach(async ({page}) => {
		await setupPage(page);
	});

	test.describe('Page Structure', () => {
		test('shows page heading and all cards', async ({page}) => {
			await expect(page.locator('h2')).toHaveText('Weekly Forecast');
			await expect(page.locator('.card').filter({hasText: 'Deep Archimedea'})).toBeVisible();
			await expect(page.locator('.card').filter({hasText: 'Temporal Archimedea'})).toBeVisible();
			await expect(page.locator('.card').filter({hasText: 'Descendia'})).toBeVisible();
			await expect(page.locator('.card').filter({hasText: 'Descendia'}).locator('p')).toContainText('not yet been translated');
		});

		test('shows weekly missions notice with countdown badge', async ({page}) => {
			const notice = page.locator('.alert-info');
			await expect(notice).toBeVisible();
			await expect(notice).toContainText('The forecast for the weeklies below will update in');
			const badge = notice.locator('#weekly-missions-timer .badge');
			await expect(badge).toBeVisible();
			await expect(badge).not.toBeEmpty();
		});

		test('Deep Archimedea active pane renders 3 rows', async ({page}) => {
			const activePane = page.locator('#deep-archimedea-content .tab-pane.active');
			await expect(activePane).toBeVisible();
			await expect(activePane.locator('table:first-of-type tbody tr')).toHaveCount(3);
		});

		test('Temporal Archimedea active pane renders 3 rows', async ({page}) => {
			const activePane = page.locator('#temporal-archimedea-content .tab-pane.active');
			await expect(activePane).toBeVisible();
			await expect(activePane.locator('table:first-of-type tbody tr')).toHaveCount(3);
		});

		test('Descendia active pane renders 21 rows × 5 columns', async ({page}) => {
			const activePane = page.locator('#descendia-content .tab-pane.active');
			await expect(activePane).toBeVisible();
			const rows = activePane.locator('tbody tr');
			await expect(rows).toHaveCount(21);
			for (let i = 0; i < 21; i++) {
				await expect(rows.nth(i).locator('td')).toHaveCount(5);
			}
		});
	});

	test.describe('Tab interactions', () => {
		test('clicking a non-active Descendia tab switches content', async ({page}) => {
			const firstTab = page.locator('#descendia-tabs .nav-link').first();
			await firstTab.click();
			await expect(firstTab).toHaveClass(/active/u);
			const firstPane = page.locator('#descendia-content .tab-pane').first();
			await expect(firstPane).toBeVisible();
			await expect(firstPane.locator('tbody tr')).toHaveCount(21);
		});
	});

	test.describe('Calendar Seasons — two-column layout (xl+)', () => {
		test.use({viewport: {width: 1280, height: 720}});

		test('renders one column per season', async ({page}) => {
			await expect(page.locator('#calendar-season-columns .col-6')).toHaveCount(1);
		});

		test('column contains formatted calendar dates', async ({page}) => {
			const dateText = await page.locator('#calendar-season-columns .calendar-season-date').first().textContent();
			expect(dateText).toMatch(/\b[A-Z][a-z]{2} \d{1,2}$/u);
		});
	});

	test.describe('Clan Weekly Initiatives', () => {
		test('shows the Clan Weekly Initiatives card', async ({page}) => {
			await expect(page.locator('.card').filter({hasText: 'Clan Weekly Initiatives'})).toBeVisible();
		});

		test('renders one column per entry, each with a date heading', async ({page}) => {
			const cols = page.locator('#clan-weekly-columns .col-6');
			await expect(cols).toHaveCount(2);
			for (const col of await cols.all()) {
				const heading = await col.locator('h5').textContent();
				expect(heading).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/u);
			}
		});

		test('column renders four reward rows', async ({page}) => {
			const col = page.locator('#clan-weekly-columns .col-6').first();
			await expect(col).toBeVisible();
			await expect(col.locator('tbody tr')).toHaveCount(4);
		});
	});

	test.describe('Calendar Seasons — tabs (below xl)', () => {
		test.use({viewport: {width: 1199, height: 720}});

		test('renders one tab per season', async ({page}) => {
			await expect(page.locator('#calendar-season-tabs .nav-link')).toHaveCount(1);
		});

		test('active tab pane contains formatted calendar dates', async ({page}) => {
			const activePane = page.locator('#calendar-season-content .tab-pane.active');
			await expect(activePane).toBeVisible();
			const dateText = await activePane.locator('.calendar-season-date').first().textContent();
			expect(dateText).toMatch(/\b[A-Z][a-z]{2} \d{1,2}$/u);
		});
	});
});
