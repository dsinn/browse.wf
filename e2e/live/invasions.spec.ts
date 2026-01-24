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
    const missionCell = gradivusRow.locator('td').nth(1); // Mission type is the 2nd td (after progress percentage)
    await expect(missionCell).toContainText('Sabotage');

    // Verify the tooltip shows "Next: Sabotage" (not "Next: Exterminate" from API)
    const missionTooltipSpan = missionCell.locator('span[data-bs-toggle="tooltip"]');
    const tooltipTitle = await missionTooltipSpan.getAttribute('data-bs-title');
    expect(tooltipTitle).toBe('Next: Sabotage');
  });
});
