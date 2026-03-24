import {test, expect} from '@playwright/test';
import {setupMockRoutes} from '../helpers/api-mocks';

test.describe('Live Page - Bounties Card', () => {
	test.beforeEach(async ({page}) => {
		await setupMockRoutes(page);
		await page.goto('/live.php');
		await expect(page.locator('#bounties-body')).not.toContainText('Fetching data...', {timeout: 10_000});
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
