import { test, expect, type Page } from '@playwright/test';
import { setupMockRoutes } from '../helpers/api-mocks';

test.describe('Live Page - Invasions Card', () => {
  // Wait for actual invasion data rows to appear (not the "Loading..." placeholder)
  async function waitForInvasionsTable(page: Page) {
    await page.waitForSelector('#invasions-table tbody tr:visible:not(:has-text("Loading..."))', { timeout: 10000 });
  }

  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/live.php');
    await waitForInvasionsTable(page);
  });

  test('renders invasion rows end-to-end', async ({ page }) => {
    expect(await page.locator('#invasions-table tbody tr:visible').count()).toBeGreaterThan(0);
  });

  test('unchecking a reward filter hides rows and re-checking restores them', async ({ page }) => {
    await setupMockRoutes(page, { worldStateFile: 'worldState-invasions.json' });
    await page.goto('/live.php');
    await waitForInvasionsTable(page);

    const rowsBefore = await page.locator('#invasions-table tbody tr:visible').count();

    await page.locator('[data-filter-toggle="invasions"]').click();
    await page.locator('#filter-invasions-reward-KarakWraith').uncheck();
    await expect(page.locator('#invasions-table tbody tr:visible')).not.toHaveCount(rowsBefore);

    await page.locator('#filter-invasions-reward-KarakWraith').check();
    await expect(page.locator('#invasions-table tbody tr:visible')).toHaveCount(rowsBefore);
  });
});
