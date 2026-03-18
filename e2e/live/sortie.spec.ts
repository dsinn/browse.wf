import {test, expect} from '@playwright/test';
import {setupMockRoutes} from '../helpers/api-mocks';
import {expiryBadge} from './helpers';

// Regex pattern for validating "NodeName, SystemName" format
// Handles multi-word locations (e.g., "Kuva Fortress", "Plains of Eidolon")
const LOCATION_FORMAT = /^[^,]+, [^,]+$/u;

test.describe('Live Page - Sortie Card', () => {
	test.beforeEach(async ({page}) => {
		// Mock API responses for deterministic, fast, offline-capable tests
		await setupMockRoutes(page);

		await page.goto('/live.php');
		// Wait for initial data to load
		await page.waitForSelector('#arby-what:not(:has-text("Loading..."))', {timeout: 10_000});
	});

	test('renders sortie missions with three rows', async ({page}) => {
		// Wait for sortie table to render
		await page.waitForSelector('#sortie-table tbody tr', {timeout: 10_000});

		// Should have exactly 3 mission rows (sortie always has 3 missions)
		const missions = await page.locator('#sortie-table tbody tr').count();
		expect(missions).toBe(3);
	});

	test('displays mission type and modifier in first and second columns', async ({page}) => {
		await page.waitForSelector('#sortie-table tbody tr', {timeout: 10_000});

		// Check first mission row (MT_EXTERMINATION with SORTIE_MODIFIER_LOW_ENERGY)
		const firstRow = page.locator('#sortie-table tbody tr').nth(0);
		const firstMissionType = await firstRow.locator('th').textContent();
		const firstModifier = await firstRow.locator('td').textContent();

		expect(firstMissionType).toContain('Exterminate');
		expect(firstModifier).toContain('Energy Reduction');
	});

	test('displays tileset as tooltip on location', async ({page}) => {
		await page.waitForSelector('#sortie-table tbody tr', {timeout: 10_000});

		// Check first mission (OrokinMoonTilesetGrineer → "Orokin Moon Grineer")
		const firstRow = page.locator('#sortie-table tbody tr').nth(0);
		const locationElement = firstRow.locator('td [data-bs-toggle="tooltip"]');
		await expect(locationElement).toHaveAttribute('data-bs-title', 'Orokin Moon Grineer');
	});

	test('formats tileset correctly for different tilesets', async ({page}) => {
		await page.waitForSelector('#sortie-table tbody tr', {timeout: 10_000});

		// Check second mission: GrineerOceanTileset → "Grineer Ocean"
		const tooltipTitle2 = await page.locator('#sortie-table tbody tr').nth(1).locator('td [data-bs-toggle="tooltip"]').getAttribute('data-bs-title');
		expect(tooltipTitle2).toBe('Grineer Ocean');

		// Check third mission: GrineerGalleonTileset → "Grineer Galleon"
		const tooltipTitle3 = await page.locator('#sortie-table tbody tr').nth(2).locator('td [data-bs-toggle="tooltip"]').getAttribute('data-bs-title');
		expect(tooltipTitle3).toBe('Grineer Galleon');
	});

	test('displays all three sortie missions with correct data', async ({page}) => {
		await page.waitForSelector('#sortie-table tbody tr', {timeout: 10_000});

		// Mission 1: Exterminate - Energy Reduction @ Tycho, Lua (OrokinMoonTilesetGrineer)
		const row1 = page.locator('#sortie-table tbody tr').nth(0);
		await expect(row1.locator('th')).toContainText('Exterminate');
		await expect(row1.locator('td')).toContainText('Energy Reduction');
		const location1 = await row1.locator('td [data-bs-toggle="tooltip"]').textContent();
		expect(location1).toMatch(LOCATION_FORMAT);

		// Mission 2: Rescue - Radiation Hazard @ Stephano, Uranus (GrineerOceanTileset)
		const row2 = page.locator('#sortie-table tbody tr').nth(1);
		await expect(row2.locator('th')).toContainText('Rescue');
		await expect(row2.locator('td')).toContainText('Radiation Hazard');
		const location2 = await row2.locator('td [data-bs-toggle="tooltip"]').textContent();
		expect(location2).toMatch(LOCATION_FORMAT);

		// Mission 3: Assassination - Eximus Stronghold @ Tethys, Saturn (GrineerGalleonTileset)
		const row3 = page.locator('#sortie-table tbody tr').nth(2);
		await expect(row3.locator('th')).toContainText('Assassination');
		await expect(row3.locator('td')).toContainText('Eximus Stronghold');
		const location3 = await row3.locator('td [data-bs-toggle="tooltip"]').textContent();
		expect(location3).toMatch(LOCATION_FORMAT);
	});

	test('sortie header displays expiry badge and completion toggle', async ({page}) => {
		await page.waitForSelector('#sortie-header', {timeout: 10_000});

		await expect(expiryBadge(page.locator('#sortie-header'))).toBeVisible();

		// Should have completion toggle checkbox
		const completionToggle = page.locator('#sortie-header a.completion-check');
		await expect(completionToggle).toBeVisible();
	});
});
