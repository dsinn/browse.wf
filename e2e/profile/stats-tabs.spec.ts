import * as path from 'node:path';
import * as fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {test, expect, type Page} from '@playwright/test';
import {setupMockRoutes} from '../helpers/api-mocks';
import {simulateLoggedIn} from '../helpers/cloud-sync-mocks';
import {TEST_FRONT_PROXY_BASE_URL} from '../../test/helpers/test-constants';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const proxyHost = new URL(TEST_FRONT_PROXY_BASE_URL).host;
const hashParameters = (url: string) => new URLSearchParams(new URL(url).hash.slice(1));
const loadFixture = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '../../test/profile', name), 'utf8'));
// A real profile, and one with nothing in it (the way worldState-empty-events.json is a world state with no events)
const profileData = loadFixture('getProfileViewingData.html');
const emptyProfileData = loadFixture('getProfileViewingData-empty.json');

async function openProfile(page: Page, profile: unknown): Promise<void> {
	await setupMockRoutes(page);
	await simulateLoggedIn(page);

	await page.route(`**/${proxyHost}/profile*`, route => {
		const nextFetchAvailableAt = new Date(Date.now() + (23 * 60 * 60 * 1000)).toISOString();
		void route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({nextFetchAvailableAt, profile}),
		});
	});

	await page.goto('/profile');
	await page.waitForSelector('#steps:not(.d-none)');
	await expect(page.locator('#steps')).not.toHaveClass(/manual-flow/u);
	await page.selectOption('#platform-select', 'pc');
	await page.fill('#account-id', '55540360384632532d7b23c6');
	await page.dispatchEvent('#account-id', 'input');
	await expect(page.locator('#step2-container')).toHaveClass(/complete/u, {timeout: 5000});
	await page.click('button:has-text("Fetch Profile")');
	await expect(page.locator('#step2-container')).toHaveClass(/complete/u, {timeout: 5000});
}

// The table-sort-js script loads asynchronously and marks a table once it can sort it
async function waitForSortableTable(page: Page, bodySelector: string): Promise<void> {
	await expect(page.locator(`table:has(${bodySelector})`)).toHaveClass(/table-processed/u);
}

