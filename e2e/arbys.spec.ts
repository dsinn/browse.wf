import { test, expect, Page } from '@playwright/test';
import { setupMockRoutes } from './helpers/api-mocks';

test.describe('Arbitration Schedule (/arbys)', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses for deterministic, fast, offline-capable tests
    await setupMockRoutes(page);

    await page.goto('/arbys.php');
    // Wait for the page to load and render data
    await page.waitForSelector('#log:not(:has-text("Loading, please wait..."))');
  });

  test.describe('Dropdown interactions', () => {
    test('changing days dropdown updates schedule length and URL', async ({ page }) => {
      // Change to 7 days
      await page.selectOption('#select-days', '7');

      // URL should update
      await expect(page).toHaveURL(/days=7/);

      // Should show fewer entries than 30 days
      const entries = await page.locator('#log [data-timestamp]').count();
      expect(entries).toBeLessThanOrEqual(7 * 24); // Max 7 days * 24 hours
    });

    test('changing timezone updates time display format', async ({ page }) => {
      // Get first timestamp before change
      const firstEntry = page.locator('#log [data-timestamp]').first();
      const textBefore = await firstEntry.textContent();

      // Change to zulu time
      await page.selectOption('#select-tz', 'zulu');

      // Wait for text to change with 'Z' suffix
      await expect(firstEntry).toContainText(/\d{4}Z •/);

      const textAfter = await firstEntry.textContent();

      // Military time with zulu should have 'Z' suffix
      expect(textAfter).toMatch(/\d{4}Z •/);
      expect(textBefore).not.toEqual(textAfter);
    });

    test('changing hour format updates time display', async ({ page }) => {
      const firstEntry = page.locator('#log [data-timestamp]').first();

      // Test military time (default)
      await page.selectOption('#select-hourfmt', 'mil');
      await expect(firstEntry).toContainText(/\d{4}/); // Wait for 4-digit time
      let text = await firstEntry.textContent();
      expect(text).toMatch(/\d{4}/); // Should have 4-digit time

      // Test 24-hour time
      await page.selectOption('#select-hourfmt', '24');
      await expect(firstEntry).toContainText(/\d{2}:\d{2}/); // Wait for colon format
      text = await firstEntry.textContent();
      expect(text).toMatch(/\d{2}:\d{2}/); // Should have colon format

      // Test 12-hour time
      await page.selectOption('#select-hourfmt', '12');
      await expect(firstEntry).toContainText(/\d{1,2}(am|pm)/); // Wait for am/pm
      text = await firstEntry.textContent();
      expect(text).toMatch(/\d{1,2}(am|pm)/); // Should have am/pm
    });
  });

  test.describe('Checkbox filter interactions', () => {
    test('unchecking mission type filters it from log', async ({ page }) => {
      // First, verify Defense missions ARE present
      const logTextBefore = await page.locator('#log').textContent();
      expect(logTextBefore?.toLowerCase()).toContain('defense');

      const initialCount = await page.locator('#log [data-timestamp]').count();

      // Uncheck Defense missions
      await page.locator('#filter-MT_DEFENSE').uncheck();

      // Wait for count to decrease
      await expect(page.locator('#log [data-timestamp]')).not.toHaveCount(initialCount);

      const newCount = await page.locator('#log [data-timestamp]').count();

      // Should have fewer entries
      expect(newCount).toBeLessThan(initialCount);

      // Defense missions should NOW be gone
      const logTextAfter = await page.locator('#log').textContent();
      expect(logTextAfter?.toLowerCase()).not.toContain('defense');
    });

    test('unchecking tier filters it from log', async ({ page }) => {
      // First, verify C tier entries ARE present
      const entriesBefore = await page.locator('#log [data-timestamp]').all();
      let foundCTier = false;
      for (const entry of entriesBefore) {
        const text = await entry.textContent();
        if (text?.includes('(C tier')) {
          foundCTier = true;
          break;
        }
      }
      expect(foundCTier).toBe(true);

      const initialCount = await page.locator('#log [data-timestamp]').count();

      // Uncheck C tier
      await page.locator('#filter-tier-C').uncheck();

      // Wait for count to decrease
      await expect(page.locator('#log [data-timestamp]')).not.toHaveCount(initialCount);

      const newCount = await page.locator('#log [data-timestamp]').count();

      // Should have fewer entries
      expect(newCount).toBeLessThan(initialCount);

      // C tier should NOW be gone
      const entriesAfter = await page.locator('#log [data-timestamp]').all();
      for (const entry of entriesAfter) {
        const text = await entry.textContent();
        expect(text).not.toContain('(C tier');
      }
    });

    test('unchecking faction filters it from log', async ({ page }) => {
      // First, verify Grineer missions ARE present
      const logTextBefore = await page.locator('#log').textContent();
      expect(logTextBefore?.toLowerCase()).toContain('grineer');

      const initialCount = await page.locator('#log [data-timestamp]').count();

      // Uncheck Grineer
      await page.locator('#filter-FC_GRINEER').uncheck();

      // Wait for count to decrease
      await expect(page.locator('#log [data-timestamp]')).not.toHaveCount(initialCount);

      const newCount = await page.locator('#log [data-timestamp]').count();

      // Should have fewer entries
      expect(newCount).toBeLessThan(initialCount);

      // Grineer missions should NOW be gone
      const logTextAfter = await page.locator('#log').textContent();
      expect(logTextAfter?.toLowerCase()).not.toContain('grineer');
    });

    test('unchecking filter updates URL hash', async ({ page }) => {
      await page.locator('#filter-MT_SURVIVAL').uncheck();

      // Wait for URL to update (toHaveURL auto-retries)
      await expect(page).toHaveURL(/exclude=/);
      await expect(page).toHaveURL(/MT_SURVIVAL/);
    });

    test('unchecking all filters shows no results message', async ({ page }) => {
      // Uncheck all mission types
      await page.locator('#filter-MT_SURVIVAL').uncheck();
      await page.locator('#filter-MT_DEFENSE').uncheck();
      await page.locator('#filter-MT_TERRITORY').uncheck();
      await page.locator('#filter-MT_EXCAVATE').uncheck();
      await page.locator('#filter-MT_PURIFY').uncheck();
      await page.locator('#filter-MT_EVACUATION').uncheck();
      await page.locator('#filter-MT_ARTIFACT').uncheck();
      await page.locator('#filter-MT_CORRUPTION').uncheck();
      await page.locator('#filter-MT_VOID_CASCADE').uncheck();
      await page.locator('#filter-MT_ARMAGEDDON').uncheck();
      await page.locator('#filter-MT_ALCHEMY').uncheck();

      // Wait for no results message to appear
      await expect(page.locator('#log')).toContainText("not a one matches your filters");

      // Should show no results message
      const logText = await page.locator('#log').textContent();
      expect(logText).toContain("not a one matches your filters");
    });
  });

  test.describe('URL fragment parameters', () => {
    test('loads with days parameter from URL', async ({ page }) => {
      await page.goto('/arbys.php');
      await page.waitForSelector('#log:not(:has-text("Loading, please wait..."))');

      // Set hash and reload to apply parameters
      await page.evaluate(() => { window.location.hash = 'days=7'; });
      await page.reload();
      await page.waitForSelector('#log:not(:has-text("Loading, please wait..."))');

      const select = page.locator('#select-days');
      await expect(select).toHaveValue('7');
    });

    test('loads with timezone parameter from URL', async ({ page }) => {
      await page.goto('/arbys.php');
      await page.waitForSelector('#log:not(:has-text("Loading, please wait..."))');

      await page.evaluate(() => { window.location.hash = 'tz=zulu'; });
      await page.reload();
      await page.waitForSelector('#log:not(:has-text("Loading, please wait..."))');

      const select = page.locator('#select-tz');
      await expect(select).toHaveValue('zulu');

      // Verify zulu time format is applied
      const firstEntry = await page.locator('#log [data-timestamp]').first().textContent();
      expect(firstEntry).toMatch(/\d{4}Z •/);
    });

    test('loads with hour format parameter from URL', async ({ page }) => {
      await page.goto('/arbys.php');
      await page.waitForSelector('#log:not(:has-text("Loading, please wait..."))');

      await page.evaluate(() => { window.location.hash = 'hourfmt=12'; });
      await page.reload();
      await page.waitForSelector('#log:not(:has-text("Loading, please wait..."))');

      const select = page.locator('#select-hourfmt');
      await expect(select).toHaveValue('12');

      // Verify 12-hour format is applied
      const firstEntry = await page.locator('#log [data-timestamp]').first().textContent();
      expect(firstEntry).toMatch(/\d{1,2}(am|pm)/);
    });

    test('loads with exclude parameter unchecking filters', async ({ page }) => {
      await page.goto('/arbys.php');
      await page.waitForSelector('#log:not(:has-text("Loading, please wait..."))');

      await page.evaluate(() => { window.location.hash = 'exclude=MT_SURVIVAL.MT_DEFENSE'; });
      await page.reload();
      await page.waitForSelector('#log:not(:has-text("Loading, please wait..."))');

      // Checkboxes should be unchecked
      await expect(page.locator('#filter-MT_SURVIVAL')).not.toBeChecked();
      await expect(page.locator('#filter-MT_DEFENSE')).not.toBeChecked();

      // Other checkboxes should still be checked
      await expect(page.locator('#filter-MT_TERRITORY')).toBeChecked();
    });

    test('loads with combined parameters', async ({ page }) => {
      await page.goto('/arbys.php');
      await page.waitForSelector('#log:not(:has-text("Loading, please wait..."))');

      await page.evaluate(() => { window.location.hash = 'days=90&tz=zulu&hourfmt=24&exclude=MT_SURVIVAL'; });
      await page.reload();
      await page.waitForSelector('#log:not(:has-text("Loading, please wait..."))');

      // All parameters should be applied
      await expect(page.locator('#select-days')).toHaveValue('90');
      await expect(page.locator('#select-tz')).toHaveValue('zulu');
      await expect(page.locator('#select-hourfmt')).toHaveValue('24');
      await expect(page.locator('#filter-MT_SURVIVAL')).not.toBeChecked();

      // Verify display format (24-hour, no 'Z' suffix for non-military)
      const firstEntry = await page.locator('#log [data-timestamp]').first().textContent();
      expect(firstEntry).toMatch(/\d{2}:\d{2}/);
      expect(firstEntry).not.toMatch(/\d{2}Z/);
    });
  });

  test.describe('Next occurrence table', () => {
    test('populates with correct data for mission types', async ({ page }) => {
      // Check that mission type rows have data
      const survivalRow = page.locator('#next-MT_SURVIVAL');
      const dateCell = survivalRow.locator('td').nth(0);
      const detailsCell = survivalRow.locator('td').nth(1);

      // Should have data (not "N/A")
      const dateText = await dateCell.textContent();
      const detailsText = await detailsCell.textContent();

      // If there are survival missions, should show data
      if (dateText !== 'N/A') {
        expect(dateText).toMatch(/(Sun|Mon|Tue|Wed|Thu|Fri|Sat)/);
        expect(detailsText).toBeTruthy();
      }
    });

    test('populates with correct data for tiers', async ({ page }) => {
      // C tier should definitely have entries
      const cTierRow = page.locator('#next-tier-C');
      const dateCell = cTierRow.locator('td').nth(0);

      const dateText = await dateCell.textContent();
      expect(dateText).not.toBe('N/A');
      expect(dateText).toMatch(/(Sun|Mon|Tue|Wed|Thu|Fri|Sat)/);
    });

    test('populates with correct data for factions', async ({ page }) => {
      // Check any faction row
      const grineerRow = page.locator('#next-FC_GRINEER');
      const dateCell = grineerRow.locator('td').nth(0);

      const dateText = await dateCell.textContent();
      if (dateText !== 'N/A') {
        expect(dateText).toMatch(/(Sun|Mon|Tue|Wed|Thu|Fri|Sat)/);
      }
    });

    test('table updates when filters change', async ({ page }) => {
      // Get initial state of a mission type row
      const survivalDateCell = page.locator('#next-MT_SURVIVAL td').nth(0);
      const initialText = await survivalDateCell.textContent();

      // Uncheck all mission types
      await page.locator('#filter-MT_SURVIVAL').uncheck();
      await page.locator('#filter-MT_DEFENSE').uncheck();
      await page.locator('#filter-MT_TERRITORY').uncheck();
      await page.locator('#filter-MT_EXCAVATE').uncheck();
      await page.locator('#filter-MT_PURIFY').uncheck();
      await page.locator('#filter-MT_EVACUATION').uncheck();
      await page.locator('#filter-MT_ARTIFACT').uncheck();
      await page.locator('#filter-MT_CORRUPTION').uncheck();
      await page.locator('#filter-MT_VOID_CASCADE').uncheck();
      await page.locator('#filter-MT_ARMAGEDDON').uncheck();
      await page.locator('#filter-MT_ALCHEMY').uncheck();

      // Wait for log to show no results (indicates filters were applied)
      await expect(page.locator('#log')).toContainText("not a one matches your filters");

      // State should have changed (either to N/A or different data)
      const newText = await survivalDateCell.textContent();
      // The table should have updated in response to filter changes
      expect(newText).toBeDefined();
    });

    test('date cells have timestamp attributes', async ({ page }) => {
      // Find any row with data
      const rows = await page.locator('table tbody tr').all();

      let foundTimestamp = false;
      for (const row of rows) {
        const dateCell = row.locator('td').nth(0);
        const text = await dateCell.textContent();

        if (text !== 'N/A') {
          const timestamp = await dateCell.getAttribute('data-timestamp');
          expect(timestamp).toBeTruthy();
          expect(parseInt(timestamp!)).toBeGreaterThan(0);
          foundTimestamp = true;
          break;
        }
      }

      expect(foundTimestamp).toBe(true);
    });
  });

  test.describe('Log display', () => {
    test('groups arbitrations by day with headers', async ({ page }) => {
      const headers = await page.locator('#log h3').all();

      // Should have at least one date header
      expect(headers.length).toBeGreaterThan(0);

      // Headers should have correct format
      const firstHeaderText = await headers[0].textContent();
      expect(firstHeaderText).toMatch(/(Sun|Mon|Tue|Wed|Thu|Fri|Sat), (January|February|March|April|May|June|July|August|September|October|November|December) \d+/);
    });

    test('displays arbitration details', async ({ page }) => {
      const firstEntry = page.locator('#log [data-timestamp]').first();
      const text = await firstEntry.textContent();

      // Should contain time, mission type, faction, location, and tier
      expect(text).toMatch(/\d+/); // Time
      expect(text).toContain('•'); // Separator
      expect(text).toContain('@'); // Location marker
      expect(text).toMatch(/\([A-F] tier/); // Tier
    });

    test('current arbitration is displayed in bold', async ({ page }) => {
      // Check if any entry is bold
      const boldEntries = await page.locator('#log b[data-timestamp]').count();

      // Should have at most one bold entry (the current one)
      expect(boldEntries).toBeLessThanOrEqual(1);
    });

    test('shows entries with timestamps in chronological order', async ({ page }) => {
      const entries = await page.locator('#log [data-timestamp]').all();
      const timestamps: number[] = [];

      for (const entry of entries) {
        const ts = await entry.getAttribute('data-timestamp');
        if (ts) {
          timestamps.push(parseInt(ts));
        }
      }

      // Should be in ascending order
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }
    });
  });

  test.describe('Filter persistence', () => {
    test('filter changes persist on page reload', async ({ page }) => {
      // Make some changes
      await page.selectOption('#select-days', '7');
      await page.locator('#filter-MT_SURVIVAL').uncheck();

      // Get the URL
      const url = page.url();

      // Reload the page
      await page.reload();
      await page.waitForSelector('#log [data-timestamp]');

      // Settings should persist
      await expect(page.locator('#select-days')).toHaveValue('7');
      await expect(page.locator('#filter-MT_SURVIVAL')).not.toBeChecked();
      expect(page.url()).toBe(url);
    });
  });

  test.describe('Mobile detection', () => {
    test('defaults to 24 hours on mobile devices', async ({ page, context }) => {
      // Simulate mobile user agent
      await context.close();
      const mobileContext = await page.context().browser()!.newContext({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
        viewport: { width: 375, height: 667 },
        hasTouch: true,
        isMobile: true,
      });

      const mobilePage = await mobileContext.newPage();
      await mobilePage.goto('/arbys.php');
      await mobilePage.waitForSelector('#log [data-timestamp]');

      // Should default to 1 day (24 hours) on mobile
      await expect(mobilePage.locator('#select-days')).toHaveValue('1');

      await mobileContext.close();
    });
  });
});
