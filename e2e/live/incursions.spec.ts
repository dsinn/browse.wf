import { test, expect } from '@playwright/test';
import { setupMockRoutes } from '../helpers/api-mocks';

test.describe('Live Page - Steel Path Incursions Card', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/live.php');
    // Incursions are loaded via sp-incursions.txt (static file, always has current data).
    // Resume real time so the time-based lookup into the file works correctly.
    await page.clock.resume();
    await page.waitForSelector('#incursions-body span.d-block:not(:has-text("Fetching"))', { timeout: 10000 });
  });

  test('renders exactly six incursion rows', async ({ page }) => {
    await expect(page.locator('#incursions-body span.d-block')).toHaveCount(6);
  });

  test('each visible incursion row has expected text format', async ({ page }) => {
    const rows = page.locator('#incursions-body span.d-block:not(.d-none)');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).textContent();
      // "Mission Name - Faction (100-120) @ NodeName, SystemName"
      // Faction is omitted for Void nodes (systemIndex 21)
      expect(text).toMatch(/^[^-]+(?:- [^(]+)? \(\d+-\d+\) @ [^,]+, [^,]+$/);
    }
  });

  test('incursion location has tileset tooltip attribute', async ({ page }) => {
    const rows = page.locator('#incursions-body span.d-block:not(.d-none)');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const tooltipElem = rows.nth(i).locator('[data-bs-toggle="tooltip"]');
      await expect(tooltipElem).toBeVisible();
      const title = await tooltipElem.getAttribute('data-bs-title');
      expect(title, `Row ${i} should have a non-empty tileset tooltip`).toBeTruthy();
      // formatTileset strips the "Tileset" suffix and formats as "Grineer Ocean", "Corpus Ship", etc.
      expect(title).not.toMatch(/Tileset$/);
      expect(title).toMatch(/^[A-Z][a-zA-Z ]+$/);
    }
  });

  test('filter gear icon toggles filter panel visibility', async ({ page }) => {
    const filterToggle = page.locator('[data-filter-toggle="incursions"]');
    const filterPanel = page.locator('#incursions-filters');

    await expect(filterPanel).toBeHidden();
    await filterToggle.click();
    await expect(filterPanel).toBeVisible();

    // All 25 mission type checkboxes should be present
    const checkboxes = await page.locator('#incursions-filters input[type="checkbox"]').count();
    expect(checkboxes).toBe(25);
  });

  test('all filter checkboxes are accessible when panel is expanded', async ({ page }) => {
    await page.locator('[data-filter-toggle="incursions"]').click();
    await expect(page.locator('#incursions-filters')).toBeVisible();

    const firstCheckbox = page.locator('#incursions-filters input[type="checkbox"]').first();
    const lastCheckbox = page.locator('#incursions-filters input[type="checkbox"]').last();

    await expect(firstCheckbox).toBeInViewport();
    await expect(lastCheckbox).toBeEnabled();

    // Clicking scrolls it into view if needed and toggles state
    await lastCheckbox.click();
    await expect(lastCheckbox).not.toBeChecked();
  });

  test('unchecking a filter hides matching incursion rows and saves to localStorage', async ({ page }) => {
    await page.locator('[data-filter-toggle="incursions"]').click();
    await expect(page.locator('#incursions-filters')).toBeVisible();

    const initialCount = await page.locator('#incursions-body span.d-block:not(.d-none)').count();
    expect(initialCount).toBeGreaterThan(0);

    const firstCheckbox = page.locator('#incursions-filters input[type="checkbox"]:checked').first();
    const checkboxId = await firstCheckbox.getAttribute('id');
    const filterType = checkboxId!.replace('filter-incursions-', '');

    await firstCheckbox.click();

    // Wait for localStorage to confirm the filter system processed the change
    await page.waitForFunction(
      (key) => localStorage.getItem(key) === '0',
      `live.filter.incursions.${filterType}`
    );

    const newCount = await page.locator('#incursions-body span.d-block:not(.d-none)').count();
    expect(newCount).toBeLessThanOrEqual(initialCount);
  });

  test('unchecking all filters shows empty message', async ({ page }) => {
    await page.locator('[data-filter-toggle="incursions"]').click();
    await expect(page.locator('#incursions-filters')).toBeVisible();

    const emptyMessage = page.locator('#incursions-empty-message');
    await expect(emptyMessage).toBeHidden();

    const checkboxes = await page.locator('#incursions-filters input[type="checkbox"]').all();
    for (const checkbox of checkboxes) {
      if (await checkbox.isChecked()) {
        await checkbox.click();
      }
    }

    await expect(page.locator('#incursions-body span.d-block:not(.d-none)')).toHaveCount(0);
    await expect(emptyMessage).toBeVisible();
    await expect(emptyMessage).toContainText('No incursions to display');
  });

  test('rechecking all filters restores incursion rows', async ({ page }) => {
    await page.locator('[data-filter-toggle="incursions"]').click();
    await expect(page.locator('#incursions-filters')).toBeVisible();

    const checkboxes = await page.locator('#incursions-filters input[type="checkbox"]').all();

    // Uncheck all
    for (const checkbox of checkboxes) {
      if (await checkbox.isChecked()) await checkbox.click();
    }
    await expect(page.locator('#incursions-body span.d-block:not(.d-none)')).toHaveCount(0);

    // Re-check all
    for (const checkbox of checkboxes) {
      await checkbox.click();
    }
    await expect(page.locator('#incursions-filters input[type="checkbox"]:checked')).toHaveCount(checkboxes.length);
    await expect(page.locator('#incursions-empty-message')).toBeHidden();
    await expect(page.locator('#incursions-body span.d-block:not(.d-none)')).toHaveCount(6);
  });

  test('filter preference persists across page reload', async ({ page }) => {
    await page.locator('[data-filter-toggle="incursions"]').click();
    await expect(page.locator('#incursions-filters')).toBeVisible();

    const firstCheckbox = page.locator('#incursions-filters input[type="checkbox"]').first();
    const checkboxId = await firstCheckbox.getAttribute('id');
    const filterType = checkboxId!.replace('filter-incursions-', '');
    const localStorageKey = `live.filter.incursions.${filterType}`;

    if (await firstCheckbox.isChecked()) {
      await firstCheckbox.click();
    }
    await expect(firstCheckbox).not.toBeChecked();
    await page.waitForFunction((key) => localStorage.getItem(key) === '0', localStorageKey);

    await page.reload();
    await page.clock.resume();
    await page.waitForSelector('#arby-what:not(:has-text("Loading..."))', { timeout: 10000 });
    await page.waitForSelector('#incursions-body span.d-block:not(:has-text("Fetching"))', { timeout: 10000 });

    await page.locator('[data-filter-toggle="incursions"]').click();
    await expect(page.locator('#incursions-filters')).toBeVisible();
    await expect(page.locator(`#${checkboxId}`)).not.toBeChecked();
  });
});
