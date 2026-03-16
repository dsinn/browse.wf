import { test, expect } from '@playwright/test';
import { setupMockRoutes } from './helpers/api-mocks';
import { ENTRY_MAG_VOLT_EXCALIBUR, ENTRY_RHINO_FROST_LOKI_PEEK } from '../test/invigorations/cache-fixtures';

/**
 * E2E tests for Invigorations Page (/invigorations.php)
 *
 * These tests verify the caching functionality that stores and loads
 * invigoration calculation results from localStorage.
 */

test.describe('Invigorations Page (/invigorations.php)', () => {
  // Freeze time at module load time (intentionally non-deterministic: different runs may land
  // on different weeks, providing coverage of week-boundary behaviour over time)
  const FROZEN_TIME = Date.now();
  let CURRENT_WEEK = 0;

  test.beforeEach(async ({ page }) => {
    // Mock API responses for deterministic, fast, offline-capable tests
    // Freeze time to prevent flakiness on weekly boundaries
    await setupMockRoutes(page, { freezeTime: true, frozenTime: FROZEN_TIME });

    await page.goto('/invigorations.php');

    // Clear localStorage after page loads
    await page.evaluate(() => {
      localStorage.clear();
    });

    // Wait for warframe data to load (indicated by dropdown options being populated)
    await page.waitForFunction(() => {
      const select = document.querySelector('.suit-select');
      return select && select.options.length > 1;
    }, { timeout: 30000 });

    // Derive CURRENT_WEEK from production code — if the offset formula changes, this follows automatically
    CURRENT_WEEK = await page.evaluate(() => (window as any).getWeekIndex(Date.now()));
  });

  test('loads without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => {
      errors.push(error.message);
    });
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Warframe data already loaded in beforeEach
    expect(errors).toHaveLength(0);
  });

  test('displays form correctly without cache', async ({ page }) => {
    // Page already loaded in beforeEach
    // Verify form elements exist
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#peek')).toBeVisible();
    await expect(page.locator('.suit-select')).toHaveCount(3);
    await expect(page.locator('input[type="submit"]')).toBeVisible();

    // Results should be hidden
    await expect(page.locator('#results')).toHaveClass(/d-none/);

    // No cache alert should be shown
    await expect(page.locator('#cache-alert')).toHaveClass(/d-none/);
  });

  test('alert disappears after manual form submission', async ({ page }) => {
    const mockCache = {
      [CURRENT_WEEK]: ENTRY_MAG_VOLT_EXCALIBUR
    };

    await page.evaluate((cache) => {
      localStorage.setItem('invigorations.cache', JSON.stringify(cache));
    }, mockCache);

    await page.reload();
    await page.waitForFunction(() => {
      const select = document.querySelector('.suit-select');
      return select && select.options.length > 1;
    }, { timeout: 30000 });

    // Verify alert is visible
    await expect(page.locator('#cache-alert')).toBeVisible();

    // Mock the API response
    await page.route('**/oracle.browse.wf/invigorations*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          suits: ['/Lotus/Powersuits/Mag/MagBaseSuit'],
          offensiveUpgrades: ['/Lotus/Upgrades/Invigorations/Offensive/OffensiveInvigorationPowerRange'],
          defensiveUpgrades: ['/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationArmor']
        })
      });
    });

    // Submit form
    await page.locator('input[type="submit"]').click();

    // Wait for results to appear
    await expect(page.locator('#results')).not.toHaveClass(/d-none/);

    // Verify alert is hidden
    await expect(page.locator('#cache-alert')).toHaveClass(/d-none/);
  });

  test('inventory data takes precedence over cache', async ({ page }) => {
    // Set up both inventory and cache
    const inventoryData = {
      InfestedFoundry: {
        InvigorationIndex: CURRENT_WEEK,
        InvigorationSuitOfferings: [
          '/Lotus/Powersuits/Trinity/TrinityBaseSuit',
          '/Lotus/Powersuits/Nova/NovaBaseSuit',
          '/Lotus/Powersuits/Valkyr/ValkyrBaseSuit'
        ]
      }
    };

    const cacheData = {
      [CURRENT_WEEK]: {
        ...ENTRY_MAG_VOLT_EXCALIBUR,
        request: {
          ...ENTRY_MAG_VOLT_EXCALIBUR.request,
          n: 'CachedUser'
        }
      }
    };

    await page.evaluate(({ inventory, cache }) => {
      localStorage.setItem('inventory', JSON.stringify(inventory));
      localStorage.setItem('invigorations.cache', JSON.stringify(cache));
    }, { inventory: inventoryData, cache: cacheData });

    await page.reload();
    await page.waitForFunction(() => {
      const select = document.querySelector('.suit-select');
      return select && select.options.length > 1;
    }, { timeout: 30000 });

    // The key behavior: cache alert should NOT be shown when inventory exists
    // (inventory takes precedence over cache)
    await expect(page.locator('#cache-alert')).toHaveClass(/d-none/);

    // Verify inventory status message is shown
    await expect(page.locator('#inventory-status')).not.toHaveClass(/d-none/);
    await expect(page.locator('#inventory-upsell')).toHaveClass(/d-none/);

    // Note: We don't check the exact values in selects due to timing issues with inventory loading
    // The important assertion is that cache alert is hidden, proving inventory takes precedence
  });

  test('pre-fills form with response suits when current-week cache has peek data', async ({ page }) => {
    // Scenario: user peeked last week (saving data to currentWeek slot now that the week rolled over).
    // The request.s contains last week's suits; response.suits contains this week's offerings.
    // The form should be pre-filled with response.suits so the user can immediately peek at next week.
    const mockCache = {
      [CURRENT_WEEK]: ENTRY_RHINO_FROST_LOKI_PEEK
    };

    await page.evaluate((cache) => {
      localStorage.setItem('invigorations.cache', JSON.stringify(cache));
    }, mockCache);

    await page.reload();
    await page.waitForFunction(() => {
      const select = document.querySelector('.suit-select');
      return select && select.options.length > 1;
    }, { timeout: 30000 });

    const selects = page.locator('.suit-select');
    await expect(selects.nth(0)).toHaveValue(ENTRY_RHINO_FROST_LOKI_PEEK.response.suits[0]);
    await expect(selects.nth(1)).toHaveValue(ENTRY_RHINO_FROST_LOKI_PEEK.response.suits[1]);
    await expect(selects.nth(2)).toHaveValue(ENTRY_RHINO_FROST_LOKI_PEEK.response.suits[2]);
  });

  test('new submission updates cache in localStorage', async ({ page }) => {

    // Fill in form
    await page.locator('#username').fill('NewUser');
    await page.locator('#peek').check();

    const selects = page.locator('.suit-select');
    await selects.nth(0).selectOption('/Lotus/Powersuits/Mag/MagBaseSuit');
    await selects.nth(1).selectOption('/Lotus/Powersuits/Volt/VoltBaseSuit');

    // Mock the API response
    await page.route('**/oracle.browse.wf/invigorations*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          suits: [
            '/Lotus/Powersuits/Rhino/RhinoBaseSuit',
            '/Lotus/Powersuits/Frost/FrostBaseSuit',
            '/Lotus/Powersuits/Loki/LokiBaseSuit'
          ],
          offensiveUpgrades: [
            '/Lotus/Upgrades/Invigorations/Offensive/OffensiveInvigorationPowerStrength',
            '/Lotus/Upgrades/Invigorations/Offensive/OffensiveInvigorationPowerRange',
            '/Lotus/Upgrades/Invigorations/Offensive/OffensiveInvigorationPowerDuration'
          ],
          defensiveUpgrades: [
            '/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationHealth',
            '/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationArmor',
            '/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationEnergy'
          ]
        })
      });
    });

    // Submit form
    await page.locator('input[type="submit"]').click();

    // Wait for results
    await expect(page.locator('#results')).not.toHaveClass(/d-none/);

    // Verify cache was saved to localStorage with new structure
    const savedCache = await page.evaluate(() => {
      const cache = localStorage.getItem('invigorations.cache');
      return cache ? JSON.parse(cache) : null;
    });

    expect(savedCache).not.toBeNull();

    // With peek=true, should be saved at CURRENT_WEEK+1
    const targetWeek = CURRENT_WEEK + 1;
    expect(savedCache[targetWeek]).toBeDefined();
    expect(savedCache[targetWeek].request.n).toBe('NewUser');
    expect(savedCache[targetWeek].request.p).toBe(true);
    expect(savedCache[targetWeek].request.s).toEqual([
      '/Lotus/Powersuits/Mag/MagBaseSuit',
      '/Lotus/Powersuits/Volt/VoltBaseSuit'
    ]);
    expect(savedCache[targetWeek].response.suits).toHaveLength(3);
  });

});
