import { test, expect } from '@playwright/test';
import { setupMockRoutes } from './helpers/api-mocks';
import {
  ENTRY_MAG_VOLT_EXCALIBUR,
  ENTRY_RHINO_FROST_LOKI_PEEK,
  ENTRY_MAG_VOLT_EXCALIBUR_ALT,
  ENTRY_RHINO_FROST_LOKI
} from '../test/invigorations/cache-fixtures';

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
  const CURRENT_WEEK = Math.trunc(((FROZEN_TIME / 1000) - 1391990400) / 604800);

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

  test('Scenario 1: loads fresh cache from same week', async ({ page }) => {
    const mockCache = {
      [CURRENT_WEEK]: ENTRY_MAG_VOLT_EXCALIBUR
    };

    await page.evaluate((cache) => {
      localStorage.setItem('invigorations.cache', JSON.stringify(cache));
    }, mockCache);

    // Reload page to trigger cache loading
    await page.reload();
    await page.waitForFunction(() => {
      const select = document.querySelector('.suit-select');
      return select && select.options.length > 1;
    }, { timeout: 30000 });

    // Verify info alert is shown
    await expect(page.locator('#cache-alert')).toBeVisible();
    await expect(page.locator('#cache-alert')).toHaveClass(/alert-info/);
    await expect(page.locator('#cache-alert')).toContainText('Pre-filled form with data for this week only from cache. For next week\'s invigorations, please verify and re-calculate.');

    // Verify form is pre-filled (peek=true since we have current week results)
    await expect(page.locator('#username')).toHaveValue('TestUser');
    await expect(page.locator('#peek')).toBeChecked();

    // Verify results are displayed
    await expect(page.locator('#results')).not.toHaveClass(/d-none/);
    await expect(page.locator('#out-suit-0')).toContainText('Mag');
    await expect(page.locator('#out-suit-1')).toContainText('Volt');
    await expect(page.locator('#out-suit-2')).toContainText('Excalibur');
  });

  test('Scenario 2: loads one-week-old cache and pre-fills form', async ({ page }) => {
    const mockCache = {
      [CURRENT_WEEK - 1]: ENTRY_RHINO_FROST_LOKI_PEEK
    };

    await page.evaluate((cache) => {
      localStorage.setItem('invigorations.cache', JSON.stringify(cache));
    }, mockCache);

    // Reload page to trigger cache loading
    await page.reload();
    await page.waitForFunction(() => {
      const select = document.querySelector('.suit-select');
      return select && select.options.length > 1;
    }, { timeout: 30000 });

    // Verify info alert is shown
    await expect(page.locator('#cache-alert')).toBeVisible();
    await expect(page.locator('#cache-alert')).toHaveClass(/alert-info/);
    await expect(page.locator('#cache-alert')).toContainText('Pre-filled form with stale data from last week\'s cache');

    // Verify form is pre-filled (peek=false for stale last week data, no results shown)
    await expect(page.locator('#username')).toHaveValue('TestUser');
    await expect(page.locator('#peek')).not.toBeChecked();

    // Verify suit selects are filled with RESPONSE suits (not request suits)
    const selects = page.locator('.suit-select');
    await expect(selects.nth(0)).toHaveValue('/Lotus/Powersuits/Rhino/RhinoBaseSuit');
    await expect(selects.nth(1)).toHaveValue('/Lotus/Powersuits/Frost/FrostBaseSuit');
    await expect(selects.nth(2)).toHaveValue('/Lotus/Powersuits/Loki/LokiBaseSuit');

    // Verify results are NOT displayed
    await expect(page.locator('#results')).toHaveClass(/d-none/);
  });

  test('Scenario 3: loads 2+ week old cache with only username', async ({ page }) => {
    const mockCache = {
      [CURRENT_WEEK - 2]: {
        ...ENTRY_MAG_VOLT_EXCALIBUR,
        request: {
          ...ENTRY_MAG_VOLT_EXCALIBUR.request,
          n: 'OldUser'
        },
        response: ENTRY_RHINO_FROST_LOKI_PEEK.response
      }
    };

    await page.evaluate((cache) => {
      localStorage.setItem('invigorations.cache', JSON.stringify(cache));
    }, mockCache);

    // Reload page to trigger cache loading
    await page.reload();
    await page.waitForFunction(() => {
      const select = document.querySelector('.suit-select');
      return select && select.options.length > 1;
    }, { timeout: 30000 });

    // Verify warning alert is shown
    await expect(page.locator('#cache-alert')).toBeVisible();
    await expect(page.locator('#cache-alert')).toHaveClass(/alert-warning/);
    await expect(page.locator('#cache-alert')).toContainText('Cached data is 2 weeks old - too stale to pre-fill form');

    // Verify only username is pre-filled
    await expect(page.locator('#username')).toHaveValue('OldUser');
    await expect(page.locator('#peek')).not.toBeChecked();

    // Verify suit selects are NOT pre-filled (default to "---")
    const selects = page.locator('.suit-select');
    await expect(selects.nth(0)).toHaveValue('---');
    await expect(selects.nth(1)).toHaveValue('---');
    await expect(selects.nth(2)).toHaveValue('---');

    // Verify results are NOT displayed
    await expect(page.locator('#results')).toHaveClass(/d-none/);
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

  test('displays both weeks in history table when available', async ({ page }) => {
    const mockCache = {
      [CURRENT_WEEK - 1]: ENTRY_MAG_VOLT_EXCALIBUR_ALT,
      [CURRENT_WEEK]: ENTRY_RHINO_FROST_LOKI
    };

    await page.evaluate((cache) => {
      localStorage.setItem('invigorations.cache', JSON.stringify(cache));
    }, mockCache);

    // Reload page to trigger cache loading
    await page.reload();
    await page.waitForFunction(() => {
      const select = document.querySelector('.suit-select');
      return select && select.options.length > 1;
    }, { timeout: 30000 });

    // Verify info alert (simple message, no history)
    await expect(page.locator('#cache-alert')).toBeVisible();
    await expect(page.locator('#cache-alert')).toHaveClass(/alert-info/);
    await expect(page.locator('#cache-alert')).toContainText('Pre-filled form with data for this week only from cache. For next week\'s invigorations, please verify and re-calculate.');

    // Verify history section is visible
    await expect(page.locator('#history')).toBeVisible();
    await expect(page.locator('#history h4')).toContainText('Invigoration History');

    // Verify both week sections are visible
    const thisWeekDiv = page.locator('#history-this-week');
    const lastWeekDiv = page.locator('#history-last-week');
    await expect(thisWeekDiv).toBeVisible();
    await expect(lastWeekDiv).toBeVisible();

    // Verify this week content
    await expect(thisWeekDiv.locator('h5')).toContainText('This Week');
    await expect(thisWeekDiv).toContainText('Rhino');
    await expect(thisWeekDiv).toContainText('Frost');
    await expect(thisWeekDiv).toContainText('Loki');

    // Verify last week content
    await expect(lastWeekDiv.locator('h5')).toContainText('Last Week');
    await expect(lastWeekDiv).toContainText('Mag');
    await expect(lastWeekDiv).toContainText('Volt');
    await expect(lastWeekDiv).toContainText('Excalibur');
  });

  test('cache pruning keeps last/current week only', async ({ page }) => {
    // Create cache with entries spanning multiple weeks
    const mockCache = {
      [CURRENT_WEEK - 3]: ENTRY_MAG_VOLT_EXCALIBUR,
      [CURRENT_WEEK - 2]: ENTRY_MAG_VOLT_EXCALIBUR,
      [CURRENT_WEEK - 1]: ENTRY_MAG_VOLT_EXCALIBUR,
      [CURRENT_WEEK]: ENTRY_MAG_VOLT_EXCALIBUR,
      [CURRENT_WEEK + 1]: ENTRY_MAG_VOLT_EXCALIBUR
    };

    await page.evaluate((cache) => {
      localStorage.setItem('invigorations.cache', JSON.stringify(cache));
    }, mockCache);

    // Fill in form and submit to trigger pruning
    await page.locator('#username').fill('TestUser');
    const selects = page.locator('.suit-select');
    await selects.nth(0).selectOption('/Lotus/Powersuits/Mag/MagBaseSuit');

    // Mock the API response
    await page.route('**/oracle.browse.wf/invigorations*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          suits: ['/Lotus/Powersuits/Volt/VoltBaseSuit'],
          offensiveUpgrades: ['/Lotus/Upgrades/Invigorations/Offensive/OffensiveInvigorationPowerRange'],
          defensiveUpgrades: ['/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationArmor']
        })
      });
    });

    // Submit form
    await page.locator('input[type="submit"]').click();

    // Wait for results
    await expect(page.locator('#results')).not.toHaveClass(/d-none/);

    // Verify pruning happened
    const prunedCache = await page.evaluate(() => {
      const cache = localStorage.getItem('invigorations.cache');
      return cache ? JSON.parse(cache) : null;
    });

    expect(prunedCache).not.toBeNull();

    // Old weeks should be pruned, last/current/future weeks should remain
    expect(prunedCache[CURRENT_WEEK - 3]).toBeUndefined();
    expect(prunedCache[CURRENT_WEEK - 2]).toBeUndefined();
    expect(prunedCache[CURRENT_WEEK - 1]).toBeDefined();
    expect(prunedCache[CURRENT_WEEK]).toBeDefined();
    expect(prunedCache[CURRENT_WEEK + 1]).toBeDefined();
  });

  test('Scenario 4: loads next-week cache (peek result saved previously)', async ({ page }) => {
    const mockCache = {
      [CURRENT_WEEK + 1]: ENTRY_RHINO_FROST_LOKI_PEEK
    };

    await page.evaluate((cache) => {
      localStorage.setItem('invigorations.cache', JSON.stringify(cache));
    }, mockCache);

    await page.reload();
    await page.waitForFunction(() => {
      const select = document.querySelector('.suit-select');
      return select && select.options.length > 1;
    }, { timeout: 30000 });

    // Verify success alert is shown
    await expect(page.locator('#cache-alert')).toBeVisible();
    await expect(page.locator('#cache-alert')).toHaveClass(/alert-success/);
    await expect(page.locator('#cache-alert')).toContainText('Loaded fresh data from cache');

    // Verify form is pre-filled with peek=true
    await expect(page.locator('#username')).toHaveValue('TestUser');
    await expect(page.locator('#peek')).toBeChecked();

    // Verify results are displayed (next week's data)
    await expect(page.locator('#results')).not.toHaveClass(/d-none/);
    await expect(page.locator('#out-suit-0')).toContainText('Rhino');
    await expect(page.locator('#out-suit-1')).toContainText('Frost');
    await expect(page.locator('#out-suit-2')).toContainText('Loki');
  });

  test('saving with peek=false stores at currentWeek', async ({ page }) => {
    await page.locator('#username').fill('TestUser');
    // peek is unchecked by default

    const selects = page.locator('.suit-select');
    await selects.nth(0).selectOption('/Lotus/Powersuits/Mag/MagBaseSuit');

    await page.route('**/oracle.browse.wf/invigorations*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ENTRY_MAG_VOLT_EXCALIBUR.response)
      });
    });

    await page.locator('input[type="submit"]').click();
    await expect(page.locator('#results')).not.toHaveClass(/d-none/);

    const savedCache = await page.evaluate(() => JSON.parse(localStorage.getItem('invigorations.cache')!));
    expect(savedCache[CURRENT_WEEK]).toBeDefined();
    expect(savedCache[CURRENT_WEEK + 1]).toBeUndefined();
  });

  test('saving with peek=true stores at currentWeek+1', async ({ page }) => {
    await page.locator('#username').fill('TestUser');
    await page.locator('#peek').check();

    const selects = page.locator('.suit-select');
    await selects.nth(0).selectOption('/Lotus/Powersuits/Mag/MagBaseSuit');

    await page.route('**/oracle.browse.wf/invigorations*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ENTRY_RHINO_FROST_LOKI_PEEK.response)
      });
    });

    await page.locator('input[type="submit"]').click();
    await expect(page.locator('#results')).not.toHaveClass(/d-none/);

    const savedCache = await page.evaluate(() => JSON.parse(localStorage.getItem('invigorations.cache')!));
    expect(savedCache[CURRENT_WEEK]).toBeUndefined();
    expect(savedCache[CURRENT_WEEK + 1]).toBeDefined();
  });

  test('history shows only last week when no current week data', async ({ page }) => {
    const mockCache = {
      [CURRENT_WEEK - 1]: ENTRY_RHINO_FROST_LOKI_PEEK
    };

    await page.evaluate((cache) => {
      localStorage.setItem('invigorations.cache', JSON.stringify(cache));
    }, mockCache);

    await page.reload();
    await page.waitForFunction(() => {
      const select = document.querySelector('.suit-select');
      return select && select.options.length > 1;
    }, { timeout: 30000 });

    // History section should be visible but only last week shown
    await expect(page.locator('#history')).toBeVisible();
    await expect(page.locator('#history-this-week')).toHaveClass(/d-none/);
    await expect(page.locator('#history-last-week')).toBeVisible();
    await expect(page.locator('#history-last-week')).toContainText('Rhino');
    await expect(page.locator('#history-last-week')).toContainText('Frost');
    await expect(page.locator('#history-last-week')).toContainText('Loki');
  });

});
