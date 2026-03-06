import { test, expect } from '@playwright/test';
import { setupMockRoutes, reloadWithFrozenClock } from '../helpers/api-mocks';

test.describe('Live Page - 1999 Calendar Card', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/live.php');
    await page.waitForSelector('#calendar-season-body .calendar-season-date', { timeout: 10000 });
  });

  test.describe('Card Structure', () => {
    test('card header shows "1999 Calendar"', async ({ page }) => {
      const header = page.locator('.card').filter({ hasText: '1999 Calendar' }).locator('.card-header h5');
      await expect(header).toContainText('1999 Calendar');
    });

    test('collapse toggle is present in header', async ({ page }) => {
      const card = page.locator('.card').filter({ hasText: '1999 Calendar' });
      const toggle = card.locator('[data-collapse-toggle="calendar-season"]');
      await expect(toggle).toBeVisible();
    });

    test('completion toggle checkbox is present in header', async ({ page }) => {
      const card = page.locator('.card').filter({ hasText: '1999 Calendar' });
      const checkbox = card.locator('#calendar-season-checks .completion-check');
      await expect(checkbox).toBeVisible();
    });

    test('card body is visible initially', async ({ page }) => {
      const cardBody = page.locator('#calendar-season-body');
      await expect(cardBody).toBeVisible();
    });
  });

  test.describe('Collapse', () => {
    test('clicking collapse toggle hides card body', async ({ page }) => {
      const toggle = page.locator('[data-collapse-toggle="calendar-season"]');
      const cardBody = page.locator('#calendar-season-body');

      await expect(cardBody).toBeVisible();
      await toggle.click();
      await expect(cardBody).toBeHidden();
    });

    test('clicking collapse toggle again shows card body', async ({ page }) => {
      const toggle = page.locator('[data-collapse-toggle="calendar-season"]');
      const cardBody = page.locator('#calendar-season-body');

      // Collapse first
      await toggle.click();
      await expect(cardBody).toBeHidden();

      // Expand again
      await toggle.click();
      await expect(cardBody).toBeVisible();
    });
  });

  test.describe('Completion Toggle', () => {
    test('completion toggle is clickable', async ({ page }) => {
      const checkbox = page.locator('#calendar-season-checks .completion-check');
      await expect(checkbox).toBeVisible();

      // Should be clickable (not disabled)
      await expect(checkbox).toBeEnabled();
    });

    test('clicking marks it as completed (bi-check-square icon)', async ({ page }) => {
      const checkbox = page.locator('#calendar-season-checks .completion-check');

      // Initial state should be unchecked (bi-square)
      await expect(checkbox.locator('.bi-square')).toBeVisible();

      // Click to mark complete
      await checkbox.click();

      // Should now show bi-check-square
      await expect(checkbox.locator('.bi-check-square')).toBeVisible();
    });

    test('clicking again unmarks it (bi-square icon)', async ({ page }) => {
      const checkbox = page.locator('#calendar-season-checks .completion-check');

      // Click once to mark complete
      await checkbox.click();
      await expect(checkbox.locator('.bi-check-square')).toBeVisible();

      // Click again to unmark
      await checkbox.click();
      await expect(checkbox.locator('.bi-square')).toBeVisible();
    });

    test('state persists in localStorage', async ({ page }) => {
      const checkbox = page.locator('#calendar-season-checks .completion-check');

      // Mark as complete
      await checkbox.click();
      await expect(checkbox.locator('.bi-check-square')).toBeVisible();

      // Check localStorage - completion state is stored in oids_completed array
      const oid = await checkbox.getAttribute('data-oid');
      expect(oid).toBeTruthy();

      const completedOids = await page.evaluate(() => {
        const stored = localStorage.getItem('oids_completed');
        return stored ? JSON.parse(stored) : [];
      });

      expect(completedOids).toContain(oid);

      // Reload page (re-freeze clock since it doesn't persist across reloads)
      await reloadWithFrozenClock(page);
      await page.waitForSelector('#calendar-season-body .calendar-season-date', { timeout: 10000 });

      // Should still be marked as complete
      const checkboxAfterReload = page.locator('#calendar-season-checks .completion-check');
      await expect(checkboxAfterReload.locator('.bi-check-square')).toBeVisible();
    });
  });

  test.describe('Day Rows', () => {
    test('renders calendar season content', async ({ page }) => {
      const cardBody = page.locator('#calendar-season-body');

      // Check if we have date columns
      const dateCols = cardBody.locator('.calendar-season-date');
      const count = await dateCols.count();

      expect(count).toBeGreaterThan(0);

      // Verify they're in d-md-flex rows (hardcoded in renderCalendarSeasonPane)
      const dayRows = cardBody.locator('.d-md-flex.mb-3');
      const rowCount = await dayRows.count();
      expect(rowCount).toBeGreaterThan(0);
    });

    test('date columns show formatted date', async ({ page }) => {
      const cardBody = page.locator('#calendar-season-body');
      const dateCols = cardBody.locator('.calendar-season-date');

      const firstDate = dateCols.first();
      await expect(firstDate).toBeVisible();
      const text = await firstDate.textContent();

      // Should start with an emoji and have a date
      expect(text).toMatch(/\b[A-Z][a-z]{2} \d{1,2}$/);
    });
  });
});
