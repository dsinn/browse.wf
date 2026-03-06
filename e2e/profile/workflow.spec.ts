import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { setupMockRoutes } from '../helpers/api-mocks';
import { TEST_FRONT_PROXY_BASE_URL } from '../../test/helpers/test-constants';

// ES module __dirname polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const proxyHost = new URL(TEST_FRONT_PROXY_BASE_URL).host;
const profileData = JSON.parse(fs.readFileSync(path.join(__dirname, '../../test/profile/getProfileViewingData.html'), 'utf8'));

/**
 * E2E tests for Profile Viewer workflow
 *
 * Tests the happy path for uploading and viewing a profile through the step-by-step workflow.
 */

test.describe('Profile Workflow - Happy Path', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses for deterministic, fast, offline-capable tests
    await setupMockRoutes(page);

    // Mock the front proxy profile endpoint
    await page.route(`**/${proxyHost}/profile*`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(profileData),
      });
    });

    // Grant clipboard permissions so copyWarframePath() works in tests
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  });

  test('completes full workflow with EE.log upload', async ({ page }) => {
    await page.goto('/profile.php');

    // Verify initial state - steps 2 and 3 hidden, step 1 not complete
    await expect(page.locator('#step2-container')).toBeHidden();
    await expect(page.locator('#step3-container')).toBeHidden();
    await expect(page.locator('#step1-container')).not.toHaveClass(/complete/);

    // Step 1: Select platform — reveals step 2
    await page.selectOption('#platform-select', 'pc');
    await expect(page.locator('#step1-container')).toHaveClass(/complete/);
    await expect(page.locator('#step2-container')).toBeVisible();
    await expect(page.locator('#step3-container')).toBeHidden();

    // Step 2: Click Copy button — reveals step 3
    await page.click('button:has-text("Click Me")');
    await expect(page.locator('#step2-container')).toHaveClass(/complete/);
    await expect(page.locator('#step3-container')).toBeVisible();

    // Step 3: Upload EE.log — should auto-fetch via proxy and render
    const eeLogPath = path.join(__dirname, '../../test/profile/EE.log');
    await page.setInputFiles('#ee-log-file', eeLogPath);

    // Wait for profile to auto-render and step 3 to complete
    await expect(page.locator('#step3-container')).toHaveClass(/complete/, { timeout: 5000 });
    await expect(page.locator('#profile-nav')).toBeVisible();
    await expect(page.locator('#profile-name')).toContainText('AerodynamicHead');

    // Refresh alert should be hidden (fresh data was just fetched)
    await expect(page.locator('#refresh-alert')).toBeHidden();

    // Verify profile tabs are clickable
    await page.click('a[data-tab="syndicates"]');
    await expect(page.locator('#syndicates')).toBeVisible();

    await page.click('a[data-tab="missions"]');
    await expect(page.locator('#missions')).toBeVisible();
  });

  test('persists profile data in localStorage after EE.log auto-fetch', async ({ page }) => {
    await page.goto('/profile.php');

    await page.selectOption('#platform-select', 'pc');
    await page.click('button:has-text("Click Me")');
    await expect(page.locator('#step3-container')).toBeVisible();

    const eeLogPath = path.join(__dirname, '../../test/profile/EE.log');
    await page.setInputFiles('#ee-log-file', eeLogPath);

    // Wait for profile to load and localStorage to be written
    await expect(page.locator('#step3-container')).toHaveClass(/complete/, { timeout: 5000 });

    // Check localStorage has profile data and metadata
    const savedProfileData = await page.evaluate(() => localStorage.getItem('profile.data'));
    const platform = await page.evaluate(() => localStorage.getItem('profile.platform'));
    const accountId = await page.evaluate(() => localStorage.getItem('profile.accountId'));
    const dataFetchedAt = await page.evaluate(() => localStorage.getItem('profile.dataFetchedAt'));

    expect(savedProfileData).toBeTruthy();
    expect(platform).toBe('pc');
    expect(accountId).toBe('55540360384632532d7b23c6');
    expect(dataFetchedAt).toBeTruthy();

    // Reload page
    await page.reload();

    // Profile should auto-load from localStorage
    await expect(page.locator('#profile-nav')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#profile-name')).toContainText('AerodynamicHead');

    // Platform should be restored
    await expect(page.locator('#platform-select')).toHaveValue('pc');
  });

  test('auto-loads profile from localStorage on page load', async ({ page }) => {
    // First, set up localStorage with profile data
    await page.goto('/profile.php');
    await page.evaluate(() => {
      localStorage.setItem('profile.data', JSON.stringify({
        Results: [{
          DisplayName: 'TestUser',
          PlayerLevel: 30,
          AccountId: { $oid: '507f1f77bcf86cd799439011' }
        }]
      }));
    });

    // Reload to trigger auto-load
    await page.reload();

    // Wait for profile to load from localStorage
    await expect(page.locator('#profile-nav')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#profile-name')).toContainText('TestUser');

    // Steps 2 and 3 not complete (not completed via workflow)
    await expect(page.locator('#step2-container')).not.toHaveClass(/complete/);
    await expect(page.locator('#step3-container')).not.toHaveClass(/complete/);

    // Refresh alert should be hidden (no stored account ID)
    await expect(page.locator('#refresh-alert')).toBeHidden();
  });

  test('shows refresh alert when localStorage has account ID', async ({ page }) => {
    await page.goto('/profile.php');
    await page.evaluate(() => {
      localStorage.setItem('profile.platform', 'pc');
      localStorage.setItem('profile.accountId', '55540360384632532d7b23c6');
      localStorage.setItem('profile.data', JSON.stringify({
        Results: [{
          DisplayName: 'TestUser',
          PlayerLevel: 30,
          AccountId: { $oid: '55540360384632532d7b23c6' }
        }]
      }));
    });

    await page.reload();

    // Refresh alert should be visible
    await expect(page.locator('#refresh-alert')).toBeVisible();

    // Clicking Refresh Profile should re-fetch, update, and hide the alert
    await page.click('button:has-text("Refresh Profile")');
    await expect(page.locator('#profile-name')).toContainText('AerodynamicHead', { timeout: 5000 });
    await expect(page.locator('#step3-container')).toHaveClass(/complete/);
    await expect(page.locator('#refresh-alert')).toBeHidden();
  });

  test('shows error status when proxy fails', async ({ page }) => {
    // Override proxy mock to return an error
    await page.route(`**/${proxyHost}/profile*`, route => {
      route.fulfill({ status: 500, body: 'error' });
    });

    await page.goto('/profile.php');
    await page.selectOption('#platform-select', 'pc');
    await page.click('button:has-text("Click Me")');

    const eeLogPath = path.join(__dirname, '../../test/profile/EE.log');
    await page.setInputFiles('#ee-log-file', eeLogPath);

    // Wait for the fetch to fail (status message updates)
    await expect(page.locator('#status span')).toContainText('Failed to fetch', { timeout: 5000 });

    // Step 3 should not be complete
    await expect(page.locator('#step3-container')).not.toHaveClass(/complete/);
  });
});
