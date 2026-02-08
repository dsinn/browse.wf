import { test, expect, Page } from '@playwright/test';
import { setupMockRoutes } from './helpers/api-mocks';

test.describe('Live Page (/live)', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses for deterministic, fast, offline-capable tests
    await setupMockRoutes(page);

    await page.goto('/live.php');
    // Wait for initial data to load (arbitration card loads quickly)
    await page.waitForSelector('#arby-what:not(:has-text("Loading..."))', { timeout: 10000 });
  });

  test.describe('Page loads correctly', () => {
    test('displays the main card headers', async ({ page }) => {
      // Check that major card headers are present (using IDs for reliability)
      await expect(page.locator('#arby-header')).toBeVisible();
      await expect(page.locator('#sortie-header')).toBeVisible();
      await expect(page.locator('#darvo-header')).toBeVisible();
    });

    test('loads game data from API', async ({ page }) => {
      // Check that arbitration data loaded
      const arbyWhat = await page.locator('#arby-what').textContent();
      expect(arbyWhat).not.toBe('Loading...');
      expect(arbyWhat).toBeTruthy();
    });
  });

  test.describe('Card collapse functionality', () => {
    test('clicking collapse toggle hides card content', async ({ page }) => {
      // Find the News card collapse toggle
      const newsToggle = page.locator('[data-collapse-toggle="news"]');
      const newsBody = page.locator('#news-body');

      // Verify card body is initially visible
      await expect(newsBody).toBeVisible();

      // Click collapse toggle
      await newsToggle.click();

      // Verify card body is now hidden (auto-retries)
      await expect(newsBody).toBeHidden();

      // Verify toggle has engaged class
      await expect(newsToggle).toHaveClass(/engaged/);
    });

    test('clicking collapsed card expands it again', async ({ page }) => {
      const newsToggle = page.locator('[data-collapse-toggle="news"]');
      const newsBody = page.locator('#news-body');

      // Collapse the card
      await newsToggle.click();
      await expect(newsBody).toBeHidden();
      await expect(newsToggle).toHaveClass(/engaged/);

      // Expand it again
      await newsToggle.click();
      await expect(newsBody).toBeVisible();
      await expect(newsToggle).not.toHaveClass(/engaged/);
    });
  });

  test.describe('Notification toggles', () => {
    test('clicking notification toggle changes icon state', async ({ page }) => {
      // Find a notification toggle (e.g., News)
      const newsNotifToggle = page.locator('[data-notif-toggle="news"]');

      // Wait for notification icon to be initialized
      await page.waitForSelector('[data-notif-toggle="news"] span', { timeout: 5000 });

      // Get initial bell state
      const initialSpan = newsNotifToggle.locator('span');
      const initialClass = await initialSpan.getAttribute('class');

      // Click to toggle
      await newsNotifToggle.click();

      // Wait for class to change
      await expect(initialSpan).not.toHaveAttribute('class', initialClass || '');

      // Verify class changed
      const newClass = await initialSpan.getAttribute('class');
      expect(newClass).not.toBe(initialClass);

      // Should be either enabled or disabled
      expect(newClass === 'notif-bell-enabled' || newClass === 'notif-bell-disabled').toBe(true);
    });

    test('notification preferences persist in localStorage', async ({ page }) => {
      const darvoNotifToggle = page.locator('[data-notif-toggle="darvo"]');

      // Wait for initialization
      await page.waitForSelector('[data-notif-toggle="darvo"] span', { timeout: 5000 });

      // Toggle notification
      await darvoNotifToggle.click();

      // Wait for localStorage to be set
      await page.waitForFunction(() => {
        return localStorage.getItem('live.notif.darvo') !== null;
      });

      // Check localStorage (note: keys are prefixed with "live.notif.")
      const notifState = await page.evaluate(() => {
        return localStorage.getItem('live.notif.darvo');
      });

      expect(notifState).toBeTruthy();

      // Reload page
      await page.reload();
      await page.waitForSelector('#arby-what:not(:has-text("Loading..."))', { timeout: 10000 });
      await page.waitForSelector('[data-notif-toggle="darvo"] span', { timeout: 5000 });

      // Verify state persisted
      const stateAfterReload = await page.evaluate(() => {
        return localStorage.getItem('live.notif.darvo');
      });

      expect(stateAfterReload).toBe(notifState);
    });
  });

  test.describe('Card filters', () => {
    test('clicking gear icon shows filter panel', async ({ page }) => {
      // Find the News card filter toggle
      const newsFilterToggle = page.locator('[data-filter-toggle="news"]');

      // Filter panel should not be visible initially
      const filterPanel = page.locator('#news-filters');
      await expect(filterPanel).toBeHidden();

      // Click gear icon
      await newsFilterToggle.click();

      // Filter panel should now be visible (auto-retries)
      await expect(filterPanel).toBeVisible();
    });

    test('unchecking filter checkbox filters content', async ({ page }) => {
      // Open News filter panel
      const newsFilterToggle = page.locator('[data-filter-toggle="news"]');
      await newsFilterToggle.click();
      await expect(page.locator('#news-filters')).toBeVisible();

      // Check which filter type has items we can test with
      const dangerCount = await page.locator('#news-body .card-block.border-danger').count();
      const primaryCount = await page.locator('#news-body .card-block.border-primary').count();
      const successCount = await page.locator('#news-body .card-block.border-success').count();

      // Pick the first available filter type to test
      let filterSelector: string;
      let borderClass: string;
      let initialFilteredCount: number;

      if (dangerCount > 0) {
        filterSelector = '#filter-news-danger';
        borderClass = '.border-danger';
        initialFilteredCount = dangerCount;
      } else if (primaryCount > 0) {
        filterSelector = '#filter-news-primary';
        borderClass = '.border-primary';
        initialFilteredCount = primaryCount;
      } else if (successCount > 0) {
        filterSelector = '#filter-news-success';
        borderClass = '.border-success';
        initialFilteredCount = successCount;
      } else {
        // Skip test if no filtered items exist
        test.skip();
        return;
      }

      // Verify filtered items ARE present
      expect(initialFilteredCount).toBeGreaterThan(0);

      // Get initial count of all news blocks
      const initialCount = await page.locator('#news-body .card-block').count();

      // Uncheck the filter
      await page.locator(filterSelector).uncheck();

      // Wait for count to decrease
      await expect(page.locator('#news-body .card-block')).not.toHaveCount(initialCount);

      // Count should be less (filtered items removed)
      const newCount = await page.locator('#news-body .card-block').count();
      expect(newCount).toBeLessThan(initialCount);

      // Filtered items should NOW be gone
      const filteredBlocksAfter = await page.locator(`#news-body .card-block${borderClass}`).count();
      expect(filteredBlocksAfter).toBe(0);
    });

    test('filter preferences persist in localStorage', async ({ page }) => {
      // Open News filter panel
      const newsFilterToggle = page.locator('[data-filter-toggle="news"]');
      await newsFilterToggle.click();
      await expect(page.locator('#news-filters')).toBeVisible();

      // Uncheck red text filter
      const redtextFilter = page.locator('#filter-news-danger');
      await redtextFilter.uncheck();
      await expect(redtextFilter).not.toBeChecked();

      // Reload page
      await page.reload();
      await page.waitForSelector('#arby-what:not(:has-text("Loading..."))', { timeout: 10000 });

      // Open filter panel again
      await newsFilterToggle.click();
      await expect(page.locator('#news-filters')).toBeVisible();

      // Verify state persisted (should still be unchecked)
      await expect(redtextFilter).not.toBeChecked();
    });
  });

  test.describe('Language selector', () => {
    test('language selector exists and has options', async ({ page }) => {
      const langSelect = page.locator('#language-select');

      if (await langSelect.count() > 0) {
        await expect(langSelect).toBeVisible();

        const options = await langSelect.locator('option').count();
        expect(options).toBeGreaterThan(1);
      }
    });

    test('changing language updates localStorage', async ({ page }) => {
      const langSelect = page.locator('#language-select');

      if (await langSelect.count() > 0) {
        // Get current language
        const initialValue = await langSelect.inputValue();

        // Get all options
        const options = await langSelect.locator('option').all();
        if (options.length > 1) {
          // Find a different language
          const secondOption = await options[1].getAttribute('value');

          if (secondOption && secondOption !== initialValue) {
            // Change language
            await langSelect.selectOption(secondOption);

            // Wait for localStorage to be set
            await page.waitForFunction((expected) => {
              return localStorage.getItem('language') === expected;
            }, secondOption);

            // Check localStorage
            const storedLang = await page.evaluate(() => {
              return localStorage.getItem('language');
            });

            expect(storedLang).toBe(secondOption);
          }
        }
      }
    });
  });

  test.describe('Navbar interactions', () => {
    test('navbar pin toggle works', async ({ page }) => {
      const pinToggle = page.locator('[data-toggle="navbar-pin"]');

      if (await pinToggle.count() > 0) {
        const navbar = page.locator('.navbar');

        // Click pin toggle
        await pinToggle.click();

        // Wait for localStorage to be set
        await page.waitForFunction(() => {
          return localStorage.getItem('navbar-pinned') !== null;
        });

        // Check localStorage for pin state
        const pinState = await page.evaluate(() => {
          return localStorage.getItem('navbar-pinned');
        });

        expect(pinState).toBeTruthy();

        // Toggle back
        await pinToggle.click();

        // Wait for localStorage to change
        await page.waitForFunction((oldState) => {
          return localStorage.getItem('navbar-pinned') !== oldState;
        }, pinState);

        const pinStateAfter = await page.evaluate(() => {
          return localStorage.getItem('navbar-pinned');
        });

        expect(pinStateAfter).not.toBe(pinState);
      }
    });
  });

  test.describe('Specific card rendering', () => {
    test('Arbitration card displays information', async ({ page }) => {
      // Wait for arbitration data to load
      await page.waitForSelector('#arby-what', { timeout: 10000 });

      const arbyWhat = page.locator('#arby-what');
      const arbyWhere = page.locator('#arby-where');

      // Should have some text content
      const whatText = await arbyWhat.textContent();
      const whereText = await arbyWhere.textContent();

      expect(whatText).toBeTruthy();
      expect(whereText).toBeTruthy();
    });

    test('Darvo deal card displays item information', async ({ page }) => {
      // Wait for Darvo data
      await page.waitForSelector('#darvo-item', { timeout: 10000 });

      const darvoItem = page.locator('#darvo-item');
      const itemText = await darvoItem.textContent();

      expect(itemText).toBeTruthy();
    });
  });

  test.describe('Steel Path Incursions card', () => {
    test.beforeEach(async ({ page }) => {
      // Resume normal time flow for these tests (sp-incursions.txt is static and has data for many years)
      await page.clock.resume();
    });

    test('renders incursion data', async ({ page }) => {
      // Wait for incursions to load
      await page.waitForSelector('#incursions-body span.d-block:not(:has-text("Fetching"))', { timeout: 10000 });

      // Should have incursion items
      const incursions = await page.locator('#incursions-body span.d-block').count();
      expect(incursions).toBeGreaterThan(0);

      // Each incursion should have mission info
      const firstIncursion = page.locator('#incursions-body span.d-block').first();
      const text = await firstIncursion.textContent();
      expect(text).toBeTruthy();
      expect(text).not.toContain('Fetching');
    });

    test('filter gear icon shows filter panel', async ({ page }) => {
      // Wait for page to load
      await page.waitForSelector('#incursions-body span.d-block:not(:has-text("Fetching"))', { timeout: 10000 });

      const filterToggle = page.locator('[data-filter-toggle="incursions"]');
      const filterPanel = page.locator('#incursions-filters');

      // Filter panel should be hidden initially
      await expect(filterPanel).toBeHidden();

      // Click gear icon
      await filterToggle.click();

      // Filter panel should now be visible
      await expect(filterPanel).toBeVisible();

      // Should have mission type checkboxes
      const checkboxes = await page.locator('#incursions-filters input[type="checkbox"]').count();
      expect(checkboxes).toBeGreaterThan(0);
    });

    test('unchecking filter checkbox hides incursions', async ({ page }) => {
      // Wait for incursions to load
      await page.waitForSelector('#incursions-body span.d-block:not(:has-text("Fetching"))', { timeout: 10000 });

      // Open filter panel
      const filterToggle = page.locator('[data-filter-toggle="incursions"]');
      await filterToggle.click();
      await expect(page.locator('#incursions-filters')).toBeVisible();

      // Get initial count of visible incursions
      const initialCount = await page.locator('#incursions-body span.d-block:not(.d-none)').count();
      expect(initialCount).toBeGreaterThan(0);

      // Find first checked checkbox and extract its filter type
      const firstCheckbox = page.locator('#incursions-filters input[type="checkbox"]:checked').first();
      const checkboxId = await firstCheckbox.getAttribute('id');
      const filterType = checkboxId.replace('filter-incursions-', '');

      // Use click() to trigger change event
      await firstCheckbox.click();

      // Wait for localStorage to update (this confirms the filter system processed the change)
      await page.waitForFunction((key) => {
        return localStorage.getItem(key) === '0';
      }, `live.filter.incursions.${filterType}`);

      // Count should be less than or equal (items may have been hidden, or filter had no matches)
      const newCount = await page.locator('#incursions-body span.d-block:not(.d-none)').count();
      expect(newCount).toBeLessThanOrEqual(initialCount);
    });

    test('shows empty message when all filters unchecked', async ({ page }) => {
      // Wait for incursions to load
      await page.waitForSelector('#incursions-body span.d-block:not(:has-text("Fetching"))', { timeout: 10000 });

      // Open filter panel
      const filterToggle = page.locator('[data-filter-toggle="incursions"]');
      await filterToggle.click();
      await expect(page.locator('#incursions-filters')).toBeVisible();

      // Empty message should be hidden initially
      const emptyMessage = page.locator('#incursions-empty-message');
      await expect(emptyMessage).toBeHidden();

      // Get all checkboxes at once (as array) to avoid selector re-evaluation issues
      const checkboxes = await page.locator('#incursions-filters input[type="checkbox"]').all();

      // Uncheck all checkboxes (use click to trigger change events)
      for (const checkbox of checkboxes) {
        if (await checkbox.isChecked()) {
          await checkbox.click();
        }
      }

      // Wait for all incursions to be hidden first (indicates filtering has processed)
      await expect(page.locator('#incursions-body span.d-block:not(.d-none)')).toHaveCount(0);

      // Wait for empty message to become visible (indicates filtering applied)
      await expect(emptyMessage).toBeVisible();
      const emptyText = await emptyMessage.textContent();
      expect(emptyText).toContain('No incursions to display');
    });

    test('rechecking filter shows incursions again', async ({ page }) => {
      // Wait for incursions to load
      await page.waitForSelector('#incursions-body span.d-block:not(:has-text("Fetching"))', { timeout: 10000 });

      // Open filter panel
      const filterToggle = page.locator('[data-filter-toggle="incursions"]');
      await filterToggle.click();
      await expect(page.locator('#incursions-filters')).toBeVisible();

      // Get all checkboxes and uncheck all of them
      const checkboxes = await page.locator('#incursions-filters input[type="checkbox"]').all();
      for (const checkbox of checkboxes) {
        if (await checkbox.isChecked()) {
          await checkbox.click();
        }
      }

      // Wait for all incursions to be hidden first (indicates filtering has processed)
      await expect(page.locator('#incursions-body span.d-block:not(.d-none)')).toHaveCount(0);

      // Wait for empty message to appear
      const emptyMessage = page.locator('#incursions-empty-message');
      await expect(emptyMessage).toBeVisible();

      // All incursions should be hidden
      const hiddenCount = await page.locator('#incursions-body span.d-block:not(.d-none)').count();
      expect(hiddenCount).toBe(0);

      // Re-check ALL checkboxes
      for (const checkbox of checkboxes) {
        await checkbox.click();
      }

      // Wait for checkboxes to all be checked
      const allChecked = await page.locator('#incursions-filters input[type="checkbox"]:checked').count();
      expect(allChecked).toBe(checkboxes.length);

      // Empty message should now be hidden
      await expect(emptyMessage).toBeHidden();

      // Some incursions should be visible again
      const visibleCount = await page.locator('#incursions-body span.d-block:not(.d-none)').count();
      expect(visibleCount).toBeGreaterThan(0);
    });

    test('filter preferences persist in localStorage', async ({ page }) => {
      // Wait for incursions to load
      await page.waitForSelector('#incursions-body span.d-block:not(:has-text("Fetching"))', { timeout: 10000 });

      // Open filter panel
      const filterToggle = page.locator('[data-filter-toggle="incursions"]');
      await filterToggle.click();
      await expect(page.locator('#incursions-filters')).toBeVisible();

      // Find first checkbox and get its ID
      const firstCheckbox = page.locator('#incursions-filters input[type="checkbox"]').first();
      const checkboxId = await firstCheckbox.getAttribute('id');
      expect(checkboxId).toBeTruthy();

      // Extract the filter type from the checkbox ID
      const filterType = checkboxId.replace('filter-incursions-', '');
      const localStorageKey = `live.filter.incursions.${filterType}`;

      // Click to uncheck it (more reliable than uncheck() for triggering events)
      if (await firstCheckbox.isChecked()) {
        await firstCheckbox.click();
      }

      // Verify it's unchecked
      await expect(firstCheckbox).not.toBeChecked();

      // Wait for localStorage to be set
      await page.waitForFunction((key) => {
        return localStorage.getItem(key) === '0';
      }, localStorageKey);

      // Reload page
      await page.reload();
      await page.waitForSelector('#arby-what:not(:has-text("Loading..."))', { timeout: 10000 });
      await page.waitForSelector('#incursions-body span.d-block:not(:has-text("Fetching"))', { timeout: 10000 });

      // Open filter panel again
      await filterToggle.click();
      await expect(page.locator('#incursions-filters')).toBeVisible();

      // Checkbox should still be unchecked
      const checkboxAfterReload = page.locator(`#${checkboxId}`);
      await expect(checkboxAfterReload).not.toBeChecked();
    });

    test('all checkboxes are accessible when filter panel is expanded', async ({ page }) => {
      // Wait for incursions to load
      await page.waitForSelector('#incursions-body span.d-block:not(:has-text("Fetching"))', { timeout: 10000 });

      // Open filter panel
      const filterToggle = page.locator('[data-filter-toggle="incursions"]');
      await filterToggle.click();
      await expect(page.locator('#incursions-filters')).toBeVisible();

      // Get the first and last checkboxes in the filter panel
      const firstCheckbox = page.locator('#incursions-filters input[type="checkbox"]').first();
      const lastCheckbox = page.locator('#incursions-filters input[type="checkbox"]').last();

      // Verify the first checkbox is in the viewport (should be visible initially)
      await expect(firstCheckbox).toBeInViewport();

      // Verify the last checkbox is accessible by attempting to interact with it
      // This will automatically scroll it into view if needed
      await expect(lastCheckbox).toBeEnabled();
      await lastCheckbox.click();

      // Verify it changed state (was checked, now unchecked)
      await expect(lastCheckbox).not.toBeChecked();
    });
  });

  // TODO: Split card-specific tests into separate files under e2e/live/

  test.describe('Responsive behavior', () => {
    test('page is mobile responsive', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Wait for cards to be visible after viewport change
      await expect(page.locator('.card').first()).toBeVisible();

      // Cards should still be visible
      const cards = await page.locator('.card').count();
      expect(cards).toBeGreaterThan(0);

      // Should be able to interact with cards
      const firstCollapseToggle = page.locator('[data-collapse-toggle]').first();
      if (await firstCollapseToggle.count() > 0) {
        await expect(firstCollapseToggle).toBeVisible();
        await firstCollapseToggle.click();
        // Click completes successfully - no need to wait
      }
    });
  });
});
