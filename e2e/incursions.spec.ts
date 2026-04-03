import {test, expect, type Page} from '@playwright/test';
import {setupMockRoutes} from './helpers/api-mocks';

// `sp-incursions.txt` is a static file always served from disk — no mock needed.

async function waitForSchedule(page: Page) {
	// Wait until the schedule container no longer shows the loading message
	await expect(page.locator('#schedule')).not.toContainText('Loading, please wait...', {timeout: 10_000});
}

test.describe('Steel Path Incursion Schedule (/incursions)', () => {
	test.beforeEach(async ({page}) => {
		await setupMockRoutes(page);
		await page.goto('/incursions');
		await waitForSchedule(page);
	});

	test('year selector is populated from data', async ({page}) => {
		const count = await page.locator('#select-year option').count();
		expect(count).toBeGreaterThan(0);
	});

	test.describe('View modes', () => {
		test('calendar view has 7 day-of-week headers, numbered date cells, today marked, and mission content', async ({page}) => {
			await page.locator('#btn-view-calendar').click();
			await expect(page.locator('.incursion-day-header')).toHaveCount(7);
			const text = await page.locator('.incursion-date-label').first().textContent();
			expect(Number.parseInt(text!, 10)).toBeGreaterThan(0);
			expect(await page.locator('.incursions-grid .is-today').count()).toBe(1);
			expect(await page.locator('.incursions-grid .incursion-faction-icon').count()).toBeGreaterThan(0);
		});

		test('table view has rows with a date heading cell per day, today marked, and mission content', async ({page}) => {
			await page.locator('#btn-view-table').click();
			const rows = page.locator('.incursion-table-row');
			expect(await rows.count()).toBeGreaterThan(0);
			await expect(rows.first().locator('th.incursion-table-date')).toBeVisible();
			expect(await page.locator('.incursion-table-row.is-today').count()).toBe(1);
			expect(await page.locator('.incursion-table-missions .incursion-planet').count()).toBeGreaterThan(0);
		});

		test('list view has date headings, today marked, and mission content', async ({page}) => {
			await page.locator('#btn-view-list').click();
			expect(await page.locator('h3.incursion-list-heading').count()).toBeGreaterThan(0);
			expect(await page.locator('h3.incursion-list-heading.is-today').count()).toBe(1);
			expect(await page.locator('.incursions-list .incursion-planet').count()).toBeGreaterThan(0);
		});
	});

	test.describe('Navigation', () => {
		test('Next and Prev buttons change the displayed month and schedule content', async ({page}) => {
			const initialMonth = await page.locator('#select-month').inputValue();
			const initialContent = await page.locator('#schedule').textContent();
			await page.locator('#btn-next').click();
			await expect(page.locator('#select-month')).not.toHaveValue(initialMonth);
			expect(await page.locator('#schedule').textContent()).not.toBe(initialContent);
			await page.locator('#btn-prev').click();
			await expect(page.locator('#select-month')).toHaveValue(initialMonth);
			expect(await page.locator('#schedule').textContent()).toBe(initialContent);
			await page.locator('#btn-prev').click();
			expect(await page.locator('#schedule').textContent()).not.toBe(initialContent);
			await page.locator('#btn-next').click();
			expect(await page.locator('#schedule').textContent()).toBe(initialContent);
		});

		test('Prev from January wraps to December of the previous year', async ({page}) => {
			await page.locator('#select-month').selectOption('0');
			await page.locator('#select-year').selectOption('2026');
			await page.locator('#btn-prev').click();
			await expect(page.locator('#select-month')).toHaveValue('11');
			await expect(page.locator('#select-year')).toHaveValue('2025');
		});

		test('Next from December wraps to January of the next year', async ({page}) => {
			await page.locator('#select-month').selectOption('11');
			await page.locator('#select-year').selectOption('2026');
			await page.locator('#btn-next').click();
			await expect(page.locator('#select-month')).toHaveValue('0');
			await expect(page.locator('#select-year')).toHaveValue('2027');
		});

		test('Today button resets to the current month', async ({page}) => {
			await page.locator('#btn-next').click();
			await page.locator('#btn-next').click();
			const currentMonth = await page.evaluate(() => new Date().getMonth().toString());
			expect(await page.locator('#select-month').inputValue()).not.toBe(currentMonth);
			await page.locator('#btn-today').click();
			await expect(page.locator('#select-month')).toHaveValue(currentMonth);
		});

		test('changing month dropdown rerenders the schedule', async ({page}) => {
			const currentMonth = await page.evaluate(() => new Date().getMonth());
			const nextMonth = ((currentMonth + 1) % 12).toString();
			await page.locator('#select-month').selectOption(nextMonth);
			await expect(page.locator('#select-month')).toHaveValue(nextMonth);
		});

		test('past days are marked with is-past in list view', async ({page}) => {
			await page.locator('#btn-view-list').click();
			await page.locator('#btn-prev').click();
			expect(await page.locator('h3.incursion-list-heading.is-past').count()).toBeGreaterThan(0);
		});
	});
});
