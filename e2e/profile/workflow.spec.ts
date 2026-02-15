import { test, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { setupMockRoutes } from '../helpers/api-mocks';

// ES module __dirname polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * E2E tests for Profile Viewer workflow
 *
 * Tests the happy path for uploading and viewing a profile through the step-by-step workflow.
 */

test.describe('Profile Workflow - Happy Path', () => {
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

    // Mock API responses for deterministic, fast, offline-capable tests
    await setupMockRoutes(page);
  });

  test('completes full workflow with EE.log upload', async ({ page }) => {
    await page.goto('/profile.php');

    // Step 1: Verify initial state - all steps show ❌
    await expect(page.locator('#step1-status')).toHaveText('❌');
    await expect(page.locator('#step2-status')).toHaveText('❌');

    // Step 1: Select platform
    await page.selectOption('#platform-select', 'pc');

    // Verify step 1 is complete
    await expect(page.locator('#step1-status')).toHaveText('✅');
    await expect(page.locator('#step2-status')).toHaveText('❌');

    // Step 2: Upload EE.log to extract account ID
    const eeLogPath = path.join(__dirname, '../../test/profile/EE.log');
    await page.setInputFiles('#ee-log-file', eeLogPath);

    // Wait for account ID to be extracted
    await expect(page.locator('#account-id')).toHaveValue('55540360384632532d7b23c6');

    // Verify step 2 is complete and input is valid
    await expect(page.locator('#step2-status')).toHaveText('✅');
    await expect(page.locator('#account-id')).toHaveClass(/is-valid/);

    // Step 3: Verify download link is updated
    await expect(page.locator('#step3-status')).toHaveText('❌');

    const downloadLink = page.locator('#download-link');
    await expect(downloadLink).toHaveAttribute('href', /55540360384632532d7b23c6/);

    // Step 4: Verify status shows ❌
    await expect(page.locator('#step4-status')).toHaveText('❌');

    // Upload profile JSON (getProfileViewingData.html is actually JSON, ignore extension)
    const profileJsonPath = path.join(__dirname, '../../test/profile/getProfileViewingData.html');
    await page.setInputFiles('#profile-file', profileJsonPath);

    // Wait for profile to load
    await expect(page.locator('#profile-nav')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#profile-name')).toContainText('AerodynamicHead');

    // Verify step 4 shows ✅ after successful upload
    await expect(page.locator('#step4-status')).toHaveText('✅');

    // Verify profile tabs are clickable
    await page.click('a[data-tab="syndicates"]');
    await expect(page.locator('#syndicates')).toBeVisible();

    await page.click('a[data-tab="missions"]');
    await expect(page.locator('#missions')).toBeVisible();

    // Check for no JavaScript errors
    const errors = await page.evaluate(() => (window as any).getErrors());
    expect(errors).toHaveLength(0);
  });

  test('completes workflow with manual account ID entry', async ({ page }) => {
    await page.goto('/profile.php');

    // Step 1: Select platform
    await page.selectOption('#platform-select', 'pc');
    await expect(page.locator('#step1-status')).toHaveText('✅');

    // Step 2: Enter account ID manually
    await page.fill('#account-id', '55540360384632532d7b23c6');

    // Verify validation and step completion
    await expect(page.locator('#account-id')).toHaveClass(/is-valid/);
    await expect(page.locator('#step2-status')).toHaveText('✅');

    // Step 3: Verify download link is updated with correct URL
    const downloadLink = page.locator('#download-link');
    await expect(downloadLink).toHaveAttribute('href', /content\.warframe\.com.*55540360384632532d7b23c6/);

    // Step 4: Upload profile JSON
    const profileJsonPath = path.join(__dirname, '../../test/profile/getProfileViewingData.html');
    await page.setInputFiles('#profile-file', profileJsonPath);

    // Verify profile loads
    await expect(page.locator('#profile-nav')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#profile-name')).toContainText('AerodynamicHead');

    // Verify step 4 shows ✅ after successful upload
    await expect(page.locator('#step4-status')).toHaveText('✅');

    // Check for no JavaScript errors
    const errors = await page.evaluate(() => (window as any).getErrors());
    expect(errors).toHaveLength(0);
  });

  test('validates account ID format and shows error for invalid input', async ({ page }) => {
    await page.goto('/profile.php');

    // Select platform
    await page.selectOption('#platform-select', 'pc');

    const errorMessage = page.locator('#account-id-error');

    // Error should be hidden initially
    await expect(errorMessage).toBeHidden();

    // Try invalid inputs
    const invalidInputs = [
      'PlayerName123',           // Username
      'player@example.com',      // Email
      '507F1F77BCF86CD799439011', // Uppercase
      'not-a-hex-string'         // Invalid characters
    ];

    for (const invalidInput of invalidInputs) {
      await page.fill('#account-id', invalidInput);

      // Should show invalid state and error message
      await expect(page.locator('#account-id')).toHaveClass(/is-invalid/);
      await expect(page.locator('#step2-status')).toHaveText('❌');
      await expect(errorMessage).toBeVisible();
    }

    // Enter valid account ID
    await page.fill('#account-id', '55540360384632532d7b23c6');

    // Should show valid state and hide error message
    await expect(page.locator('#account-id')).toHaveClass(/is-valid/);
    await expect(page.locator('#step2-status')).toHaveText('✅');
    await expect(errorMessage).toBeHidden();
  });

  test('persists profile data in localStorage when uploaded', async ({ page }) => {
    await page.goto('/profile.php');

    // Complete workflow steps 1-4
    await page.selectOption('#platform-select', 'pc');
    await page.fill('#account-id', '55540360384632532d7b23c6');
    await expect(page.locator('#account-id')).toHaveClass(/is-valid/);

    // Upload profile JSON (step 4 - this is what saves to localStorage)
    const profileJsonPath = path.join(__dirname, '../../test/profile/getProfileViewingData.html');
    await page.setInputFiles('#profile-file', profileJsonPath);

    // Wait for profile to load
    await expect(page.locator('#profile-nav')).toBeVisible({ timeout: 5000 });

    // Check localStorage has profile data and metadata
    const profileData = await page.evaluate(() => localStorage.getItem('profile.data'));
    const platform = await page.evaluate(() => localStorage.getItem('profile.platform'));
    const accountId = await page.evaluate(() => localStorage.getItem('profile.accountId'));
    const dataFetchedAt = await page.evaluate(() => localStorage.getItem('profile.dataFetchedAt'));

    expect(profileData).toBeTruthy(); // Profile JSON is saved
    expect(platform).toBe('pc'); // Platform is saved
    expect(accountId).toBe('55540360384632532d7b23c6'); // Account ID is saved
    expect(dataFetchedAt).toBeTruthy(); // Timestamp is saved

    // Reload page
    await page.reload();

    // Profile should auto-load from localStorage
    await expect(page.locator('#profile-nav')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#profile-name')).toContainText('AerodynamicHead');

    // Form fields should be restored
    await expect(page.locator('#platform-select')).toHaveValue('pc');
    await expect(page.locator('#account-id')).toHaveValue('55540360384632532d7b23c6');
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

    // Verify steps 3 and 4 still show ❌ (not completed via workflow)
    await expect(page.locator('#step3-status')).toHaveText('❌');
    await expect(page.locator('#step4-status')).toHaveText('❌');

    // Check for no JavaScript errors
    const errors = await page.evaluate(() => (window as any).getErrors());
    expect(errors).toHaveLength(0);
  });

  test('shows warning when user left-clicks download link', async ({ page }) => {
    await page.goto('/profile.php');

    // Complete steps 1 and 2
    await page.selectOption('#platform-select', 'pc');
    await page.fill('#account-id', '55540360384632532d7b23c6');

    const downloadLink = page.locator('#download-link');
    const warning = page.locator('#download-warning');

    // Warning should be hidden initially
    await expect(warning).toBeHidden();

    // Left-click the link
    await downloadLink.click();

    // Warning should appear
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('Please right-click');

    // Simulate right-click to dismiss warning
    await downloadLink.click({ button: 'right' });

    // Warning should be hidden
    await expect(warning).toBeHidden();

    // Step 3 indicator should be cleared (blank)
    await expect(page.locator('#step3-status')).toHaveText('');
  });
});
