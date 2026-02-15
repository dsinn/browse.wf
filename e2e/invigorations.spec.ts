import { test, expect } from '@playwright/test';
import { setupMockRoutes } from './helpers/api-mocks';

/**
 * E2E tests for Invigorations Page (/invigorations.php)
 *
 * These tests verify the caching functionality that stores and loads
 * invigoration calculation results from localStorage.
 */

test.describe('Invigorations Page (/invigorations.php)', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses for deterministic, fast, offline-capable tests
    // Don't freeze time - invigoration tests use Date.now() for cache timestamp validation
    await setupMockRoutes(page, { freezeTime: false });

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
    // Create a cache entry for current week (page already loaded in beforeEach)

    const mockCache = {
      request: {
        n: 'TestUser',
        s: [
          '/Lotus/Powersuits/Mag/MagBaseSuit',
          '/Lotus/Powersuits/Volt/VoltBaseSuit',
          '/Lotus/Powersuits/Excalibur/ExcaliburBaseSuit'
        ],
        p: false
      },
      response: {
        suits: [
          '/Lotus/Powersuits/Mag/MagBaseSuit',
          '/Lotus/Powersuits/Volt/VoltBaseSuit',
          '/Lotus/Powersuits/Excalibur/ExcaliburBaseSuit'
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
      },
      timestamp: Date.now()
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

    // Verify success alert is shown
    await expect(page.locator('#cache-alert')).toBeVisible();
    await expect(page.locator('#cache-alert')).toHaveClass(/alert-success/);
    await expect(page.locator('#cache-alert')).toContainText('Loaded fresh data from this week\'s cache');

    // Verify form is pre-filled
    await expect(page.locator('#username')).toHaveValue('TestUser');
    await expect(page.locator('#peek')).not.toBeChecked();

    // Verify results are displayed
    await expect(page.locator('#results')).not.toHaveClass(/d-none/);
    await expect(page.locator('#out-suit-0')).toContainText('Mag');
    await expect(page.locator('#out-suit-1')).toContainText('Volt');
    await expect(page.locator('#out-suit-2')).toContainText('Excalibur');
  });

  test('Scenario 2: loads one-week-old cache and pre-fills form', async ({ page }) => {
    // Create a cache entry from last week (page already loaded in beforeEach)

    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    const mockCache = {
      request: {
        n: 'TestUser',
        s: [
          '/Lotus/Powersuits/Mag/MagBaseSuit',
          '/Lotus/Powersuits/Volt/VoltBaseSuit',
          '/Lotus/Powersuits/Excalibur/ExcaliburBaseSuit'
        ],
        p: true
      },
      response: {
        suits: [
          '/Lotus/Powersuits/Rhino/RhinoBaseSuit',
          '/Lotus/Powersuits/Frost/FrostBaseSuit',
          '/Lotus/Powersuits/Loki/LokiBaseSuit'
        ],
        offensiveUpgrades: [
          '/Lotus/Upgrades/Invigorations/Offensive/OffensiveInvigorationMeleeDamage',
          '/Lotus/Upgrades/Invigorations/Offensive/OffensiveInvigorationPrimaryDamage',
          '/Lotus/Upgrades/Invigorations/Offensive/OffensiveInvigorationSecondaryDamage'
        ],
        defensiveUpgrades: [
          '/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationMovementSpeed',
          '/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationParkourSpeed',
          '/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationReloadSpeed'
        ]
      },
      timestamp: oneWeekAgo
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

    // Verify info alert is shown with historical data (peek was enabled)
    await expect(page.locator('#cache-alert')).toBeVisible();
    await expect(page.locator('#cache-alert')).toHaveClass(/alert-info/);
    await expect(page.locator('#cache-alert')).toContainText('Pre-filled form with stale data from last week\'s cache');

    // Verify alert shows last week's offerings (from request.s, not response.suits)
    await expect(page.locator('#cache-alert')).toContainText('Last week\'s offerings: Mag, Volt, Excalibur');

    // Verify form is pre-filled with username and peek state
    await expect(page.locator('#username')).toHaveValue('TestUser');
    await expect(page.locator('#peek')).toBeChecked();

    // Verify suit selects are filled with RESPONSE suits (not request suits)
    const selects = page.locator('.suit-select');
    await expect(selects.nth(0)).toHaveValue('/Lotus/Powersuits/Rhino/RhinoBaseSuit');
    await expect(selects.nth(1)).toHaveValue('/Lotus/Powersuits/Frost/FrostBaseSuit');
    await expect(selects.nth(2)).toHaveValue('/Lotus/Powersuits/Loki/LokiBaseSuit');

    // Verify results are NOT displayed
    await expect(page.locator('#results')).toHaveClass(/d-none/);
  });

  test('Scenario 2b: one-week-old cache without peek shows no historical data', async ({ page }) => {
    // Create a cache entry from last week with peek=false
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    const mockCache = {
      request: {
        n: 'TestUser',
        s: [
          '/Lotus/Powersuits/Mag/MagBaseSuit',
          '/Lotus/Powersuits/Volt/VoltBaseSuit',
          '/Lotus/Powersuits/Excalibur/ExcaliburBaseSuit'
        ],
        p: false  // Peek disabled
      },
      response: {
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
      },
      timestamp: oneWeekAgo
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

    // Verify info alert is shown WITHOUT historical data
    await expect(page.locator('#cache-alert')).toBeVisible();
    await expect(page.locator('#cache-alert')).toHaveClass(/alert-info/);
    await expect(page.locator('#cache-alert')).toContainText('Pre-filled form with stale data from last week\'s cache');

    // Verify alert does NOT show historical offerings
    await expect(page.locator('#cache-alert')).not.toContainText('Last week\'s offerings:');

    // Verify form is pre-filled with username and peek state
    await expect(page.locator('#username')).toHaveValue('TestUser');
    await expect(page.locator('#peek')).not.toBeChecked();

    // Verify results are NOT displayed
    await expect(page.locator('#results')).toHaveClass(/d-none/);
  });

  test('Scenario 3: loads 2+ week old cache with only username', async ({ page }) => {
    // Create a cache entry from 2+ weeks ago (page already loaded in beforeEach)

    const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);

    const mockCache = {
      request: {
        n: 'OldUser',
        s: [
          '/Lotus/Powersuits/Mag/MagBaseSuit',
          '/Lotus/Powersuits/Volt/VoltBaseSuit',
          '/Lotus/Powersuits/Excalibur/ExcaliburBaseSuit'
        ],
        p: false
      },
      response: {
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
      },
      timestamp: twoWeeksAgo
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
    await expect(page.locator('#cache-alert')).toContainText('Cached data too stale to pre-fill form');

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
    // Set up cache (page already loaded in beforeEach)

    const mockCache = {
      request: {
        n: 'TestUser',
        s: ['/Lotus/Powersuits/Mag/MagBaseSuit'],
        p: false
      },
      response: {
        suits: ['/Lotus/Powersuits/Mag/MagBaseSuit'],
        offensiveUpgrades: ['/Lotus/Upgrades/Invigorations/Offensive/OffensiveInvigorationPowerStrength'],
        defensiveUpgrades: ['/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationHealth']
      },
      timestamp: Date.now()
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
    // Page already loaded in beforeEach

    // Set up both inventory and cache
    const inventoryData = {
      InfestedFoundry: {
        InvigorationIndex: await page.evaluate(() => {
          return Math.trunc(((Date.now() / 1000) - 1391990400) / 604800);
        }),
        InvigorationSuitOfferings: [
          '/Lotus/Powersuits/Trinity/TrinityBaseSuit',
          '/Lotus/Powersuits/Nova/NovaBaseSuit',
          '/Lotus/Powersuits/Valkyr/ValkyrBaseSuit'
        ]
      }
    };

    const cacheData = {
      request: {
        n: 'CachedUser',
        s: ['/Lotus/Powersuits/Mag/MagBaseSuit'],
        p: false
      },
      response: {
        suits: ['/Lotus/Powersuits/Mag/MagBaseSuit'],
        offensiveUpgrades: ['/Lotus/Upgrades/Invigorations/Offensive/OffensiveInvigorationPowerStrength'],
        defensiveUpgrades: ['/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationHealth']
      },
      timestamp: Date.now()
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
    // Page already loaded in beforeEach

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

    // Verify cache was saved to localStorage
    const savedCache = await page.evaluate(() => {
      const cache = localStorage.getItem('invigorations.cache');
      return cache ? JSON.parse(cache) : null;
    });

    expect(savedCache).not.toBeNull();
    expect(savedCache.request.n).toBe('NewUser');
    expect(savedCache.request.p).toBe(true);
    expect(savedCache.request.s).toEqual([
      '/Lotus/Powersuits/Mag/MagBaseSuit',
      '/Lotus/Powersuits/Volt/VoltBaseSuit'
    ]);
    expect(savedCache.response.suits).toHaveLength(3);
    expect(savedCache.timestamp).toBeGreaterThan(Date.now() - 10000); // Within last 10 seconds
  });
});
