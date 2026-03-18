import {test, expect, type Page} from '@playwright/test';
import {setupMockRoutes} from './helpers/api-mocks';

async function setupPage(page: Page) {
	await setupMockRoutes(page);
	await page.goto('/weekly-forecast.php');

	// Wait for tabs to be populated by weekly-forecast.ts
	await page.waitForSelector('#lab-conquest-tabs .nav-link', {timeout: 15_000});
	await page.waitForSelector('#descendia-tabs .nav-link', {timeout: 15_000});
	await page.waitForSelector('#calendar-season-tabs .nav-link', {timeout: 15_000});
}

test.describe('Weekly Forecast Page', () => {
	test.beforeEach(async ({page}) => {
		await setupPage(page);
	});

	test.describe('Page Structure', () => {
		test('shows page heading', async ({page}) => {
			await expect(page.locator('h2')).toHaveText('Weekly Forecast');
		});

		test('shows Deep Archimedea card', async ({page}) => {
			const card = page.locator('.card').filter({hasText: 'Deep Archimedea'});
			await expect(card).toBeVisible();
		});

		test('shows Temporal Archimedea card', async ({page}) => {
			const card = page.locator('.card').filter({hasText: 'Temporal Archimedea'});
			await expect(card).toBeVisible();
		});

		test('shows Descendia card', async ({page}) => {
			const card = page.locator('.card').filter({hasText: 'Descendia'});
			await expect(card).toBeVisible();
		});

		test('shows untranslated-notice in Descendia card', async ({page}) => {
			const notice = page.locator('.card').filter({hasText: 'Descendia'}).locator('p');
			await expect(notice).toContainText('not yet been translated');
		});

		test('shows weekly missions notice with countdown badge', async ({page}) => {
			const notice = page.locator('.alert-info');
			await expect(notice).toBeVisible();
			await expect(notice).toContainText('The forecast for the weeklies below will update in');
			// Badge should have been populated by initWeeklyMissionsNotice
			const badge = notice.locator('#weekly-missions-timer .badge');
			await expect(badge).toBeVisible();
			await expect(badge).not.toBeEmpty();
		});
	});

	test.describe('Deep Archimedea tabs', () => {
		test('renders at least one tab', async ({page}) => {
			const tabs = page.locator('#lab-conquest-tabs .nav-link');
			await expect(tabs).toHaveCount(1); // WorldState has 1 CT_LAB entry
		});

		test('tab label is a date string', async ({page}) => {
			const tab = page.locator('#lab-conquest-tabs .nav-link').first();
			const label = await tab.textContent();
			// Should look like "Jan 1" or "Feb 17" etc.
			expect(label).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/u);
		});

		test('active tab pane renders 3 mission rows', async ({page}) => {
			const activePane = page.locator('#lab-conquest-content .tab-pane.active');
			await expect(activePane).toBeVisible();

			const rows = activePane.locator('table:first-of-type tbody tr');
			await expect(rows).toHaveCount(3);
		});

		test('each mission row has type (th) + variant + 2 conditions (tds)', async ({page}) => {
			const activePane = page.locator('#lab-conquest-content .tab-pane.active');
			const rows = activePane.locator('table:first-of-type tbody tr');
			const count = await rows.count();

			for (let i = 0; i < count; i++) {
				const row = rows.nth(i);
				await expect(row.locator('th')).toHaveCount(1);
				await expect(row.locator('td')).toHaveCount(3);
			}
		});

		test('variants and conditions have tooltips', async ({page}) => {
			const activePane = page.locator('#lab-conquest-content .tab-pane.active');
			const abbrs = activePane.locator('table:first-of-type abbr[data-bs-toggle="tooltip"]');
			// 3 missions × 3 cells (variant + 2 conditions) = 9 abbrs, assuming all resolve
			const count = await abbrs.count();
			expect(count).toBeGreaterThan(0);
		});

		test('frame variables table has at least one cell with a tooltip', async ({page}) => {
			const activePane = page.locator('#lab-conquest-content .tab-pane.active');
			const fvAbbrs = activePane.locator('table:last-of-type abbr[data-bs-toggle="tooltip"]');
			const count = await fvAbbrs.count();
			expect(count).toBeGreaterThan(0);
		});
	});

	test.describe('Temporal Archimedea tabs', () => {
		test('renders at least one tab', async ({page}) => {
			const tabs = page.locator('#hex-conquest-tabs .nav-link');
			await expect(tabs).toHaveCount(1); // WorldState has 1 CT_HEX entry
		});

		test('active tab pane renders 3 mission rows', async ({page}) => {
			const activePane = page.locator('#hex-conquest-content .tab-pane.active');
			await expect(activePane).toBeVisible();

			const rows = activePane.locator('table:first-of-type tbody tr');
			await expect(rows).toHaveCount(3);
		});

		test('does not show DualDefense (CT_HEX-specific)', async ({page}) => {
			const activePane = page.locator('#hex-conquest-content .tab-pane.active');
			const missionTypes = await activePane.locator('table:first-of-type tbody tr th').allTextContents();
			expect(missionTypes).not.toContain('DualDefense');
		});
	});

	test.describe('Descendia tabs', () => {
		test('renders 6 tabs (one per descent in mock data)', async ({page}) => {
			const tabs = page.locator('#descendia-tabs .nav-link');
			await expect(tabs).toHaveCount(6);
		});

		test('first tab is active (current week)', async ({page}) => {
			// The API cleans up past descents, so the first entry is expected to be the current week.
			const firstTab = page.locator('#descendia-tabs .nav-link').first();
			await expect(firstTab).toHaveClass(/active/u);
		});

		test('active pane renders table with 21 rows', async ({page}) => {
			const activePane = page.locator('#descendia-content .tab-pane.active');
			await expect(activePane).toBeVisible();

			const rows = activePane.locator('tbody tr');
			await expect(rows).toHaveCount(21);
		});

		test('clicking a non-active tab switches content', async ({page}) => {
			const secondTab = page.locator('#descendia-tabs .nav-link').nth(1);
			await secondTab.click();

			// Second tab should now be active
			await expect(secondTab).toHaveClass(/active/u);

			// Second pane should be shown
			const secondPane = page.locator('#descendia-content .tab-pane').nth(1);
			await expect(secondPane).toHaveClass(/active/u);
			await expect(secondPane).toBeVisible();

			// Should also have 21 rows
			const rows = secondPane.locator('tbody tr');
			await expect(rows).toHaveCount(21);
		});
	});

	test.describe('Calendar Seasons tabs', () => {
		test('shows Calendar Seasons card', async ({page}) => {
			const card = page.locator('.card').filter({hasText: '1999 Calendar'});
			await expect(card).toBeVisible();
		});

		test('renders one tab per season in mock data', async ({page}) => {
			const tabs = page.locator('#calendar-season-tabs .nav-link');
			await expect(tabs).toHaveCount(1); // WorldState has 1 KnownCalendarSeason
		});

		test('first tab is active (current season)', async ({page}) => {
			const firstTab = page.locator('#calendar-season-tabs .nav-link').first();
			await expect(firstTab).toHaveClass(/active/u);
		});

		test('active pane contains day rows with dates', async ({page}) => {
			const activePane = page.locator('#calendar-season-content .tab-pane.active');
			await expect(activePane).toBeVisible();
			// Mock data has days with events — each gets a .calendar-season-date label
			const dateCols = activePane.locator('.calendar-season-date');
			const count = await dateCols.count();
			expect(count).toBeGreaterThan(0);
		});

		test('day rows show formatted calendar dates', async ({page}) => {
			const activePane = page.locator('#calendar-season-content .tab-pane.active');
			const dateText = await activePane.locator('.calendar-season-date').first().textContent();
			// Should be a short date like "Oct 6" (no year)
			expect(dateText).toMatch(/\b[A-Z][a-z]{2} \d{1,2}$/u);
		});
	});
});
