import { test, expect } from '@playwright/test';
import { setupMockRoutes } from '../helpers/api-mocks';
import { expiryBadge } from './helpers';

test.describe('Live Page - Descendia Card', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses for deterministic, fast, offline-capable tests
    await setupMockRoutes(page);
    await page.goto('/live.php');

    // Wait for initial data to load
    await page.waitForSelector('#arby-what:not(:has-text("Loading..."))', { timeout: 10000 });
    // Wait for Descendia table to render (should replace "Loading..." with actual data)
    await page.waitForSelector('#descendia-table tbody:not(:has-text("Loading..."))', { timeout: 10000 });
  });

  test.describe('Card Structure', () => {
    test('renders card header with title, expiry badge, and completion toggles', async ({ page }) => {
      const header = page.locator('.card-header:has-text("Descendia")');
      await expect(header).toBeVisible();

      // Should have collapse toggle span
      const collapseToggle = header.locator('[data-collapse-toggle="descendia"]');
      await expect(collapseToggle).toBeVisible();

      await expect(expiryBadge(header)).toBeVisible();

      // Should have completion toggles container
      const completionToggles = header.locator('#descent-checks');
      await expect(completionToggles).toBeVisible();

      // Should have 2 completion toggle checkboxes
      const checkboxes = completionToggles.locator('.completion-check');
      await expect(checkboxes).toHaveCount(2);
    });

    test('renders table with correct headers', async ({ page }) => {
      const table = page.locator('#descendia-table');
      await expect(table).toBeVisible();

      // Check all column headers
      const headers = table.locator('thead th');
      await expect(headers).toHaveCount(6);

      const headerTexts = await headers.allTextContents();
      expect(headerTexts).toEqual(['Level', 'Mission Type', 'Challenge', 'Arena', 'Specs', 'Auras']);
    });

    test('has collapsible card functionality', async ({ page }) => {
      const collapseToggle = page.locator('[data-collapse-toggle="descendia"]');
      const cardBody = page.locator('#descendia-table').locator('..');

      // Card body should be visible initially
      await expect(cardBody).toBeVisible();

      // Click collapse toggle
      await collapseToggle.click();

      // Card body should be hidden
      await expect(cardBody).toBeHidden();

      // Click again to expand
      await collapseToggle.click();
      await expect(cardBody).toBeVisible();
    });
  });

  test.describe('Challenge Data', () => {
    test('renders 21 challenge rows', async ({ page }) => {
      const rows = page.locator('#descendia-table tbody tr');
      const count = await rows.count();
      expect(count).toBe(21);
    });

    test('each row has all 6 columns', async ({ page }) => {
      const rows = page.locator('#descendia-table tbody tr');
      const count = await rows.count();

      for (let i = 0; i < count; i++) {
        const row = rows.nth(i);
        const cells = await row.locator('td').count();
        expect(cells).toBe(6);
      }
    });

    test('level column shows numbers 1-21', async ({ page }) => {
      const levelCells = page.locator('#descendia-table tbody tr td:nth-child(1)');
      const levelTexts = await levelCells.allTextContents();

      // Should have 21 levels
      expect(levelTexts.length).toBe(21);

      // Should be numbers 1 through 21
      for (let i = 0; i < 21; i++) {
        expect(levelTexts[i]).toBe(String(i + 1));
      }
    });

    test('level column is centered', async ({ page }) => {
      const firstLevelCell = page.locator('#descendia-table tbody tr').first().locator('td:nth-child(1)');
      await expect(firstLevelCell).toHaveClass(/text-center/);
    });

    test('mission types are displayed', async ({ page }) => {
      const missionTypeCells = page.locator('#descendia-table tbody tr td:nth-child(2)');
      const missionTypes = await missionTypeCells.allTextContents();

      // Should have 21 mission types
      expect(missionTypes.length).toBe(21);

      // Each should be non-empty
      missionTypes.forEach(type => {
        expect(type).toBeTruthy();
        expect(type.length).toBeGreaterThan(0);
      });

      // Should have variety in mission types (not all the same)
      const uniqueTypes = new Set(missionTypes);
      expect(uniqueTypes.size).toBeGreaterThan(1);
    });

    test('challenge names are displayed', async ({ page }) => {
      const challengeCells = page.locator('#descendia-table tbody tr td:nth-child(3)');
      const challenges = await challengeCells.allTextContents();

      // Should have 21 challenges
      expect(challenges.length).toBe(21);

      // Each should be non-empty (or "-" for empty)
      challenges.forEach(challenge => {
        expect(challenge).toBeTruthy();
        expect(challenge.length).toBeGreaterThan(0);
      });
    });

    test('arena cells show emoji for known arenas', async ({ page }) => {
      const arenaCells = page.locator('#descendia-table tbody tr td:nth-child(4)');
      const count = await arenaCells.count();
      expect(count).toBe(21);

      // Each known arena should render a <span> with a tooltip
      for (let i = 0; i < count; i++) {
        const span = arenaCells.nth(i).locator('span[data-bs-toggle="tooltip"]');
        await expect(span).toBeVisible();
        const title = await span.getAttribute('data-bs-title');
        expect(title).toBeTruthy();
        expect(title).not.toMatch(/\.level$/i);
        expect(title).not.toContain('/');
      }
    });

    test('specs column shows content or dash', async ({ page }) => {
      const specsCells = page.locator('#descendia-table tbody tr td:nth-child(5)');
      const specs = await specsCells.allTextContents();

      // Should have 21 specs entries
      expect(specs.length).toBe(21);

      // Each should be non-empty (content or "-")
      specs.forEach(spec => {
        expect(spec).toBeTruthy();
        expect(spec.length).toBeGreaterThan(0);
      });

      // Should have at least some rows with "-" (empty specs)
      const emptySpecs = specs.filter(s => s === '-');
      expect(emptySpecs.length).toBeGreaterThan(0);
    });

    test('auras column shows content or dash', async ({ page }) => {
      const aurasCells = page.locator('#descendia-table tbody tr td:nth-child(6)');
      const auras = await aurasCells.allTextContents();

      // Should have 21 auras entries
      expect(auras.length).toBe(21);

      // Each should be non-empty (content or "-")
      auras.forEach(aura => {
        expect(aura).toBeTruthy();
        expect(aura.length).toBeGreaterThan(0);
      });

      // Should have at least some rows with "-" (empty auras)
      const emptyAuras = auras.filter(a => a === '-');
      expect(emptyAuras.length).toBeGreaterThan(0);
    });
  });

  test.describe('Completion Toggles', () => {
    test('both completion toggles are clickable', async ({ page }) => {
      const completionToggles = page.locator('#descent-checks .completion-check');
      await expect(completionToggles).toHaveCount(2);

      // Click first toggle
      await completionToggles.nth(0).click();

      // Click second toggle
      await completionToggles.nth(1).click();

      // Both should still be visible (just verifying they're interactive)
      await expect(completionToggles.nth(0)).toBeVisible();
      await expect(completionToggles.nth(1)).toBeVisible();
    });
  });

  test.describe('Data Loading', () => {
    test('shows active Descent based on timestamp', async ({ page }) => {
      // The mock worldState.json should have an active Descent
      // (one where Activation <= now < Expiry)
      const rows = page.locator('#descendia-table tbody tr');
      const count = await rows.count();

      // Should have exactly 21 rows (the active Descent's challenges)
      expect(count).toBe(21);
    });

    test('displays challenges from active Descent in worldState', async ({ page }) => {
      // Verify data is present (already loaded in beforeEach)
      const rows = page.locator('#descendia-table tbody tr');
      const count = await rows.count();

      // Should have exactly 21 rows from the active Descent
      expect(count).toBe(21);

      // Verify the table has actual data, not just empty/loading state
      const firstMissionType = await page.locator('#descendia-table tbody tr').first().locator('td:nth-child(2)').textContent();
      expect(firstMissionType).toBeTruthy();
      expect(firstMissionType).not.toBe('Loading...');
    });
  });
});
