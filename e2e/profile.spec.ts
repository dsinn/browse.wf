import { test, expect } from '@playwright/test';

/**
 * Smoke tests for Profile Viewer (/profile.php)
 *
 * These tests verify that the profile page loads without errors and displays
 * the auto-loaded demo profile data correctly.
 *
 * Profile.ts auto-loads a demo profile from supplemental-data/profile-[DE]Rebecca.json
 */

test.describe('Profile Page (/profile.php)', () => {
  test.beforeEach(async ({ page }) => {
    // Track console errors
    const errors: string[] = [];
    page.on('pageerror', error => {
      errors.push(error.message);
    });
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Store errors on page context for tests to access
    await page.exposeFunction('getErrors', () => errors);
  });

  test('loads without JavaScript errors', async ({ page }) => {
    await page.goto('/profile.php');

    // Wait for the profile to auto-load
    await page.waitForSelector('#profile-nav:not(.d-none)', { timeout: 10000 });

    // Navigate through all tabs to ensure no errors occur
    const tabs = ['fashion', 'syndicates', 'missions', 'achievements', 'stats'];
    for (const tab of tabs) {
      await page.click(`a[data-tab="${tab}"]`);
      await page.waitForSelector(`#${tab}:not(.d-none)`, { timeout: 2000 });
    }

    // Check for JavaScript errors
    const errors = await page.evaluate(() => (window as any).getErrors());
    expect(errors).toHaveLength(0);
  });

  test('displays profile information correctly', async ({ page }) => {
    await page.goto('/profile.php');
    await page.waitForSelector('#profile-nav:not(.d-none)', { timeout: 10000 });

    // Verify profile name is displayed
    const profileName = await page.locator('#profile-name').textContent();
    expect(profileName).toBeTruthy();
    expect(profileName).not.toBe('');

    // Verify mastery rank is displayed
    const mrSection = page.locator('#mr');
    await expect(mrSection).toBeVisible();
    const mrText = await mrSection.textContent();
    expect(mrText).toMatch(/Mastery Rank \d+/);
  });

  test('displays missions table with data', async ({ page }) => {
    await page.goto('/profile.php');
    await page.waitForSelector('#profile-nav:not(.d-none)', { timeout: 10000 });

    // Navigate to Missions tab
    await page.click('a[data-tab="missions"]');
    await page.waitForSelector('#missions:not(.d-none)');

    // Wait for missions table to populate
    await page.waitForSelector('#missions tbody tr', { timeout: 5000 });

    // Verify table has mission data
    const rows = await page.locator('#missions tbody tr').all();
    expect(rows.length).toBeGreaterThan(0);

    // Check that first row has mission location and completion count
    const firstRow = rows[0];
    const locationCell = await firstRow.locator('td').first().textContent();
    const completionsCell = await firstRow.locator('td').nth(1).textContent();

    expect(locationCell).toBeTruthy();
    expect(locationCell?.length).toBeGreaterThan(0);
    expect(completionsCell).toMatch(/\d+/); // Should contain a number
  });

  test('displays syndicates with standings', async ({ page }) => {
    await page.goto('/profile.php');
    await page.waitForSelector('#profile-nav:not(.d-none)', { timeout: 10000 });

    // Syndicates tab should be active by default (or navigate to it)
    await page.click('a[data-tab="syndicates"]');
    await page.waitForSelector('#syndicates:not(.d-none)');

    // Verify at least one syndicate is displayed
    const syndicateCards = await page.locator('#syndicates .card').all();
    expect(syndicateCards.length).toBeGreaterThan(0);
  });

  test('tab navigation works correctly', async ({ page }) => {
    await page.goto('/profile.php');
    await page.waitForSelector('#profile-nav:not(.d-none)', { timeout: 10000 });

    const tabs = [
      { name: 'fashion', selector: '#fashion' },
      { name: 'missions', selector: '#missions' },
      { name: 'achievements', selector: '#achievements' },
      { name: 'stats', selector: '#stats' },
      { name: 'syndicates', selector: '#syndicates' }
    ];

    for (const tab of tabs) {
      // Click the tab
      await page.click(`a[data-tab="${tab.name}"]`);

      // Verify tab content is visible
      await expect(page.locator(tab.selector)).toBeVisible();

      // Verify tab link has active class
      await expect(page.locator(`a[data-tab="${tab.name}"]`)).toHaveClass(/active/);

      // Verify other tabs are hidden
      const otherTabs = tabs.filter(t => t.name !== tab.name);
      for (const other of otherTabs) {
        await expect(page.locator(other.selector)).toBeHidden();
      }
    }
  });
});
