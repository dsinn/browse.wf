import {test, expect} from '@playwright/test';
import {setupMockRoutes} from '../helpers/api-mocks';

test.describe('Weekly Missions (/live)', () => {
	test.beforeEach(async ({page}) => {
		await setupMockRoutes(page);
		await page.goto('/live');
		await page.waitForSelector('#arby-what:not(:has-text("Loading..."))', {timeout: 10_000});
	});

	test('renders all six mission entries', async ({page}) => {
		const missions = ['clem', 'maroo', 'circuit-normal', 'circuit-sp', 'netracells', 'kahl'];
		for (const mission of missions) {
			await expect(page.locator(`[data-mission="${mission}"]`), mission).toBeVisible();
		}
	});

	test('card header shows expiry badge', async ({page}) => {
		await expect(page.locator('#circuit-header [data-expiry]')).toBeVisible();
	});

	test('Circuit frames are populated from worldState', async ({page}) => {
		const circuitFrames = page.locator('#circuit-frames');
		await expect(circuitFrames).toContainText('Nidus');
		await expect(circuitFrames).toContainText('Octavia');
		await expect(circuitFrames).toContainText('Harrow');
	});

	test('Circuit steel path weapons are populated from worldState', async ({page}) => {
		const circuitWeapons = page.locator('#circuit-weapons');
		await expect(circuitWeapons).toContainText('Braton');
		await expect(circuitWeapons).toContainText('Lato');
		await expect(circuitWeapons).toContainText('Skana');
		await expect(circuitWeapons).toContainText('Paris');
		await expect(circuitWeapons).toContainText('Kunai');
	});
});
