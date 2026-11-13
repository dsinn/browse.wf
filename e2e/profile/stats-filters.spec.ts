import * as path from 'node:path';
import * as fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {test, expect} from '@playwright/test';
import {setupMockRoutes} from '../helpers/api-mocks';
import {simulateLoggedIn} from '../helpers/cloud-sync-mocks';
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

test.describe('Profile Stats Filters', () => {
	test.beforeEach(async ({page}) => {
		await setupMockRoutes(page);
		await simulateLoggedIn(page);

		await page.route(`**/${proxyHost}/profile*`, route => {
			const nextFetchAvailableAt = new Date(Date.now() + (23 * 60 * 60 * 1000)).toISOString();
			void route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({nextFetchAvailableAt, profile: profileData}),
			});
		});

		await page.goto('/profile');
		// Wait for profileWorkflowReady() to fire before interacting with the form
		await page.waitForSelector('#steps:not(.d-none)');
		// Fail fast and clearly if cloud sync was not simulated in time (the page would fall back to the manual flow)
		await expect(page.locator('#steps')).not.toHaveClass(/manual-flow/u);
		await page.selectOption('#platform-select', 'pc');
		await page.fill('#account-id', '55540360384632532d7b23c6');
		await page.dispatchEvent('#account-id', 'input');
		await expect(page.locator('#step2-container')).toHaveClass(/complete/u, {timeout: 5000});
		await page.click('button:has-text("Fetch Profile")');
		await expect(page.locator('#step2-container')).toHaveClass(/complete/u, {timeout: 5000});

		// Navigate to Stats tab
		await page.click('a[data-tab="stats"]');
		await expect(page.locator('#stats')).toBeVisible();
	});

	test.describe('Equipment filter bar', () => {
		test.beforeEach(async ({page}) => {
			await page.click('a[data-subtab="equipment"]');
		});

		test('starts on "All" with every row visible, next to a button per category', async ({page}) => {
			const bar = page.locator('#equipment-filter-bar');
			await expect(bar.locator('button[data-filter=""]')).toBeVisible();
			await expect(bar.locator('button[data-filter=""]')).toHaveClass(/active/u);
			await expect(bar.locator('button:not([data-filter=""])')).not.toHaveCount(0);

			const visibleRows = page.locator('#equipment-stats tr:visible');
			await expect(visibleRows.first()).toBeVisible();
		});

		test('filters the table by category, and switches between categories', async ({page}) => {
			const bar = page.locator('#equipment-filter-bar');
			// The bar is built once the rows have been categorized, so the rows are final by now
			await expect(bar.locator('button[data-filter=""]')).toBeVisible();
			const totalRows = await page.locator('#equipment-stats tr').count();

			const buttons = bar.locator('button:not([data-filter=""])');
			const firstButton = buttons.first();
			const firstFilter = await firstButton.getAttribute('data-filter');
			const firstCount = await page.locator(`#equipment-stats tr[data-category="${firstFilter}"]`).count();
			expect(firstCount).toBeLessThanOrEqual(totalRows);

			await firstButton.click();
			await expect(firstButton).toHaveClass(/active/u);
			await expect(page.locator('#equipment-stats tr:visible')).toHaveCount(firstCount);

			// Switch to another category, if there is one
			test.skip(await buttons.count() < 2, 'only one category');
			const secondButton = buttons.nth(1);
			const secondFilter = await secondButton.getAttribute('data-filter');
			const secondCount = await page.locator(`#equipment-stats tr[data-category="${secondFilter}"]`).count();

			await secondButton.click();
			await expect(secondButton).toHaveClass(/active/u);
			await expect(firstButton).not.toHaveClass(/active/u);
			await expect(page.locator('#equipment-stats tr:visible')).toHaveCount(secondCount);

			const {visibleCount, mismatches} = await page.evaluate(getVisibleRowStats, secondFilter ?? undefined);
			expect(visibleCount).toBeGreaterThan(0);
			expect(mismatches).toEqual([]);
		});
	});

	test.describe('Enemy filter bar', () => {
		test.beforeEach(async ({page}) => {
			await page.click('a[data-subtab="enemies"]');
		});

		test('starts on "All", next to a button per faction', async ({page}) => {
			const bar = page.locator('#enemy-filter-bar');
			await expect(bar.locator('button[data-filter=""]')).toBeVisible();
			await expect(bar.locator('button[data-filter=""]')).toHaveClass(/active/u);
			await expect(bar.locator('button:not([data-filter=""])')).not.toHaveCount(0);
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
			// Rows hidden by a filter or by the unnamed toggle have blank ranks
			const rows = [...document.querySelectorAll<HTMLTableRowElement>(`#${id} tr`)]
				.filter(tr => getComputedStyle(tr).display !== 'none');
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

	const defaultSortColumns: Record<string, string> = {
		'#equipment-stats': 'Hours',
		'#enemy-stats': 'Kills',
	};
	for (const [tbodySelector, columnHeader] of Object.entries(defaultSortColumns)) {
		test(`${tbodySelector} "${columnHeader}" column is in non-increasing order by default`, async ({page}) => {
			const rows = await page.evaluate(([selector, header]) => {
				const tbody = document.querySelector(selector)!;
				const headings = [...tbody.closest('table')!.querySelectorAll<HTMLTableCellElement>(':scope thead th')];
				const sortedColIndex = headings.findIndex(th => th.textContent === header);
				return [...tbody.querySelectorAll<HTMLTableRowElement>('tr')].map(tr => ({
					name: tr.cells[1].textContent ?? '',
					value: Number((tr.cells[sortedColIndex].textContent ?? '').replaceAll(',', '')),
				}));
			}, [tbodySelector, columnHeader]);
			let previousValue = Infinity;
			for (const [i, {name, value}] of rows.entries()) {
				expect(value, `row ${i + 1} "${name}" (${value}) > row ${i} (${previousValue})`).toBeLessThanOrEqual(previousValue);
				previousValue = value;
			}
		});
	}

	test.describe('Equipment rank column', () => {
		test.beforeEach(async ({page}) => {
			await page.click('a[data-subtab="equipment"]');
		});

		test('stays sequential through sorting, filtering and clearing the filter', async ({page}) => {
			const expectSequentialRanks = async () => {
				const {count, errors} = await checkSequentialRanks(page, 'equipment-stats');
				expect(count).toBeGreaterThan(0);
				expect(errors).toEqual([]);
			};

			await expectSequentialRanks();

			// The table-sort-js script loads asynchronously and marks a table once it can sort it
			await expect(page.locator('table:has(#equipment-stats)')).toHaveClass(/table-processed/u);
			await page.locator('table:has(#equipment-stats) th', {hasText: 'Item'}).click();
			await expectSequentialRanks();

			const firstCatBtn = page.locator('#equipment-filter-bar button:not([data-filter=""])').first();
			await firstCatBtn.click();
			const visibleRows = page.locator('#equipment-stats tr:visible');
			const count = await visibleRows.count();
			expect(count).toBeGreaterThan(0);
			await expect(visibleRows.locator('td:first-child')).toHaveText(Array.from({length: count}, (_, i) => String(i + 1)));

			await page.locator('#equipment-filter-bar button[data-filter=""]').click(); // Reset to All
			await expectSequentialRanks();
		});
	});

	test.describe('Enemy rank column', () => {
		test.beforeEach(async ({page}) => {
			await page.click('a[data-subtab="enemies"]');
		});

		test('is sequential, also after filtering', async ({page}) => {
			const rows = page.locator('#enemy-stats tr:visible');
			const count = await rows.count();
			expect(count).toBeGreaterThan(0);
			await expect(rows.locator('td:first-child')).toHaveText(Array.from({length: count}, (_, i) => String(i + 1)));

			await page.locator('#enemy-filter-bar button:not([data-filter=""])').first().click();
			const filteredRows = page.locator('#enemy-stats tr:visible');
			await expect(filteredRows).not.toHaveCount(count);
			const filteredCount = await filteredRows.count();
			expect(filteredCount).toBeGreaterThan(0);
			await expect(filteredRows.locator('td:first-child')).toHaveText(Array.from({length: filteredCount}, (_, i) => String(i + 1)));
		});
	});

	test.describe('Equipment "Used" column', () => {
		// Categories that don't aggregate a total, so "Used" shows 0.00% for every row:
		// - MechSuits: absent from profile data (no usage data recorded)
		// - SpecialItems: intentionally excluded from aggregation (mixed items, no meaningful total)
		// - Unnamed: internal items that have no export entry, so their "Used" cell is blank
		const ZERO_USAGE_CATEGORIES = new Set(['MechSuits', 'SpecialItems', 'Unnamed']);
		const SHARED_DENOMINATOR_CATEGORIES = new Set(['Sentinels', 'KubrowPets', 'MoaPets']);

		test('"Used" cells of named items show a percentage, which sums to ~100% per category', async ({page}) => {
			const {count, invalids, categoryTotals} = await page.evaluate(() => {
				const rows = [...document.querySelectorAll<HTMLTableRowElement>('#equipment-stats tr')];
				const invalids: string[] = [];
				let count = 0;
				for (const tr of rows) {
					if (tr.dataset.category === 'Unnamed') {
						continue;
					}

					count++;
					const text = tr.cells[2]?.textContent ?? '';
					if (!/^\d+\.\d{2}%$/u.test(text)) {
						invalids.push(`"${text}"`);
					}
				}

				const categoryTotals: Record<string, number> = {};
				for (const tr of rows) {
					const category = tr.dataset.category ?? '';
					const value = Number((tr.cells[2]?.textContent ?? '0').replaceAll(/[%—]/gu, '') || '0');
					categoryTotals[category] = (categoryTotals[category] ?? 0) + value;
				}

				return {count, invalids, categoryTotals};
			});
			expect(count).toBeGreaterThan(0);
			expect(invalids).toEqual([]);

			for (const [category, total] of Object.entries(categoryTotals)) {
				if (ZERO_USAGE_CATEGORIES.has(category)) {
					expect(total, `category ${category} has no Used percentage, sums to 0%`).toBeCloseTo(0, 0);
				} else if (SHARED_DENOMINATOR_CATEGORIES.has(category)) {
					expect(total, `category ${category} sums to less than 100%`).toBeLessThan(100);
				} else {
					expect(total, `category ${category} sums to ~100%`).toBeCloseTo(100, 0);
				}
			}
		});
	});

	test.describe('Unnamed items', () => {
		for (const [subtab, tbody, bar, toggle, totals, heading] of [
			['equipment', '#equipment-stats', '#equipment-filter-bar', '#equipment-unnamed-toggle', '#equipment-aggregate-rows', 'Item'],
			['enemies', '#enemy-stats', '#enemy-filter-bar', '#enemy-unnamed-toggle', '#enemy-aggregate-rows', 'Enemy'],
		] as const) {
			test(`in the ${subtab} are shown or hidden by the checkbox, and are named by their internal names`, async ({page}) => {
				await page.click(`a[data-subtab="${subtab}"]`);
				const checkbox = page.locator(`${toggle} input[type="checkbox"]`);
				const unnamedRows = page.locator(`${tbody} tr[data-category="Unnamed"]`);
				const unnamedGroups = page.locator(`${totals} tr td:nth-child(2)`).filter({hasText: 'Unnamed'});
				const totalRow = page.locator(totals.replace('-rows', '-total'));

				// Are hidden in the All view, and left out of the totals, by default
				expect(await unnamedRows.count()).toBeGreaterThan(0);
				await expect(unnamedRows.first()).toBeHidden();
				await expect(checkbox).not.toBeChecked();
				await expect(unnamedGroups).toHaveCount(0);

				const totalWithout = await totalRow.textContent();

				// Show in the All view, ranked in sequence, and are totalled, once the checkbox is checked
				await checkbox.check();

				const total = await page.locator(`${tbody} tr`).count();
				await expect(page.locator(`${tbody} tr:visible`)).toHaveCount(total);
				await expect(page.locator(`${tbody} tr:visible td:first-child`).last()).toHaveText(String(total));
				await expect(unnamedGroups).toHaveCount(1);
				await expect(totalRow).not.toHaveText(totalWithout!);

				// Are hidden and left out of the totals again when the checkbox is unchecked
				await checkbox.uncheck();

				await expect(unnamedRows.first()).toBeHidden();
				await expect(unnamedGroups).toHaveCount(0);
				await expect(totalRow).toHaveText(totalWithout!);

				// Show under the Unnamed filter button even with the checkbox unchecked
				await page.locator(`${bar} button[data-filter="Unnamed"]`).click();

				const unnamedCount = await unnamedRows.count();
				await expect(page.locator(`${tbody} tr:visible`)).toHaveCount(unnamedCount);

				// Show their full internal name in a Bootstrap tooltip, also after sorting
				// The table-sort-js script loads asynchronously and marks a table once it can sort it
				const table = page.locator(`table:has(${tbody})`);
				await expect(table).toHaveClass(/table-processed/u);
				await table.locator('th', {hasText: heading}).click();

				const name = page.locator(`${tbody} tr:visible code.internal-name`).first();
				const fullName = await name.getAttribute('data-bs-title');
				expect(fullName).toMatch(/^\/Lotus\//u);
				await name.hover();
				await expect(page.locator('.tooltip.show')).toContainText(fullName!);
			});
		}
	});

	test.describe('Sorting columns that can be blank', () => {
		test.beforeEach(async ({page}) => {
			await page.click('a[data-subtab="equipment"]');
			// Unnamed rows are the ones with no Used value; make them visible
			await page.locator('#equipment-unnamed-toggle input[type="checkbox"]').check();
			// The table-sort-js script loads asynchronously and marks a table once it can sort it
			await expect(page.locator('table:has(#equipment-stats)')).toHaveClass(/table-processed/u);
		});

		const readColumn = async (page: any, header: string) =>
			page.evaluate((columnHeader: string) => {
				const tbody = document.querySelector('#equipment-stats')!;
				const headings = [...tbody.closest('table')!.querySelectorAll<HTMLTableCellElement>(':scope thead th')];
				const index = headings.findIndex(th => th.textContent === columnHeader);
				return [...tbody.querySelectorAll<HTMLTableRowElement>('tr')].map(tr => (tr.cells[index].textContent ?? '').replaceAll(/[%,—]/gu, ''));
			}, header) as Promise<string[]>;

		for (const header of ['Used', 'Fired', 'Hit %']) {
			test(`"${header}" puts blank cells last when sorted descending, and keeps real values in order both ways`, async ({page}) => {
				const heading = page.locator('table:has(#equipment-stats) th', {hasText: header});

				await heading.click();
				const descending = await readColumn(page, header);
				const firstBlank = descending.indexOf('');
				expect(firstBlank, 'some blank cells to check').toBeGreaterThan(0);
				expect(descending.slice(firstBlank).every(cell => cell === ''), 'only blanks after the first blank').toBe(true);

				const descendingValues = descending.slice(0, firstBlank).map(Number);
				expect(descendingValues).toEqual([...descendingValues].sort((a, b) => b - a));

				await heading.click();
				const ascending = await readColumn(page, header);
				const ascendingValues = ascending.filter(cell => cell !== '').map(Number);
				expect(ascendingValues.length).toBeGreaterThan(0);
				expect(ascendingValues).toEqual([...ascendingValues].sort((a, b) => a - b));
			});
		}
	});

	test.describe('Filter persistence across table sort', () => {
		for (const [name, subtab, tbody, bar, heading] of [
			['equipment', 'equipment', '#equipment-stats', '#equipment-filter-bar', 'Kills'],
			['enemy', 'enemies', '#enemy-stats', '#enemy-filter-bar', 'Kills'],
		] as const) {
			test(`${name} filter still applies after sorting a column`, async ({page}) => {
				await page.click(`a[data-subtab="${subtab}"]`);
				const button = page.locator(`${bar} button:not([data-filter=""])`).first();
				const filterValue = (await button.getAttribute('data-filter'))!;

				// The categories are set on the rows before the filter bar exists, so this count doesn't depend on the filtering
				const expectedCount = await page.locator(`${tbody} tr[data-category="${filterValue}"]`).count();
				expect(expectedCount).toBeGreaterThan(0);

				const visibleRows = page.locator(`${tbody} tr:visible`);
				await button.click();
				await expect(visibleRows).toHaveCount(expectedCount);

				// The table-sort-js script loads asynchronously and marks a table once it can sort it
				const table = page.locator(`table:has(${tbody})`);
				await expect(table).toHaveClass(/table-processed/u);
				await table.locator('th', {hasText: heading}).click();

				await expect(visibleRows).toHaveCount(expectedCount);
				await expect(page.locator(`${tbody} tr[data-category="${filterValue}"]:visible`)).toHaveCount(expectedCount);
			});
		}
	});
});
