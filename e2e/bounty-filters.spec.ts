import { test, expect } from '@playwright/test';
import { setupMockRoutes } from './helpers/api-mocks';

test.describe('Bounty Filters (/live)', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses for deterministic, fast, offline-capable tests
    await setupMockRoutes(page);

    await page.goto('/live.php');
    // Wait for initial data to load (arbitration card loads quickly)
    await page.waitForSelector('#arby-what:not(:has-text("Loading..."))', { timeout: 10000 });
  });

  test('clicking gear icon shows bounty filter panel', async ({ page }) => {
    const bountyFilterToggle = page.locator('[data-filter-toggle="bounties"]');
    const filterPanel = page.locator('#bounties-filters');

    // Filter panel should not be visible initially
    await expect(filterPanel).toBeHidden();

    // Click gear icon
    await bountyFilterToggle.click();

    // Filter panel should now be visible
    await expect(filterPanel).toBeVisible();
  });

  test('all three syndicate dropdowns exist with correct options', async ({ page }) => {
    const bountyFilterToggle = page.locator('[data-filter-toggle="bounties"]');
    await bountyFilterToggle.click();
    await expect(page.locator('#bounties-filters')).toBeVisible();

    // Check Holdfasts dropdown (5 tiers + Hide)
    const holdfastDropdown = page.locator('#bounty-filter-ZarimanSyndicate');
    await expect(holdfastDropdown).toBeVisible();
    const holdfastOptions = await holdfastDropdown.locator('option').count();
    expect(holdfastOptions).toBe(6); // Tier 1-5 + Hide

    // Check Cavia dropdown (5 tiers + Hide)
    const caviaDropdown = page.locator('#bounty-filter-EntratiLabSyndicate');
    await expect(caviaDropdown).toBeVisible();
    const caviaOptions = await caviaDropdown.locator('option').count();
    expect(caviaOptions).toBe(6); // Tier 1-5 + Hide

    // Check Hex dropdown (7 tiers + Hide)
    const hexDropdown = page.locator('#bounty-filter-HexSyndicate');
    await expect(hexDropdown).toBeVisible();
    const hexOptions = await hexDropdown.locator('option').count();
    expect(hexOptions).toBe(8); // Tier 1-7 + Hide
  });

  test('changing dropdown filters bounty tiers', async ({ page }) => {
    // Wait for bounties to load
    await page.waitForSelector('#ZarimanSyndicate-table tr', { timeout: 10000 });

    // Open filter panel
    const bountyFilterToggle = page.locator('[data-filter-toggle="bounties"]');
    await bountyFilterToggle.click();
    await expect(page.locator('#bounties-filters')).toBeVisible();

    // Get initial count of visible Holdfasts bounty rows
    const initialCount = await page.locator('#ZarimanSyndicate-table tr:visible').count();
    expect(initialCount).toBeGreaterThan(0);

    // Change to Tier 3 and up (should hide Tier 1 and 2)
    const holdfastDropdown = page.locator('#bounty-filter-ZarimanSyndicate');
    await holdfastDropdown.selectOption('3');

    // Playwright auto-waits until condition is met
    await expect(page.locator('#ZarimanSyndicate-table tr:visible')).toHaveCount(3);

    // Verify Tier 1 and 2 are hidden
    const firstRow = page.locator('#ZarimanSyndicate-table tr').nth(0);
    const secondRow = page.locator('#ZarimanSyndicate-table tr').nth(1);
    await expect(firstRow).toBeHidden();
    await expect(secondRow).toBeHidden();

    // Verify Tier 3 is visible
    const thirdRow = page.locator('#ZarimanSyndicate-table tr').nth(2);
    await expect(thirdRow).toBeVisible();
  });

  test('Hide option hides syndicate heading and all rows', async ({ page }) => {
    // Wait for bounties to load
    await page.waitForSelector('#HexSyndicate-table tr', { timeout: 10000 });

    // Open filter panel
    const bountyFilterToggle = page.locator('[data-filter-toggle="bounties"]');
    await bountyFilterToggle.click();
    await expect(page.locator('#bounties-filters')).toBeVisible();

    // Verify Hex heading and table are initially visible
    const hexHeading = page.locator('#HexSyndicate-name');
    const hexTable = page.locator('#HexSyndicate-table');
    await expect(hexHeading).toBeVisible();
    await expect(hexTable).toBeVisible();

    // Select "Hide" option
    const hexDropdown = page.locator('#bounty-filter-HexSyndicate');
    await hexDropdown.selectOption('-1');

    // Playwright auto-waits until heading is hidden
    await expect(hexHeading).toBeHidden();

    // Verify all rows are hidden
    await expect(page.locator('#HexSyndicate-table tr:visible')).toHaveCount(0);
  });

  test('filter preferences persist in localStorage', async ({ page }) => {
    // Wait for bounties to load
    await page.waitForSelector('#EntratiLabSyndicate-table tr', { timeout: 10000 });

    // Open filter panel
    const bountyFilterToggle = page.locator('[data-filter-toggle="bounties"]');
    await bountyFilterToggle.click();
    await expect(page.locator('#bounties-filters')).toBeVisible();

    // Set Cavia to Tier 4 and up
    const caviaDropdown = page.locator('#bounty-filter-EntratiLabSyndicate');
    await caviaDropdown.selectOption('4');

    // Verify setting was applied
    expect(await caviaDropdown.inputValue()).toBe('4');

    // Reload page
    await page.reload();
    await page.waitForSelector('#arby-what:not(:has-text("Loading..."))', { timeout: 10000 });

    // Open filter panel again
    await bountyFilterToggle.click();
    await expect(page.locator('#bounties-filters')).toBeVisible();

    // Verify dropdown state persisted
    expect(await caviaDropdown.inputValue()).toBe('4');

    // Verify filtering is still applied
    const visibleRows = await page.locator('#EntratiLabSyndicate-table tr:visible').count();
    expect(visibleRows).toBe(2); // Only Tier 4 and 5 visible
  });

  test('different syndicates filter independently', async ({ page }) => {
    // Wait for bounties to load
    await page.waitForSelector('#ZarimanSyndicate-table tr', { timeout: 10000 });

    // Open filter panel
    const bountyFilterToggle = page.locator('[data-filter-toggle="bounties"]');
    await bountyFilterToggle.click();
    await expect(page.locator('#bounties-filters')).toBeVisible();

    // Set different filters for each syndicate
    await page.locator('#bounty-filter-ZarimanSyndicate').selectOption('3');
    await page.locator('#bounty-filter-EntratiLabSyndicate').selectOption('5');
    await page.locator('#bounty-filter-HexSyndicate').selectOption('-1');

    // Playwright auto-waits for each condition
    await expect(page.locator('#ZarimanSyndicate-table tr:visible')).toHaveCount(3); // Tier 3, 4, 5
    await expect(page.locator('#EntratiLabSyndicate-table tr:visible')).toHaveCount(1); // Tier 5 only

    // Verify Hex is completely hidden
    const hexHeading = page.locator('#HexSyndicate-name');
    await expect(hexHeading).toBeHidden();
  });
});
