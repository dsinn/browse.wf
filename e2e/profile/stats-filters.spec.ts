import * as path from 'node:path';
import * as fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {test, expect} from '@playwright/test';
import {setupMockRoutes} from '../helpers/api-mocks';
import {TEST_FRONT_PROXY_BASE_URL} from '../../test/helpers/test-constants';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const proxyHost = new URL(TEST_FRONT_PROXY_BASE_URL).host;
const profileData = JSON.parse(fs.readFileSync(path.join(__dirname, '../../test/profile/getProfileViewingData.html'), 'utf8'));

function getVisibleRowStats(filter: string | undefined) {
	const visible = [...document.querySelectorAll<HTMLTableRowElement>('#equipment-stats tr')]
		.filter(tr => getComputedStyle(tr).display !== 'none');
	return {
		visibleCount: visible.length,
		mismatches: visible.filter(tr => tr.dataset.category !== filter).map(tr => tr.dataset.category),
	};
}

async function simulateLoggedIn(page: any) {
	await page.addInitScript(() => {
		const original = window.dispatchEvent.bind(globalThis);
		window.dispatchEvent = function (event: Event) {
			if (event.type.startsWith('cloud-sync-') && event.type !== 'cloud-sync-complete') {
				return original(new CustomEvent('cloud-sync-complete'));
			}

			return original(event);
		};
	});
}

