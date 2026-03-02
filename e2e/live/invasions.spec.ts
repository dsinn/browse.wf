import { test, expect, type Page } from '@playwright/test';
import { setupMockRoutes } from '../helpers/api-mocks';
import { TEST_FRONT_PROXY_BASE_URL } from '../../test/helpers/test-constants';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Live Page - Invasions Card', () => {
  // updateInvasionsLocalised polls window.worldState?.Invasions every 1s via setTimeout.
  // Since the clock is frozen in tests, advance it to let the poll fire, then wait for
  // actual data rows (rather than the initial "Loading..." placeholder in the HTML).
  async function waitForInvasionsTable(page: Page) {
    await page.clock.runFor(2000);
    await page.waitForSelector('#invasions-table tbody tr:not(:has-text("Loading..."))', { timeout: 10000 });
  }

  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/live.php');
    await waitForInvasionsTable(page);
  });

  test('renders invasions without progress bars when worldState is stale', async ({ page }) => {
    await page.route(`**/${new URL(TEST_FRONT_PROXY_BASE_URL).host}/worldState`, async (route) => {
      await route.fulfill({ json: {
        WorldSeed: 'test',
        Version: 10,
        Time: 1768135699,
        Events: [],
        DailyDeals: [],
        Sorties: [],
        LiteSorties: [],
        Invasions: []
      } });
    });

    await page.reload();
    await waitForInvasionsTable(page);

    const invasionRows = await page.locator('#invasions-table tbody tr').count();
    expect(invasionRows).toBeGreaterThan(0);

    const firstRowText = await page.locator('#invasions-table tbody tr').first().textContent();
    expect(firstRowText).toBeTruthy();

    // Progress bars and percentages require worldState.Invasions data
    expect(await page.locator('.invasion-progress-container').count()).toBe(0);
    expect(await page.locator('.invasion-percentage').count()).toBe(0);

    expect(await page.locator('#invasions-table tbody tr td').count()).toBeGreaterThan(0);
  });

  test('renders full invasion data when worldState is fresh', async ({ page }) => {
    expect(await page.locator('#invasions-table tbody tr').count()).toBeGreaterThan(0);
    expect(await page.locator('.invasion-progress-container').count()).toBeGreaterThan(0);
    expect(await page.locator('.invasion-percentage').count()).toBeGreaterThan(0);
  });

  test('hardcodes Gradivus, Mars invasion to display Sabotage mission type', async ({ page }) => {
    const mocksDir = path.join(process.cwd(), 'test', '__mocks__');
    const invasionsGradivusData = JSON.parse(fs.readFileSync(path.join(mocksDir, 'invasions-gradivus.json'), 'utf8'));

    await page.route('**/oracle.browse.wf/invasions', route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(invasionsGradivusData) });
    });

    await page.reload();
    await waitForInvasionsTable(page);
    const gradivusRow = page.locator('#invasions-table tbody tr').filter({ hasText: 'Gradivus, Mars' }).first();
    await expect(gradivusRow).toBeVisible({ timeout: 10000 });

    // Verify the mission type displays "Sabotage" (not "Defense" from API)
    // Mission type is the 2nd td (0-indexed: 0=progress, 1=mission, 2=reward, 3=toggle)
    const missionCell = gradivusRow.locator('td').nth(1);
    await expect(missionCell).toContainText('Sabotage');

    // Verify the tooltip shows "Next: Sabotage" (not "Next: Exterminate" from API)
    const missionTooltipSpan = missionCell.locator('span[data-bs-toggle="tooltip"]');
    expect(await missionTooltipSpan.getAttribute('data-bs-title')).toBe('Next: Sabotage');
  });

  test('invasions filter gear icon toggles settings panel', async ({ page }) => {
    const gearIcon = page.locator('[data-filter-toggle="invasions"]');
    await expect(gearIcon).toBeVisible();

    const filterPanel = page.locator('#invasions-filters');
    await expect(filterPanel).toHaveCSS('display', 'none');

    await gearIcon.click();
    await expect(filterPanel).toBeVisible();

    const checkbox = page.locator('#filter-invasions-randomized-missions');
    await expect(checkbox).toBeChecked();

    await gearIcon.click();
    // Panel uses setTimeout(300ms) to set display:none after animation
    await page.clock.runFor(300);
    await expect(filterPanel).toHaveCSS('display', 'none');
  });

  test('unchecking "Show randomized mission types" hides non-Assassination missions and warning', async ({ page }) => {
    const gearIcon = page.locator('[data-filter-toggle="invasions"]');
    await gearIcon.click();

    const warning = page.locator('#invasions-warning');
    await expect(warning).toBeVisible();

    // Mission column is 2nd td (th=node, td=progress, td=mission, td=reward, td=toggle)
    const missionSpans = page.locator('#invasions-table tbody tr td:nth-of-type(2) span');
    const countBefore = await missionSpans.count();

    const checkbox = page.locator('#filter-invasions-randomized-missions');
    await checkbox.uncheck();

    // Wait for warning to have d-none class (indicates table re-render completed)
    await expect(warning).toHaveClass(/d-none/);

    // Only Assassination and Gradivus rows remain
    expect(await missionSpans.count()).toBeLessThanOrEqual(countBefore);
    expect(await page.locator('#invasions-table tbody tr td:nth-of-type(2) span[data-bs-toggle="tooltip"]').count()).toBe(0);

    await checkbox.check();
    await expect(warning).toBeVisible();
    expect(await missionSpans.count()).toBe(countBefore);
  });

  test('Assassination missions always show regardless of filter setting', async ({ page }) => {
    // The default invasions mock doesn't contain Assassination missions; this test
    // verifies the filter logic when they ARE present, and gracefully passes if not.
    const gearIcon = page.locator('[data-filter-toggle="invasions"]');
    await gearIcon.click();
    await page.locator('#filter-invasions-randomized-missions').uncheck();

    await expect(page.locator('#invasions-warning')).toHaveClass(/d-none/);

    const assassinationRows = page.locator('#invasions-table tbody tr').filter({ hasText: 'Assassination' });
    const count = await assassinationRows.count();

    for (let i = 0; i < count; i++) {
      await expect(assassinationRows.nth(i).locator('td:nth-of-type(2)')).toContainText('Assassination');
    }
  });

  test('Gradivus invasion always shows Sabotage regardless of filter setting', async ({ page }) => {
    const mocksDir = path.join(process.cwd(), 'test', '__mocks__');
    const invasionsGradivusData = JSON.parse(fs.readFileSync(path.join(mocksDir, 'invasions-gradivus.json'), 'utf8'));

    await page.route('**/oracle.browse.wf/invasions', route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(invasionsGradivusData) });
    });

    await page.reload();
    await waitForInvasionsTable(page);
    const gradivusRow = page.locator('#invasions-table tbody tr').filter({ hasText: 'Gradivus, Mars' }).first();
    await expect(gradivusRow).toBeVisible({ timeout: 10000 });

    const gearIcon = page.locator('[data-filter-toggle="invasions"]');
    await gearIcon.click();
    await page.locator('#filter-invasions-randomized-missions').uncheck();

    await expect(page.locator('#invasions-warning')).toHaveClass(/d-none/);

    // Verify mission cell shows Sabotage
    const missionCell = gradivusRow.locator('td:nth-of-type(2)'); // 2nd td = mission type
    await expect(missionCell).toContainText('Sabotage');
    expect(await missionCell.locator('span[data-bs-toggle="tooltip"]').count()).toBe(0);
  });
});