test.describe('Profile Stats sub-tabs and extra tabs', () => {
	test.beforeEach(async ({page}) => {
		await openProfile(page, profileData);
	});

	test.describe('Marks', () => {
		test('shows who has a death mark on the player, under the clan line', async ({page}) => {
			const marks = page.locator('#marks');
			await expect(marks).toBeVisible();
			// The fixture has death marks, and the Zanuka Hunter and Grustrag Three after the player
			await expect(marks).toContainText('Marked by: Stalker, Zanuka Hunter, The Grustrag Three');
		});
	});

	test.describe('Stats sub-tabs', () => {
		test.beforeEach(async ({page}) => {
			await page.click('a[data-tab="stats"]');
			await expect(page.locator('#stats')).toBeVisible();
		});

		test('opens on the overview, with the other panels hidden', async ({page}) => {
			await expect(page.locator('#stats-overview')).toBeVisible();
			for (const panel of ['equipment', 'enemies', 'abilities', 'races']) {
				await expect(page.locator(`#stats-${panel}`)).toBeHidden();
			}
		});

		for (const subtab of ['equipment', 'enemies', 'abilities', 'races', 'overview']) {
			test(`shows only the ${subtab} panel when its link is clicked`, async ({page}) => {
				await page.click(`a[data-subtab="${subtab}"]`);

				await expect(page.locator(`#stats-${subtab}`)).toBeVisible();
				await expect(page.locator(`a[data-subtab="${subtab}"]`)).toHaveClass(/active/u);
				await expect(page.locator('.stats-panel:visible')).toHaveCount(1);
			});
		}

		test('records the sub-tab in the URL hash', async ({page}) => {
			await page.click('a[data-subtab="abilities"]');

			await expect.poll(() => hashParameters(page.url()).get('sub')).toBe('abilities');
			expect(hashParameters(page.url()).get('tab')).toBe('stats');
		});
	});

	test.describe('Overview', () => {
		test.beforeEach(async ({page}) => {
			await page.click('a[data-tab="stats"]');
		});

		test('shows the extra sections', async ({page}) => {
			const extra = page.locator('#stats-overview-extra');
			await expect(extra).toContainText('Combat & Collection');
			await expect(extra).toContainText('Overall Accuracy');
			await expect(extra).toContainText('Eidolons');
			await expect(extra).toContainText('Trials');
			await expect(extra).toContainText('Event Scores & Minigames');
		});

		test('shows the focus left today', async ({page}) => {
			await expect(page.locator('#stat-DailyFocus')).toContainText('Focus Left Today');
		});
	});

	test.describe('Abilities', () => {
		test.beforeEach(async ({page}) => {
			await page.click('a[data-tab="stats"]');
			await page.click('a[data-subtab="abilities"]');
		});

		test('re-orders by a column when its heading is clicked, renumbering the ranks', async ({page}) => {
			await waitForSortableTable(page, '#ability-stats');
			const casts = page.locator('table:has(#ability-stats) th', {hasText: 'Casts'});
			const readRows = async () => page.evaluate(() =>
				[...document.querySelectorAll<HTMLTableRowElement>('#ability-stats tr')].map(tr => ({
					rank: tr.cells[0].textContent,
					casts: Number((tr.cells[3].textContent ?? '').replaceAll(',', '')),
				})));
			const direction = (values: number[]) => {
				const isAscending = values.every((value, i) => i === 0 || value >= values[i - 1]);
				const isDescending = values.every((value, i) => i === 0 || value <= values[i - 1]);
				return isAscending ? 'ascending' : (isDescending ? 'descending' : 'unsorted');
			};

			await casts.click();
			const first = await readRows();
			expect(first.length).toBeGreaterThan(1);
			expect(first.map(row => row.rank)).toEqual(first.map((_, i) => String(i + 1)));
			const firstDirection = direction(first.map(row => row.casts));
			expect(firstDirection).not.toBe('unsorted');

			await casts.click();
			const second = await readRows();
			expect(second.map(row => row.rank)).toEqual(second.map((_, i) => String(i + 1)));
			expect(direction(second.map(row => row.casts))).toBe(firstDirection === 'ascending' ? 'descending' : 'ascending');
		});

		test('keeps each Warframe\'s abilities in slot order when sorting by the Warframe column', async ({page}) => {
			await waitForSortableTable(page, '#ability-stats');
			// Sort by casts (ascending) first, so a sort that fell back on the previous order would reverse the slots
			const casts = page.locator('table:has(#ability-stats) th', {hasText: 'Casts'});
			await casts.click();
			await casts.click();
			await page.locator('table:has(#ability-stats) th', {hasText: 'Warframe'}).click();

			const rows = await page.evaluate(() =>
				[...document.querySelectorAll<HTMLTableRowElement>('#ability-stats tr')].map(tr => ({
					owner: tr.cells[1].textContent ?? '',
					slot: tr.cells[2].querySelector<HTMLElement>('.ability-slot')?.getAttribute('aria-label') ?? '',
				})));

			const owners = rows.map(row => row.owner);
			expect(owners).toEqual([...owners].sort((a, b) => a.localeCompare(b, undefined, {numeric: true})));

			let checked = 0;
			for (const [i, row] of rows.entries()) {
				const previous = rows[i - 1];
				if (row.owner !== previous?.owner || !row.slot || !previous.slot) {
					continue;
				}

				expect(row.slot > previous.slot, `${row.owner}: ${previous.slot} then ${row.slot}`).toBe(true);
				checked++;
			}

			expect(checked, 'at least one Warframe with several abilities').toBeGreaterThan(0);
		});

		test('filters by category', async ({page}) => {
			const button = page.locator('#ability-filter-bar button[data-filter="Operator"]');
			await button.click();

			const categories = await page.evaluate(() =>
				[...document.querySelectorAll<HTMLTableRowElement>('#ability-stats tr')]
					.filter(tr => getComputedStyle(tr).display !== 'none')
					.map(tr => tr.dataset.category));
			expect(categories.length).toBeGreaterThan(0);
			expect(new Set(categories)).toEqual(new Set(['Operator']));
		});
	});

	test.describe('Races', () => {
		test('shows a row per race with its high score', async ({page}) => {
			await page.click('a[data-tab="stats"]');
			await page.click('a[data-subtab="races"]');

			await expect(page.locator('#stats-races')).toBeVisible();
			await expect(page.locator('#race-stats tr')).toHaveCount(Object.keys(profileData.Stats.Races).length);
			await expect(page.locator('#race-stats tr').first()).toContainText('Orb Vallis');
		});
	});

	test.describe('Missions', () => {
		test('shows a high score column', async ({page}) => {
			await page.click('a[data-tab="missions"]');

			await expect(page.locator('#missions thead th', {hasText: 'High Score'})).toBeVisible();
			const scores = await page.evaluate(() =>
				[...document.querySelectorAll<HTMLTableRowElement>('#missions tbody tr')].map(tr => tr.cells[3].textContent));
			expect(scores.some(score => (score ?? '') !== '')).toBe(true);
		});
	});

	test.describe('Syndicates', () => {
		test('shows the daily standing left for a profile fetched today', async ({page}) => {
			await page.click('a[data-tab="syndicates"]');

			const cap = (16_000 + (500 * profileData.Results[0].PlayerLevel)).toLocaleString();
			const holdfasts = page.locator('#syndicates .card', {hasText: 'The Holdfasts'});
			await expect(holdfasts).toContainText(`Daily standing left: 0 / ${cap}`);

			const cavia = page.locator('#syndicates .card', {hasText: 'Cavia'});
			await expect(cavia).toContainText(`Daily standing left: ${(13_500).toLocaleString()} / ${cap}`);
		});
	});
	test.describe('Aggregate tables', () => {
		const tables = [
			{
				name: 'equipment',
				container: '#equipment-aggregates',
				entries: '#equipment-stats',
				rows: '#equipment-aggregate-rows',
				total: '#equipment-aggregate-total',
				blankColumn: 'Hit %',
				headings: ['#', 'Item', 'Hours', 'Kills', 'Assists', 'Headshots', 'Fired', 'Hit %', 'Affinity'],
				entryHeadings: ['#', 'Item', 'Used', 'Hours', 'Kills', 'Assists', 'Headshots', 'Fired', 'Hit %', 'Affinity'],
			},
			{
				name: 'enemies',
				container: '#enemy-aggregates',
				entries: '#enemy-stats',
				rows: '#enemy-aggregate-rows',
				total: '#enemy-aggregate-total',
				blankColumn: undefined,
				headings: ['#', 'Enemy', 'Kills', 'Assists', 'Headshots', 'Finishers', 'Deaths', 'Scans'],
				entryHeadings: ['#', 'Enemy', 'Kills', 'Assists', 'Headshots', 'Finishers', 'Deaths', 'Scans'],
			},
		];

		for (const table of tables) {
			test.describe(table.name, () => {
				test.beforeEach(async ({page}) => {
					await page.click('a[data-tab="stats"]');
					await page.click(`a[data-subtab="${table.name}"]`);
				});

				test('has the entry table\'s headings, apart from Used', async ({page}) => {
					await expect(page.locator(`${table.container} thead th`)).toHaveText(table.headings);
					await expect(page.locator(table.entries).locator('xpath=ancestor::table//thead//th')).toHaveText(table.entryHeadings);
				});

				test('ranks the groups from 1, with the total unranked and last', async ({page}) => {
					const ranks = await page.locator(`${table.rows} tr td:first-child`).allTextContents();
					expect(ranks.length).toBeGreaterThan(2);
					expect(ranks).toEqual(Array.from({length: ranks.length}, (_, i) => String(i + 1)));
					await expect(page.locator(`${table.total} tr`)).toContainText('Total');
					await expect(page.locator(`${table.total} tr td`).first()).toHaveText('');
				});

				test('sorts by a column when its heading is clicked, renumbering the ranks and keeping the total at the bottom', async ({page}) => {
					await waitForSortableTable(page, table.rows);
					const heading = page.locator(`${table.container} thead th`, {hasText: 'Kills'});
					await heading.click();
					await heading.click();

					const killsIndex = table.headings.indexOf('Kills');
					const killCells = await page.locator(`${table.rows} tr td:nth-child(${killsIndex + 1})`).allTextContents();
					const kills = killCells.map(cell => Number(cell.replaceAll(',', '')));
					expect(kills).toEqual([...kills].sort((a, b) => a - b));
					const ranks = await page.locator(`${table.rows} tr td:first-child`).allTextContents();
					expect(ranks).toEqual(Array.from({length: ranks.length}, (_, i) => String(i + 1)));
					await expect(page.locator(`${table.total} tr`)).toContainText('Total');
				});

				test('sorts blank figures last when descending', async ({page}) => {
					test.skip(table.blankColumn === undefined, 'no column with blank figures');
					await waitForSortableTable(page, table.rows);
					const heading = page.locator(`${table.container} thead th`, {hasText: table.blankColumn});
					await heading.click();

					const index = table.headings.indexOf(table.blankColumn!);
					const cells = await page.locator(`${table.rows} tr td:nth-child(${index + 1})`).allTextContents();
					const firstBlank = cells.indexOf('—');
					expect(firstBlank, 'some blank cells to check').toBeGreaterThan(0);
					expect(cells.slice(firstBlank).every(cell => cell === '—')).toBe(true);
				});

				test('totals the kills of the entries shown in the table below, which leaves out the unnamed ones by default', async ({page}) => {
					const [aggregateTotal, entriesTotal] = await page.evaluate(([container, entries]) => {
						const toNumber = (text: string | undefined) => Number((text ?? '').replaceAll(',', ''));
						const entryTable = document.querySelector(entries)!.closest('table')!;
						const killsIndex = [...entryTable.querySelectorAll(':scope thead th')].findIndex(th => th.textContent === 'Kills');
						const aggregateTable = document.querySelector(`${container} table`)!;
						const aggregateKillsIndex = [...aggregateTable.querySelectorAll(':scope thead th')].findIndex(th => th.textContent === 'Kills');
						return [
							toNumber(aggregateTable.querySelector(':scope tfoot tr')!.children[aggregateKillsIndex].textContent),
							[...document.querySelectorAll<HTMLTableRowElement>(`${entries} tr`)].filter(row => getComputedStyle(row).display !== 'none').reduce((sum, row) => sum + toNumber(row.children[killsIndex].textContent), 0),
						];
					}, [table.container, table.entries]);
					expect(aggregateTotal).toBeGreaterThan(0);
					expect(aggregateTotal).toBe(entriesTotal);
				});
			});
		}
	});
});

test.describe('Profile with nothing in it', () => {
	test('omits the "Marked by" line when nothing has marked the player', async ({page}) => {
		await openProfile(page, emptyProfileData);

		await expect(page.locator('#profile-name')).toContainText('EmptyProfile');
		await expect(page.locator('#marks')).toBeHidden();
	});
});
