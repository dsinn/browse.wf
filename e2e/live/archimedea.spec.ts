import {test, expect} from '@playwright/test';
import {setupMockRoutes} from '../helpers/api-mocks';
import {expiryBadge} from './helpers';

/**
 * Archimedea E2E Tests
 */

test.beforeEach(async ({page}) => {
	await setupMockRoutes(page);
	await page.goto('/live');
	// Wait for "Fetching data..." placeholder to be replaced by rendered tables
	await page.waitForSelector('#labConquest-body table', {timeout: 15_000});
	await page.waitForSelector('#hexConquest-body table', {timeout: 15_000});
});

test('Deep Archimedea card', async ({page}) => {
	const header = page.locator('#labConquest-header');
	await expect(header).toContainText('Deep Archimedea');
	await expect(expiryBadge(header)).toBeVisible();
	await expect(header.locator('.completion-check')).toBeVisible();

	const rows = page.locator('#labConquest-body tbody tr');
	await expect(rows).toHaveCount(3);

	const expectedMissions = [
		{type: 'Disruption', variant: 'Unified Purpose', conds: ['Myopic Munitions', 'Explosive Potential']},
		{type: 'Survival', variant: 'Parasitic Towers', conds: ['Postmortal Surges', 'Fortified Foes']},
		{type: 'Mirror Defense', variant: 'Eroding Senses', conds: ['Bolstered Belligerents', 'Devil\'s Bargain']},
	];
	for (const [i, {type, variant, conds}] of expectedMissions.entries()) {
		const row = rows.nth(i);
		await expect(row.locator('th')).toHaveText(type);
		const abbrs = row.locator('td abbr[data-bs-toggle=tooltip]');
		await expect(abbrs).toHaveCount(3);
		await expect(abbrs.nth(0)).toHaveText(variant);
		await expect(abbrs.nth(1)).toHaveText(conds[0]);
		await expect(abbrs.nth(2)).toHaveText(conds[1]);
	}

	const fvAbbrs = page.locator('#labConquest-body table:last-child td abbr[data-bs-toggle=tooltip]');
	await expect(fvAbbrs).toHaveCount(4);
	await expect(fvAbbrs.nth(0)).toHaveText('Lethargic Shields');
	await expect(fvAbbrs.nth(1)).toHaveText('Ammo Deficit');
	await expect(fvAbbrs.nth(2)).toHaveText('Powerless');
	await expect(fvAbbrs.nth(3)).toHaveText('Constricted');
});

test('Temporal Archimedea card', async ({page}) => {
	const header = page.locator('#hexConquest-header');
	await expect(header).not.toBeEmpty();
	await expect(expiryBadge(header)).toBeVisible();
	await expect(header.locator('.completion-check')).toBeVisible();

	const rows = page.locator('#hexConquest-body tbody tr');
	await expect(rows).toHaveCount(3);

	const expectedMissions = [
		{type: 'Exterminate', variant: 'Sealed Armor', conds: ['Balloonfest', 'Hostile Regeneration']},
		{type: 'Legacyte Harvest', variant: 'Parallel Evolution', conds: ['Foggy Fall', 'Miasmite Swarm']},
		{type: 'Defense', variant: 'Noise Suppression', conds: ['Vampyric Liminus', 'Myopic Munitions']},
	];
	for (const [i, {type, variant, conds}] of expectedMissions.entries()) {
		const row = rows.nth(i);
		await expect(row.locator('th')).toHaveText(type);
		const abbrs = row.locator('td abbr[data-bs-toggle=tooltip]');
		await expect(abbrs).toHaveCount(3);
		await expect(abbrs.nth(0)).toHaveText(variant);
		await expect(abbrs.nth(1)).toHaveText(conds[0]);
		await expect(abbrs.nth(2)).toHaveText(conds[1]);
	}

	const fvAbbrs = page.locator('#hexConquest-body table:last-child td abbr[data-bs-toggle=tooltip]');
	await expect(fvAbbrs).toHaveCount(4);
	await expect(fvAbbrs.nth(0)).toHaveText('Ability Overload');
	await expect(fvAbbrs.nth(1)).toHaveText('Dropped Guard');
	await expect(fvAbbrs.nth(2)).toHaveText('Untreatable');
	await expect(fvAbbrs.nth(3)).toHaveText('Transference Distortion');
});
