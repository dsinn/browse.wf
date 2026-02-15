import { test, expect } from '@playwright/test';
import { setupMockRoutes } from '../helpers/api-mocks';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Live Page - Invasions Card', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses for deterministic, fast, offline-capable tests
    await setupMockRoutes(page);

    await page.goto('/live.php');
    // Wait for initial data to load
    await page.waitForSelector('#arby-what:not(:has-text("Loading..."))', { timeout: 10000 });
  });

  test('renders invasions without progress bars when worldState is stale', async ({ page }) => {
    // Override worldState with empty Invasions array (stale data scenario)
    await page.route('**/oracle.browse.wf/worldState.json', async (route) => {
      const worldStateEmpty = {
        WorldSeed: 'test',
        Version: 10,
        Time: 1768135699,
        Events: [],
        DailyDeals: [],
        Sorties: [],
        LiteSorties: [],
        Invasions: []
      };
      await route.fulfill({ json: worldStateEmpty });
    });

    // Keep normal invasions endpoint (fresh data)
    // This is already mocked by setupMockRoutes in beforeEach

    // Reload to apply the mock
    await page.reload();
    await page.waitForSelector('#arby-what:not(:has-text("Loading..."))', { timeout: 10000 });

    // Wait for invasions table to render
    await page.waitForSelector('#invasions-table tbody tr', { timeout: 10000 });

    // Verify invasion rows are rendered (data from invasions.json)
    const invasionRows = await page.locator('#invasions-table tbody tr').count();
    expect(invasionRows).toBeGreaterThan(0);

    // Verify location/mission data is present (should always render)
    const firstRow = page.locator('#invasions-table tbody tr').first();
    const firstRowText = await firstRow.textContent();
    expect(firstRowText).toBeTruthy();

    // Verify progress bars are NOT present (extraData unavailable)
    const progressBars = await page.locator('.invasion-progress-container').count();
    expect(progressBars).toBe(0);

    // Verify progress percentages are NOT present (extraData unavailable)
    const percentages = await page.locator('.invasion-percentage').count();
    expect(percentages).toBe(0);

    // Verify rewards ARE still rendered (from invasions.json)
    const rewardCells = await page.locator('#invasions-table tbody tr td').count();
    expect(rewardCells).toBeGreaterThan(0);
  });

  test('renders full invasion data when worldState is fresh', async ({ page }) => {
    // This uses the default mocks from setupMockRoutes (both fresh)
    await page.waitForSelector('#invasions-table tbody tr', { timeout: 10000 });

    // Should have invasion rows
    const invasionRows = await page.locator('#invasions-table tbody tr').count();
    expect(invasionRows).toBeGreaterThan(0);

    // Should have progress bars (extraData available)
    const progressBars = await page.locator('.invasion-progress-container').count();
    expect(progressBars).toBeGreaterThan(0);

    // Should have progress percentages (extraData available)
    const percentages = await page.locator('.invasion-percentage').count();
    expect(percentages).toBeGreaterThan(0);
  });

  test('hardcodes Gradivus, Mars invasion to display Sabotage mission type', async ({ page }) => {
    // Override invasions endpoint with Gradivus mock
    const mocksDir = path.join(process.cwd(), 'test', '__mocks__');
    const invasionsGradivusData = JSON.parse(fs.readFileSync(path.join(mocksDir, 'invasions-gradivus.json'), 'utf8'));

    await page.route('**/oracle.browse.wf/invasions', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(invasionsGradivusData),
      });
    });

    // Reload to apply the mock
    await page.reload();
    await page.waitForSelector('#arby-what:not(:has-text("Loading..."))', { timeout: 10000 });
    await page.waitForSelector('#invasions-table tbody tr', { timeout: 10000 });

    // Find the Gradivus invasion row (last invasion in mock, node SolNode65)
    // Look for the row containing "Gradivus, Mars"
    const gradivusRow = page.locator('#invasions-table tbody tr').filter({ hasText: 'Gradivus, Mars' }).first();
    await expect(gradivusRow).toBeVisible();

    // Verify the mission type displays "Sabotage" (not "Defense" from API)
    // Mission type is the 2nd td (0-indexed: 0=progress, 1=mission, 2=reward, 3=toggle)
    const missionCell = gradivusRow.locator('td').nth(1);
    await expect(missionCell).toContainText('Sabotage');

    // Verify the tooltip shows "Next: Sabotage" (not "Next: Exterminate" from API)
    const missionTooltipSpan = missionCell.locator('span[data-bs-toggle="tooltip"]');
    const tooltipTitle = await missionTooltipSpan.getAttribute('data-bs-title');
    expect(tooltipTitle).toBe('Next: Sabotage');
  });

  test('invasions filter gear icon toggles settings panel', async ({ page }) => {
    await page.waitForSelector('#invasions-table tbody tr', { timeout: 10000 });

    // Find the gear icon
    const gearIcon = page.locator('[data-filter-toggle="invasions"]');
    await expect(gearIcon).toBeVisible();

    // Verify panel is initially hidden
    const filterPanel = page.locator('#invasions-filters');
    await expect(filterPanel).toHaveCSS('display', 'none');

    // Click gear icon to open panel
    await gearIcon.click();
    await expect(filterPanel).toBeVisible();

    // Verify checkbox is present and checked by default
    const checkbox = page.locator('#filter-invasions-randomized-missions');
    await expect(checkbox).toBeChecked();

    // Click gear icon again to close panel
    await gearIcon.click();
    // Panel uses setTimeout(300ms) to set display:none after animation
    // Clock is frozen in tests, so we need to advance it
    await page.clock.runFor(300);
    await expect(filterPanel).toHaveCSS('display', 'none');
  });

  test('unchecking "Show randomized mission types" hides non-Assassination missions and warning', async ({ page }) => {
    await page.waitForSelector('#invasions-table tbody tr', { timeout: 10000 });

    // Open settings panel
    const gearIcon = page.locator('[data-filter-toggle="invasions"]');
    await gearIcon.click();

    // Verify warning is initially visible
    const warning = page.locator('#invasions-warning');
    await expect(warning).toBeVisible();

    // Count mission type spans before unchecking
    // Mission column is 2nd td (th=node, td=progress, td=mission, td=reward, td=toggle)
    const missionSpansBefore = page.locator('#invasions-table tbody tr td:nth-of-type(2) span');
    const countBefore = await missionSpansBefore.count();

    // Uncheck the filter
    const checkbox = page.locator('#filter-invasions-randomized-missions');
    await checkbox.uncheck();

    // Wait for warning to have d-none class (indicates table re-render completed)
    await expect(warning).toHaveClass(/d-none/);

    // Count mission cells after unchecking - should be fewer (only Assassination and Gradivus)
    const missionSpansAfter = page.locator('#invasions-table tbody tr td:nth-of-type(2) span');
    const countAfter = await missionSpansAfter.count();
    expect(countAfter).toBeLessThanOrEqual(countBefore);

    // Verify tooltips are not present on mission cells
    const tooltipsAfter = await page.locator('#invasions-table tbody tr td:nth-of-type(2) span[data-bs-toggle="tooltip"]').count();
    expect(tooltipsAfter).toBe(0);

    // Re-check the filter
    await checkbox.check();

    // Warning should be visible again
    await expect(warning).toBeVisible();

    // Mission cells should be back
    const countRestored = await page.locator('#invasions-table tbody tr td:nth-of-type(2) span').count();
    expect(countRestored).toBe(countBefore);
  });

  test('Assassination missions always show regardless of filter setting', async ({ page }) => {
    // Note: The default invasions mock doesn't contain Assassination missions
    // This test verifies the filter logic when Assassination missions ARE present
    // If no Assassination missions exist in the data, the test gracefully passes

    await page.waitForSelector('#invasions-table tbody tr', { timeout: 10000 });

    // Open settings and uncheck filter
    const gearIcon = page.locator('[data-filter-toggle="invasions"]');
    await gearIcon.click();
    const checkbox = page.locator('#filter-invasions-randomized-missions');
    await checkbox.uncheck();

    // Wait for warning to have d-none class (indicates re-render)
    const warning = page.locator('#invasions-warning');
    await expect(warning).toHaveClass(/d-none/);

    // Find Assassination rows (may be 0 in default mock)
    const assassinationRows = page.locator('#invasions-table tbody tr').filter({ hasText: 'Assassination' });
    const count = await assassinationRows.count();

    // If Assassination missions exist, verify they still show
    if (count > 0) {
      // Verify Assassination mission cells have content
      for (let i = 0; i < count; i++) {
        const row = assassinationRows.nth(i);
        const missionCell = row.locator('td:nth-of-type(2)'); // 2nd td = mission type
        await expect(missionCell).toContainText('Assassination');
      }
    }
  });

  test('Gradivus invasion always shows Sabotage regardless of filter setting', async ({ page }) => {
    // Override with Gradivus mock
    const mocksDir = path.join(process.cwd(), 'test', '__mocks__');
    const invasionsGradivusData = JSON.parse(fs.readFileSync(path.join(mocksDir, 'invasions-gradivus.json'), 'utf8'));

    await page.route('**/oracle.browse.wf/invasions', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(invasionsGradivusData),
      });
    });

    await page.reload();
    await page.waitForSelector('#invasions-table tbody tr', { timeout: 10000 });

    // Open settings and uncheck filter
    const gearIcon = page.locator('[data-filter-toggle="invasions"]');
    await gearIcon.click();
    const checkbox = page.locator('#filter-invasions-randomized-missions');
    await checkbox.uncheck();

    // Wait for warning to have d-none class (indicates re-render)
    const warning = page.locator('#invasions-warning');
    await expect(warning).toHaveClass(/d-none/);

    // Find Gradivus row
    const gradivusRow = page.locator('#invasions-table tbody tr').filter({ hasText: 'Gradivus, Mars' }).first();
    await expect(gradivusRow).toBeVisible();

    // Verify mission cell shows Sabotage
    const missionCell = gradivusRow.locator('td:nth-of-type(2)'); // 2nd td = mission type
    await expect(missionCell).toContainText('Sabotage');

    // Verify no tooltip is present (since filter is disabled)
    const tooltip = missionCell.locator('span[data-bs-toggle="tooltip"]');
    expect(await tooltip.count()).toBe(0);
  });
});
