import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { setupMockRoutes } from '../helpers/api-mocks';
import { TEST_FRONT_PROXY_BASE_URL } from '../../test/helpers/test-constants';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const proxyHost = new URL(TEST_FRONT_PROXY_BASE_URL).host;
const profileData = JSON.parse(fs.readFileSync(path.join(__dirname, '../../test/profile/getProfileViewingData.html'), 'utf8'));

test.describe('Profile Stats Filters', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);

    await page.route(`**/${proxyHost}/profile*`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(profileData),
      });
    });

    await page.goto('/profile.php');
    await page.selectOption('#platform-select', 'pc');
    await page.click('button:has-text("Click Me")');
    const eeLogPath = path.join(__dirname, '../../test/profile/EE.log');
    await page.setInputFiles('#ee-log-file', eeLogPath);
    await expect(page.locator('#step3-container')).toHaveClass(/complete/, { timeout: 5000 });

    // Navigate to Stats tab
    await page.click('a[data-tab="stats"]');
    await expect(page.locator('#stats')).toBeVisible();
  });

  test.describe('Equipment filter bar', () => {
    test('renders an "All" button and at least one category button', async ({ page }) => {
      const bar = page.locator('#equipment-filter-bar');
      await expect(bar.locator('button[data-filter=""]')).toBeVisible();
      await expect(bar.locator('button:not([data-filter=""])')).toHaveCount(await bar.locator('button').count() - 1);
      expect(await bar.locator('button').count()).toBeGreaterThan(1);
    });

    test('"All" button starts active', async ({ page }) => {
      const allBtn = page.locator('#equipment-filter-bar button[data-filter=""]');
      await expect(allBtn).toHaveClass(/active/);
    });

    test('all rows visible initially', async ({ page }) => {
      const visibleRows = page.locator('#equipment-stats tr:visible');
      expect(await visibleRows.count()).toBeGreaterThan(0);
    });

    test('clicking a category button filters the table', async ({ page }) => {
      const bar = page.locator('#equipment-filter-bar');
      const totalRows = await page.locator('#equipment-stats tr').count();

      // Click the first non-All button
      const firstCatBtn = bar.locator('button:not([data-filter=""])').first();
      const filterValue = await firstCatBtn.getAttribute('data-filter');
      await firstCatBtn.click();

      // Button is now active
      await expect(firstCatBtn).toHaveClass(/active/);

      // Fewer rows visible (or equal if all belong to that category)
      const matchingRows = page.locator(`#equipment-stats tr[data-category="${filterValue}"]`);
      const matchCount = await matchingRows.count();
      expect(matchCount).toBeLessThanOrEqual(totalRows);

      // All visible rows match the filter
      const visibleRows = page.locator(`#equipment-stats tr:visible`);
      const visibleCount = await visibleRows.count();
      expect(visibleCount).toBe(matchCount);
    });

    test('clicking active filter button again resets to All', async ({ page }) => {
      const bar = page.locator('#equipment-filter-bar');
      const firstCatBtn = bar.locator('button:not([data-filter=""])').first();
      const totalRows = await page.locator('#equipment-stats tr').count();

      await firstCatBtn.click();
      await firstCatBtn.click();

      await expect(bar.locator('button[data-filter=""]')).toHaveClass(/active/);
      await expect(page.locator('#equipment-stats tr:visible')).toHaveCount(totalRows);
    });

    test('switching between category buttons updates the filter', async ({ page }) => {
      const bar = page.locator('#equipment-filter-bar');
      const catButtons = bar.locator('button:not([data-filter=""])');

      if (await catButtons.count() < 2) {
        test.skip();
      }

      const firstBtn = catButtons.nth(0);
      const secondBtn = catButtons.nth(1);
      const secondFilter = await secondBtn.getAttribute('data-filter');

      await firstBtn.click();
      await secondBtn.click();

      await expect(secondBtn).toHaveClass(/active/);
      await expect(firstBtn).not.toHaveClass(/active/);

      // All visible rows match the second filter
      const visibleRows = page.locator('#equipment-stats tr:visible');
      const count = await visibleRows.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        await expect(visibleRows.nth(i)).toHaveAttribute('data-category', secondFilter!);
      }
    });
  });

  test.describe('Enemy filter bar', () => {
    test('renders an "All" button and at least one faction button', async ({ page }) => {
      const bar = page.locator('#enemy-filter-bar');
      await expect(bar.locator('button[data-filter=""]')).toBeVisible();
      expect(await bar.locator('button').count()).toBeGreaterThan(1);
    });

    test('"All" button starts active', async ({ page }) => {
      await expect(page.locator('#enemy-filter-bar button[data-filter=""]')).toHaveClass(/active/);
    });

    test('clicking a faction button filters the enemy table', async ({ page }) => {
      const bar = page.locator('#enemy-filter-bar');
      const totalRows = await page.locator('#enemy-stats tr').count();

      const firstFactionBtn = bar.locator('button:not([data-filter=""])').first();
      const filterValue = await firstFactionBtn.getAttribute('data-filter');
      await firstFactionBtn.click();

      await expect(firstFactionBtn).toHaveClass(/active/);

      const matchingRows = page.locator(`#enemy-stats tr[data-category="${filterValue}"]`);
      const matchCount = await matchingRows.count();
      expect(matchCount).toBeLessThanOrEqual(totalRows);
      await expect(page.locator('#enemy-stats tr:visible')).toHaveCount(matchCount);
    });

    test('clicking active faction button again resets to All', async ({ page }) => {
      const bar = page.locator('#enemy-filter-bar');
      const firstFactionBtn = bar.locator('button:not([data-filter=""])').first();
      const totalRows = await page.locator('#enemy-stats tr').count();

      await firstFactionBtn.click();
      await firstFactionBtn.click();

      await expect(bar.locator('button[data-filter=""]')).toHaveClass(/active/);
      await expect(page.locator('#enemy-stats tr:visible')).toHaveCount(totalRows);
    });
  });

  test.describe('Equipment rank column', () => {
    test('shows sequential ranks starting at 1', async ({ page }) => {
      const rows = page.locator('#equipment-stats tr');
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        await expect(rows.nth(i).locator('td').first()).toHaveText(String(i + 1));
      }
    });

    test('renumbers sequentially after sorting a column', async ({ page }) => {
      await page.locator('table:has(#equipment-stats) th').nth(1).click();
      const rows = page.locator('#equipment-stats tr');
      const count = await rows.count();
      for (let i = 0; i < count; i++) {
        await expect(rows.nth(i).locator('td').first()).toHaveText(String(i + 1));
      }
    });

    test('visible ranks are gapless after filtering', async ({ page }) => {
      const firstCatBtn = page.locator('#equipment-filter-bar button:not([data-filter=""])').first();
      await firstCatBtn.click();
      const visibleRows = page.locator('#equipment-stats tr:visible');
      const count = await visibleRows.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        await expect(visibleRows.nth(i).locator('td').first()).toHaveText(String(i + 1));
      }
    });

    test('hidden rows have blank rank cell', async ({ page }) => {
      const firstCatBtn = page.locator('#equipment-filter-bar button:not([data-filter=""])').first();
      const filterValue = await firstCatBtn.getAttribute('data-filter');
      await firstCatBtn.click();
      const hiddenRows = page.locator(`#equipment-stats tr[data-category]:not([data-category="${filterValue}"])`);
      const count = await hiddenRows.count();
      for (let i = 0; i < count; i++) {
        await expect(hiddenRows.nth(i).locator('td').first()).toHaveText('');
      }
    });

    test('ranks restore after clearing filter', async ({ page }) => {
      const totalRows = await page.locator('#equipment-stats tr').count();
      const firstCatBtn = page.locator('#equipment-filter-bar button:not([data-filter=""])').first();
      await firstCatBtn.click();
      await firstCatBtn.click(); // toggle back to All
      const rows = page.locator('#equipment-stats tr');
      for (let i = 0; i < totalRows; i++) {
        await expect(rows.nth(i).locator('td').first()).toHaveText(String(i + 1));
      }
    });
  });

  test.describe('Enemy rank column', () => {
    test('shows sequential ranks starting at 1', async ({ page }) => {
      const rows = page.locator('#enemy-stats tr');
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        await expect(rows.nth(i).locator('td').first()).toHaveText(String(i + 1));
      }
    });

    test('visible ranks are gapless after filtering', async ({ page }) => {
      const firstFactionBtn = page.locator('#enemy-filter-bar button:not([data-filter=""])').first();
      await firstFactionBtn.click();
      const visibleRows = page.locator('#enemy-stats tr:visible');
      const count = await visibleRows.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        await expect(visibleRows.nth(i).locator('td').first()).toHaveText(String(i + 1));
      }
    });
  });

  test.describe('Equipment "Used" column', () => {
    // Categories that don't aggregate a total, so "Used" shows 0.00% for every row:
    // - MechSuits: absent from profile data (no usage data recorded)
    // - SpecialItems: intentionally excluded from aggregation (mixed items, no meaningful total)
    const ZERO_USAGE_CATEGORIES = new Set(['MechSuits', 'SpecialItems']);

    test('all "Used" cells show a percentage value', async ({ page }) => {
      const rows = page.locator('#equipment-stats tr');
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        const usedText = await rows.nth(i).locator('td').nth(2).textContent();
        expect(usedText).toMatch(/^\d+\.\d{2}%$/);
      }
    });

    test('"Used" percentages sum to ~100% per category', async ({ page }) => {
      // Collect all rows grouped by data-category
      const rows = page.locator('#equipment-stats tr');
      const count = await rows.count();
      const categoryTotals: Record<string, number> = {};
      for (let i = 0; i < count; i++) {
        const row = rows.nth(i);
        const category = await row.getAttribute('data-category') ?? '';
        const usedText = await row.locator('td').nth(2).textContent() ?? '0%';
        const value = parseFloat(usedText);
        categoryTotals[category] = (categoryTotals[category] ?? 0) + value;
      }
      for (const [category, total] of Object.entries(categoryTotals)) {
        if (ZERO_USAGE_CATEGORIES.has(category)) {
          expect(total, `category ${category} has no Used percentage, sums to 0%`).toBeCloseTo(0, 0);
        } else {
          expect(total, `category ${category} sums to ~100%`).toBeCloseTo(100, 0);
        }
      }
    });
  });

  test.describe('Filter persistence across table sort', () => {
    test('equipment filter still applies after sorting a column', async ({ page }) => {
      const bar = page.locator('#equipment-filter-bar');
      const firstCatBtn = bar.locator('button:not([data-filter=""])').first();
      const filterValue = await firstCatBtn.getAttribute('data-filter');
      await firstCatBtn.click();

      const filteredCount = await page.locator('#equipment-stats tr:visible').count();

      // Click a column header to sort
      await page.locator('#equipment-stats').locator('..').locator('..').locator('th').nth(1).click();

      // Filter should still be applied
      await expect(page.locator('#equipment-stats tr:visible')).toHaveCount(filteredCount);

      // All visible rows still match the filter
      const visibleRows = page.locator('#equipment-stats tr:visible');
      const count = await visibleRows.count();
      for (let i = 0; i < count; i++) {
        await expect(visibleRows.nth(i)).toHaveAttribute('data-category', filterValue!);
      }
    });

    test('enemy filter still applies after sorting a column', async ({ page }) => {
      const bar = page.locator('#enemy-filter-bar');
      const firstFactionBtn = bar.locator('button:not([data-filter=""])').first();
      const filterValue = await firstFactionBtn.getAttribute('data-filter');
      await firstFactionBtn.click();

      const filteredCount = await page.locator('#enemy-stats tr:visible').count();

      // Click a column header to sort
      await page.locator('#enemy-stats').locator('..').locator('..').locator('th').nth(1).click();

      await expect(page.locator('#enemy-stats tr:visible')).toHaveCount(filteredCount);

      const visibleRows = page.locator('#enemy-stats tr:visible');
      const count = await visibleRows.count();
      for (let i = 0; i < count; i++) {
        await expect(visibleRows.nth(i)).toHaveAttribute('data-category', filterValue!);
      }
    });
  });
});
