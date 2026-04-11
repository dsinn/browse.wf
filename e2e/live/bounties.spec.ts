import {test, expect} from '@playwright/test';
import {setupMockRoutes} from '../helpers/api-mocks';

test.describe('Live Page - Bounties Card', () => {
	test.beforeEach(async ({page}) => {
		await setupMockRoutes(page);
		await page.goto('/live');
		await expect(page.locator('#bounties-body')).not.toContainText('Fetching data...', {timeout: 10_000});
	});

	test.describe('Mission Type Filters', () => {
		test.beforeEach(async ({page}) => {
			await page.locator('[data-filter-toggle="bounties"]').click();
			await expect(page.locator('[data-bounty-syndicate="HexSyndicate"][data-filter-type="MT_SURVIVAL"]')).toBeVisible();
		});

		test.afterEach(async ({page}) => {
			await page.evaluate(() => {
				localStorage.clear();
			});
		});

		test('unchecking a mission type hides matching rows', async ({page}) => {
			// Cavia: T1=Alchemy, T2=Disruption, T3=Survival, T4=Assassination, T5=Exterminate
			// Uncheck Survival — hides T3 only
			await page.locator('[data-bounty-syndicate="EntratiLabSyndicate"][data-filter-type="MT_SURVIVAL"]').uncheck();
			await expect(page.locator('#EntratiLabSyndicate-table tr:visible')).toHaveCount(4);
		});

		test('unchecking mission types for different syndicates filters independently', async ({page}) => {
			// Uncheck Exterminate for Zariman (T4) — 4 rows remain
			await page.locator('[data-bounty-syndicate="ZarimanSyndicate"][data-filter-type="MT_EXTERMINATION"]').uncheck();
			// Uncheck Assassination for Hex (T4) — Hex has 7 rows; T4 removed → 6 remain
			await page.locator('[data-bounty-syndicate="HexSyndicate"][data-filter-type="MT_ASSASSINATION"]').uncheck();

			await expect(page.locator('#ZarimanSyndicate-table tr:visible')).toHaveCount(4);
			await expect(page.locator('#EntratiLabSyndicate-table tr:visible')).toHaveCount(5); // Unchanged
			await expect(page.locator('#HexSyndicate-table tr:visible')).toHaveCount(6);
		});

		test('unchecking all mission types for one syndicate shows empty state', async ({page}) => {
			// Uncheck all Cavia mission types
			for (const mt of ['MT_ASSASSINATION', 'MT_EXTERMINATION', 'MT_SURVIVAL', 'MT_ALCHEMY', 'MT_DEFENSE', 'MT_ARTIFACT']) {
				await page.locator(`[data-bounty-syndicate="EntratiLabSyndicate"][data-filter-type="${mt}"]`).uncheck();
			}

			await expect(page.locator('#EntratiLabSyndicate-empty')).toBeVisible();
			await expect(page.locator('#EntratiLabSyndicate-table tr:visible')).toHaveCount(0);
			// Other syndicates unaffected
			await expect(page.locator('#ZarimanSyndicate-empty')).toBeHidden();
			await expect(page.locator('#HexSyndicate-empty')).toBeHidden();
		});

		test('unchecked mission types persist after reload', async ({page}) => {
			await page.locator('[data-bounty-syndicate="EntratiLabSyndicate"][data-filter-type="MT_SURVIVAL"]').uncheck();
			await page.locator('[data-bounty-syndicate="HexSyndicate"][data-filter-type="MT_DEFENSE"]').uncheck();

			await page.reload();
			await expect(page.locator('#bounties-body')).not.toContainText('Fetching data...', {timeout: 10_000});
			await page.locator('[data-filter-toggle="bounties"]').click();
			await expect(page.locator('#bounties-filters')).toBeVisible();

			await expect(page.locator('[data-bounty-syndicate="EntratiLabSyndicate"][data-filter-type="MT_SURVIVAL"]')).not.toBeChecked();
			await expect(page.locator('[data-bounty-syndicate="HexSyndicate"][data-filter-type="MT_DEFENSE"]')).not.toBeChecked();
			// Unrelated checkbox should remain checked
			await expect(page.locator('[data-bounty-syndicate="EntratiLabSyndicate"][data-filter-type="MT_ALCHEMY"]')).toBeChecked();
		});

		test('rechecking a mission type restores visibility', async ({page}) => {
			const checkbox = page.locator('[data-bounty-syndicate="ZarimanSyndicate"][data-filter-type="MT_VOID_CASCADE"]');
			await checkbox.uncheck();
			await expect(page.locator('#ZarimanSyndicate-table tr:visible')).toHaveCount(4);

			await checkbox.check();
			await expect(page.locator('#ZarimanSyndicate-table tr:visible')).toHaveCount(5);
		});

		test('Hex Survival: unchecking hides all three Survival tiers (T2, T6, T7)', async ({page}) => {
			// Wait for all 7 Hex rows to have data-mission-type stamped before filtering
			await expect(page.locator('#HexSyndicate-table tr[data-mission-type]')).toHaveCount(7);
			// Hex has 7 tiers; T2, T6, T7 are all MT_SURVIVAL
			await page.locator('[data-bounty-syndicate="HexSyndicate"][data-filter-type="MT_SURVIVAL"]').uncheck();
			await expect(page.locator('#HexSyndicate-table tr:visible')).toHaveCount(4);
		});
	});

	test.describe('Tier Filters', () => {
		test('clicking gear icon shows bounty filter panel', async ({page}) => {
			const bountyFilterToggle = page.locator('[data-filter-toggle="bounties"]');
			const filterPanel = page.locator('#bounties-filters');

			await expect(filterPanel).toBeHidden();
			await bountyFilterToggle.click();
			await expect(filterPanel).toBeVisible();
		});

		test('all three syndicate dropdowns exist with correct options', async ({page}) => {
			const bountyFilterToggle = page.locator('[data-filter-toggle="bounties"]');
			await bountyFilterToggle.click();
			await expect(page.locator('#bounties-filters')).toBeVisible();

			const holdfastDropdown = page.locator('#bounty-filter-ZarimanSyndicate');
			await expect(holdfastDropdown).toBeVisible();
			expect(await holdfastDropdown.locator('option').count()).toBe(6); // Tier 1-5 + Hide

			const caviaDropdown = page.locator('#bounty-filter-EntratiLabSyndicate');
			await expect(caviaDropdown).toBeVisible();
			expect(await caviaDropdown.locator('option').count()).toBe(6); // Tier 1-5 + Hide

			const hexDropdown = page.locator('#bounty-filter-HexSyndicate');
			await expect(hexDropdown).toBeVisible();
			expect(await hexDropdown.locator('option').count()).toBe(8); // Tier 1-7 + Hide
		});

		test('filter preferences persist in localStorage', async ({page}) => {
			await page.waitForSelector('#EntratiLabSyndicate-table tr', {timeout: 10_000});

			const bountyFilterToggle = page.locator('[data-filter-toggle="bounties"]');
			await bountyFilterToggle.click();
			await expect(page.locator('#bounties-filters')).toBeVisible();

			const caviaDropdown = page.locator('#bounty-filter-EntratiLabSyndicate');
			await caviaDropdown.selectOption('4');
			expect(await caviaDropdown.inputValue()).toBe('4');

			await page.reload();
			await expect(page.locator('#bounties-body')).not.toContainText('Fetching data...', {timeout: 10_000});

			await bountyFilterToggle.click();
			await expect(page.locator('#bounties-filters')).toBeVisible();
			expect(await caviaDropdown.inputValue()).toBe('4');
			expect(await page.locator('#EntratiLabSyndicate-table tr:visible').count()).toBe(2); // Only Tier 4 and 5 visible
		});

		test('different syndicates filter independently', async ({page}) => {
			await page.waitForSelector('#ZarimanSyndicate-table tr', {timeout: 10_000});

			await page.locator('[data-filter-toggle="bounties"]').click();
			await expect(page.locator('#bounties-filters')).toBeVisible();

			await page.locator('#bounty-filter-ZarimanSyndicate').selectOption('3');
			await page.locator('#bounty-filter-EntratiLabSyndicate').selectOption('5');
			await page.locator('#bounty-filter-HexSyndicate').selectOption('-1');

			await expect(page.locator('#ZarimanSyndicate-table tr:visible')).toHaveCount(3); // Tier 3, 4, 5
			await expect(page.locator('#EntratiLabSyndicate-table tr:visible')).toHaveCount(1); // Tier 5 only
			await expect(page.locator('#HexSyndicate-name')).toBeHidden();
		});
	});

	test.describe('Deimos Bounties Filter', () => {
		test.beforeEach(async ({page}) => {
			await page.locator('[data-filter-toggle="bounties"]').click();
			await expect(page.locator('[data-bounty-syndicate="HexSyndicate"][data-filter-type="MT_SURVIVAL"]')).toBeVisible();
		});

		test.afterEach(async ({page}) => {
			await page.evaluate(() => {
				localStorage.clear();
			});
		});

		test('Deimos rotation row is visible by default', async ({page}) => {
			await expect(page.locator('#deimos-bounty-row')).toBeVisible();
		});

		test('unchecking Deimos bounties hides the rotation row; rechecking restores it', async ({page}) => {
			await page.locator('#bounty-filter-deimos').uncheck();
			await expect(page.locator('#deimos-bounty-row')).toBeHidden();
			await page.locator('#bounty-filter-deimos').check();
			await expect(page.locator('#deimos-bounty-row')).toBeVisible();
		});

		test('"no bounties" message appears when Deimos unchecked and all syndicates hidden', async ({page}) => {
			const allHiddenElement = page.locator('.bounties-all-hidden');
			await expect(allHiddenElement).toBeHidden();
			await page.locator('#bounty-filter-deimos').uncheck();
			await expect(allHiddenElement).toBeHidden();
			await page.locator('#bounty-filter-ZarimanSyndicate').selectOption('-1');
			await expect(allHiddenElement).toBeHidden();
			await page.locator('#bounty-filter-EntratiLabSyndicate').selectOption('-1');
			await expect(allHiddenElement).toBeHidden();
			await page.locator('#bounty-filter-HexSyndicate').selectOption('-1');
			await expect(allHiddenElement).toBeVisible();
		});

		test('"no bounties" message hidden when Deimos is checked', async ({page}) => {
			await page.locator('#bounty-filter-ZarimanSyndicate').selectOption('-1');
			await page.locator('#bounty-filter-EntratiLabSyndicate').selectOption('-1');
			await page.locator('#bounty-filter-HexSyndicate').selectOption('-1');
			await expect(page.locator('.bounties-all-hidden')).toBeHidden();
		});

		test('"no bounties" message hidden when at least one syndicate is visible', async ({page}) => {
			await page.locator('#bounty-filter-deimos').uncheck();
			await page.locator('#bounty-filter-ZarimanSyndicate').selectOption('-1');
			await page.locator('#bounty-filter-EntratiLabSyndicate').selectOption('-1');
			await expect(page.locator('.bounties-all-hidden')).toBeHidden();
		});

		test('Deimos filter preference persists after reload', async ({page}) => {
			await page.locator('#bounty-filter-deimos').uncheck();
			await page.reload();
			await expect(page.locator('#bounties-body')).not.toContainText('Fetching data...', {timeout: 10_000});
			await expect(page.locator('#deimos-bounty-row')).toBeHidden();
		});
	});

	test.describe('Bounty Checkboxes', () => {
		test.beforeEach(async ({page}) => {
			await page.waitForSelector('#EntratiLabSyndicate-name .completion-check', {timeout: 10_000});
		});

		test('Cavia heading has a completion checkbox', async ({page}) => {
			await expect(page.locator('#EntratiLabSyndicate-name .completion-check')).toBeVisible();
		});

		test('Hex heading has a completion checkbox', async ({page}) => {
			await expect(page.locator('#HexSyndicate-name .completion-check')).toBeVisible();
		});

		test('clicking Cavia checkbox toggles to checked state', async ({page}) => {
			const checkbox = page.locator('#EntratiLabSyndicate-name .completion-check');
			await expect(checkbox.locator('.bi-square')).toBeVisible();
			await checkbox.click();
			await expect(checkbox.locator('.bi-check-square')).toBeVisible();
		});

		test('checkbox state persists in localStorage after reload', async ({page}) => {
			const checkbox = page.locator('#EntratiLabSyndicate-name .completion-check');
			await checkbox.click();
			await expect(checkbox.locator('.bi-check-square')).toBeVisible();

			const oid = await checkbox.getAttribute('data-oid');
			expect(oid).toBeTruthy();

			await page.reload();
			await page.waitForSelector('#EntratiLabSyndicate-name .completion-check', {timeout: 10_000});

			const completedOids = await page.evaluate(() => {
				const stored = localStorage.getItem('oids_completed');
				return stored ? JSON.parse(stored) : [];
			});
			expect(completedOids).toContain(oid);

			await expect(page.locator('#EntratiLabSyndicate-name .completion-check .bi-check-square')).toBeVisible();
		});
	});
});