test.describe('Profile Stats Filters', () => {
	test.beforeEach(async ({page}) => {
		await setupMockRoutes(page);
		await simulateLoggedIn(page);

		await page.route(`**/${proxyHost}/profile*`, route => {
			void route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					nextFetchAvailableAt: new Date(Date.now() + (23 * 60 * 60 * 1000)).toISOString(),
					profile: profileData,
				}),
			});
		});

		await page.goto('/profile');
		await page.selectOption('#platform-select', 'pc');
		const eeLogPath = path.join(__dirname, '../../test/profile/EE.log');
		await page.setInputFiles('#ee-log-file', eeLogPath);
		await expect(page.locator('#step2-container')).toHaveClass(/complete/u, {timeout: 5000});

		// Navigate to Stats tab
		await page.click('a[data-tab="stats"]');
		await expect(page.locator('#stats')).toBeVisible();
	});

	test.describe('Equipment filter bar', () => {
		test('renders an "All" button and at least one category button', async ({page}) => {
			const bar = page.locator('#equipment-filter-bar');
			await expect(bar.locator('button[data-filter=""]')).toBeVisible();
			await expect(bar.locator('button:not([data-filter=""])')).toHaveCount(await bar.locator('button').count() - 1);
			expect(await bar.locator('button').count()).toBeGreaterThan(1);
		});

		test('"All" button starts active', async ({page}) => {
			const allBtn = page.locator('#equipment-filter-bar button[data-filter=""]');
			await expect(allBtn).toHaveClass(/active/u);
		});

		test('all rows visible initially', async ({page}) => {
			const visibleRows = page.locator('#equipment-stats tr:visible');
			await expect(visibleRows.first()).toBeVisible();
			expect(await visibleRows.count()).toBeGreaterThan(0);
		});

		test('clicking a category button filters the table', async ({page}) => {
			const bar = page.locator('#equipment-filter-bar');
			await expect(page.locator('#equipment-stats tr').first()).toBeVisible();
			const totalRows = await page.locator('#equipment-stats tr').count();

			// Click the first non-All button
			const firstCatBtn = bar.locator('button:not([data-filter=""])').first();
			const filterValue = await firstCatBtn.getAttribute('data-filter');
			await firstCatBtn.click();

			// Button is now active
			await expect(firstCatBtn).toHaveClass(/active/u);

			// Fewer rows visible (or equal if all belong to that category)
			const matchingRows = page.locator(`#equipment-stats tr[data-category="${filterValue}"]`);
			const matchCount = await matchingRows.count();
			expect(matchCount).toBeLessThanOrEqual(totalRows);

			// All visible rows match the filter
			const visibleRows = page.locator('#equipment-stats tr:visible');
			const visibleCount = await visibleRows.count();
			expect(visibleCount).toBe(matchCount);
		});

		test('switching between category buttons updates the filter', async ({page}) => {
			const bar = page.locator('#equipment-filter-bar');
			const catButtons = bar.locator('button:not([data-filter=""])');

			if (await catButtons.count() < 2) {
				test.skip();
			}

			const firstBtn = catButtons.nth(0);
			const secondBtn = catButtons.nth(1);
			const secondFilter = await secondBtn.getAttribute('data-filter');

			await firstBtn.click();
			await secondBtn.click();

			await expect(secondBtn).toHaveClass(/active/u);
			await expect(firstBtn).not.toHaveClass(/active/u);

			// All visible rows match the second filter
			const {visibleCount, mismatches} = await page.evaluate(getVisibleRowStats, secondFilter ?? undefined);
			expect(visibleCount).toBeGreaterThan(0);
			expect(mismatches).toEqual([]);
		});
	});

	test.describe('Enemy filter bar', () => {
		test('renders an "All" button and at least one faction button', async ({page}) => {
			const bar = page.locator('#enemy-filter-bar');
			await expect(bar.locator('button[data-filter=""]')).toBeVisible();
			expect(await bar.locator('button').count()).toBeGreaterThan(1);
		});

		test('"All" button starts active', async ({page}) => {
			await expect(page.locator('#enemy-filter-bar button[data-filter=""]')).toHaveClass(/active/u);
		});

		test('clicking a faction button filters the enemy table', async ({page}) => {
			const bar = page.locator('#enemy-filter-bar');
			const totalRows = await page.locator('#enemy-stats tr').count();

			const firstFactionBtn = bar.locator('button:not([data-filter=""])').first();
			const filterValue = await firstFactionBtn.getAttribute('data-filter');
			await firstFactionBtn.click();

			await expect(firstFactionBtn).toHaveClass(/active/u);

			const matchingRows = page.locator(`#enemy-stats tr[data-category="${filterValue}"]`);
			const matchCount = await matchingRows.count();
			expect(matchCount).toBeLessThanOrEqual(totalRows);
			await expect(page.locator('#enemy-stats tr:visible')).toHaveCount(matchCount);
		});
	});

	const checkSequentialRanks = (page: any, tbodyId: string) =>
		page.evaluate((id: string) => {
			const rows = document.querySelectorAll<HTMLTableRowElement>(`#${id} tr`);
			const errors: string[] = [];
			let rank = 1;
			for (const tr of rows) {
				const actual = tr.cells[0]?.textContent;
				if (actual !== String(rank)) {
					errors.push(`row ${rank}: expected "${rank}", got "${actual}"`);
				}

				rank++;
			}

			return {count: rows.length, errors};
		}, tbodyId);

	test.describe('Equipment rank column', () => {
		test('shows sequential ranks starting at 1', async ({page}) => {
			const {count, errors} = await checkSequentialRanks(page, 'equipment-stats');
			expect(count).toBeGreaterThan(0);
			expect(errors).toEqual([]);
		});

		test('renumbers sequentially after sorting a column', async ({page}) => {
			await page.locator('table:has(#equipment-stats) th').nth(1).click();
			const {count, errors} = await checkSequentialRanks(page, 'equipment-stats');
			expect(count).toBeGreaterThan(0);
			expect(errors).toEqual([]);
		});

		test('visible ranks are gapless after filtering', async ({page}) => {
			const firstCatBtn = page.locator('#equipment-filter-bar button:not([data-filter=""])').first();
			await firstCatBtn.click();
			const visibleRows = page.locator('#equipment-stats tr:visible');
			const count = await visibleRows.count();
			expect(count).toBeGreaterThan(0);
			await expect(visibleRows.locator('td:first-child')).toHaveText(Array.from({length: count}, (_, i) => String(i + 1)));
		});

		test('ranks restore after clearing filter', async ({page}) => {
			const firstCatBtn = page.locator('#equipment-filter-bar button:not([data-filter=""])').first();
			await firstCatBtn.click();
			await page.locator('#equipment-filter-bar button[data-filter=""]').click(); // Reset to All
			const {count, errors} = await checkSequentialRanks(page, 'equipment-stats');
			expect(count).toBeGreaterThan(0);
			expect(errors).toEqual([]);
		});
	});

	test.describe('Enemy rank column', () => {
		test('shows sequential ranks starting at 1', async ({page}) => {
			const rows = page.locator('#enemy-stats tr');
			const count = await rows.count();
			expect(count).toBeGreaterThan(0);
			await expect(rows.locator('td:first-child')).toHaveText(Array.from({length: count}, (_, i) => String(i + 1)));
		});

		test('visible ranks are gapless after filtering', async ({page}) => {
			const firstFactionBtn = page.locator('#enemy-filter-bar button:not([data-filter=""])').first();
			await firstFactionBtn.click();
			const visibleRows = page.locator('#enemy-stats tr:visible');
			const count = await visibleRows.count();
			expect(count).toBeGreaterThan(0);
			await expect(visibleRows.locator('td:first-child')).toHaveText(Array.from({length: count}, (_, i) => String(i + 1)));
		});
	});

	test.describe('Equipment "Used" column', () => {
		// Categories that don't aggregate a total, so "Used" shows 0.00% for every row:
		// - MechSuits: absent from profile data (no usage data recorded)
		// - SpecialItems: intentionally excluded from aggregation (mixed items, no meaningful total)
		const ZERO_USAGE_CATEGORIES = new Set(['MechSuits', 'SpecialItems']);

		test('all "Used" cells show a percentage value', async ({page}) => {
			const {count, invalids} = await page.evaluate(() => {
				const rows = document.querySelectorAll<HTMLTableRowElement>('#equipment-stats tr');
				const invalids: string[] = [];
				for (const tr of rows) {
					const text = tr.cells[2]?.textContent ?? '';
					if (!/^\d+\.\d{2}%$/u.test(text)) {
						invalids.push(`"${text}"`);
					}
				}

				return {count: rows.length, invalids};
			});
			expect(count).toBeGreaterThan(0);
			expect(invalids).toEqual([]);
		});

		test('"Used" percentages sum to ~100% per category', async ({page}) => {
			const categoryTotals = await page.evaluate(() => {
				const totals: Record<string, number> = {};
				for (const tr of document.querySelectorAll<HTMLTableRowElement>('#equipment-stats tr')) {
					const category = tr.dataset.category ?? '';
					const value = Number.parseFloat(tr.cells[2]?.textContent ?? '0');
					totals[category] = (totals[category] ?? 0) + value;
				}

				return totals;
			});
			for (const [category, total] of Object.entries(categoryTotals)) {
				if (ZERO_USAGE_CATEGORIES.has(category)) {
					expect(total, `category ${category} has no Used percentage, sums to 0%`).toBeCloseTo(0, 0);
				} else {
					expect(total, `category ${category} sums to ~100%`).toBeCloseTo(100, 0);
				}
			}
		});
	});

	test.describe('Filter persistence across table sort', () => {
		test('equipment filter still applies after sorting a column', async ({page}) => {
			const bar = page.locator('#equipment-filter-bar');
			const firstCatBtn = bar.locator('button:not([data-filter=""])').first();
			const filterValue = await firstCatBtn.getAttribute('data-filter');
			await firstCatBtn.click();

			const filteredCount = await page.locator('#equipment-stats tr:visible').count();

			// Click a column header to sort
			await page.locator('#equipment-stats').locator('..').locator('..').locator('th').nth(1).click();

			// Filter should still be applied
			await expect(page.locator('#equipment-stats tr:visible')).toHaveCount(filteredCount);

			// All visible rows still match the filter
			const equipMismatches = await page.evaluate(
				(filter: string | undefined) =>
					[...document.querySelectorAll<HTMLTableRowElement>('#equipment-stats tr')]
						.filter(tr => getComputedStyle(tr).display !== 'none' && tr.dataset.category !== filter)
						.map(tr => tr.dataset.category),
				filterValue ?? undefined,
			);
			expect(equipMismatches).toEqual([]);
		});

		test('enemy filter still applies after sorting a column', async ({page}) => {
			const bar = page.locator('#enemy-filter-bar');
			const firstFactionBtn = bar.locator('button:not([data-filter=""])').first();
			const filterValue = await firstFactionBtn.getAttribute('data-filter');
			await firstFactionBtn.click();

			const filteredCount = await page.locator('#enemy-stats tr:visible').count();

			// Click a column header to sort
			await page.locator('#enemy-stats').locator('..').locator('..').locator('th').nth(1).click();

			await expect(page.locator('#enemy-stats tr:visible')).toHaveCount(filteredCount);

			const enemyMismatches = await page.evaluate(
				(filter: string | undefined) =>
					[...document.querySelectorAll<HTMLTableRowElement>('#enemy-stats tr')]
						.filter(tr => getComputedStyle(tr).display !== 'none' && tr.dataset.category !== filter)
						.map(tr => tr.dataset.category),
				filterValue ?? undefined,
			);
			expect(enemyMismatches).toEqual([]);
		});
	});
});
