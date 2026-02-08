import { test, expect } from '@playwright/test';
import { setupMockRoutes } from '../helpers/api-mocks';

// Regex pattern for validating "NodeName, SystemName" format
// Handles multi-word locations (e.g., "Kuva Fortress", "Plains of Eidolon")
const LOCATION_FORMAT = /^[^,]+, [^,]+$/;

test.describe('Live Page - Sortie Card', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses for deterministic, fast, offline-capable tests
    await setupMockRoutes(page);

    await page.goto('/live.php');
    // Wait for initial data to load
    await page.waitForSelector('#arby-what:not(:has-text("Loading..."))', { timeout: 10000 });
  });

  test('renders sortie missions with three rows', async ({ page }) => {
    // Wait for sortie table to render
    await page.waitForSelector('#sortie-table tbody tr', { timeout: 10000 });

    // Should have exactly 3 mission rows (sortie always has 3 missions)
    const missions = await page.locator('#sortie-table tbody tr').count();
    expect(missions).toBe(3);
  });

  test('displays mission type and modifier in first and second columns', async ({ page }) => {
    await page.waitForSelector('#sortie-table tbody tr', { timeout: 10000 });

    // Check first mission row (MT_EXTERMINATION with SORTIE_MODIFIER_LOW_ENERGY)
    const firstRow = page.locator('#sortie-table tbody tr').nth(0);
    const firstMissionType = await firstRow.locator('th').textContent();
    const firstModifier = await firstRow.locator('td').textContent();

    expect(firstMissionType).toContain('Exterminate');
    expect(firstModifier).toContain('Energy Reduction');
  });

  test('displays tileset as tooltip on location', async ({ page }) => {
    await page.waitForSelector('#sortie-table tbody tr', { timeout: 10000 });

    // Check first mission (OrokinMoonTilesetGrineer)
    const firstRow = page.locator('#sortie-table tbody tr').nth(0);
    const locationSpan = firstRow.locator('td span[data-bs-toggle="tooltip"]');

    // Should have tooltip attribute
    await expect(locationSpan).toHaveAttribute('data-bs-toggle', 'tooltip');

    // Tooltip should show formatted tileset: OrokinMoonTilesetGrineer → "Orokin Moon Grineer"
    const tooltipTitle = await locationSpan.getAttribute('data-bs-title');
    expect(tooltipTitle).toBe('Orokin Moon Grineer');
  });

  test('formats tileset correctly for different tilesets', async ({ page }) => {
    await page.waitForSelector('#sortie-table tbody tr', { timeout: 10000 });

    // Check second mission: GrineerOceanTileset → "Grineer Ocean"
    const secondRow = page.locator('#sortie-table tbody tr').nth(1);
    const locationSpan2 = secondRow.locator('td span[data-bs-toggle="tooltip"]');
    const tooltipTitle2 = await locationSpan2.getAttribute('data-bs-title');
    expect(tooltipTitle2).toBe('Grineer Ocean');

    // Check third mission: GrineerGalleonTileset → "Grineer Galleon"
    const thirdRow = page.locator('#sortie-table tbody tr').nth(2);
    const locationSpan3 = thirdRow.locator('td span[data-bs-toggle="tooltip"]');
    const tooltipTitle3 = await locationSpan3.getAttribute('data-bs-title');
    expect(tooltipTitle3).toBe('Grineer Galleon');
  });

  test('displays all three sortie missions with correct data', async ({ page }) => {
    await page.waitForSelector('#sortie-table tbody tr', { timeout: 10000 });

    // Mission 1: Exterminate - Energy Reduction @ Tycho, Lua (OrokinMoonTilesetGrineer)
    const row1 = page.locator('#sortie-table tbody tr').nth(0);
    await expect(row1.locator('th')).toContainText('Exterminate');
    await expect(row1.locator('td')).toContainText('Energy Reduction');
    const location1 = await row1.locator('td span[data-bs-toggle="tooltip"]').textContent();
    expect(location1).toMatch(LOCATION_FORMAT);

    // Mission 2: Rescue - Radiation Hazard @ Stephano, Uranus (GrineerOceanTileset)
    const row2 = page.locator('#sortie-table tbody tr').nth(1);
    await expect(row2.locator('th')).toContainText('Rescue');
    await expect(row2.locator('td')).toContainText('Radiation Hazard');
    const location2 = await row2.locator('td span[data-bs-toggle="tooltip"]').textContent();
    expect(location2).toMatch(LOCATION_FORMAT);

    // Mission 3: Assassination - Eximus Stronghold @ Tethys, Saturn (GrineerGalleonTileset)
    const row3 = page.locator('#sortie-table tbody tr').nth(2);
    await expect(row3.locator('th')).toContainText('Assassination');
    await expect(row3.locator('td')).toContainText('Eximus Stronghold');
    const location3 = await row3.locator('td span[data-bs-toggle="tooltip"]').textContent();
    expect(location3).toMatch(LOCATION_FORMAT);
  });

  test('sortie header displays expiry badge and completion toggle', async ({ page }) => {
    await page.waitForSelector('#sortie-header', { timeout: 10000 });

    // Should have expiry badge
    const expiryBadge = page.locator('#sortie-header span.badge[data-expiry]');
    await expect(expiryBadge).toBeVisible();

    // Should have completion toggle checkbox
    const completionToggle = page.locator('#sortie-header a.completion-check');
    await expect(completionToggle).toBeVisible();
  });
});
