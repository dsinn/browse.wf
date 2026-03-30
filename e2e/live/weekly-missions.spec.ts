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

	test('circuit frames are populated from dict', async ({page}) => {
		// Circuit-frames is filled by updateCircuitLocalised with frame names from dict
		const circuitFrames = page.locator('#circuit-frames');
		await expect(circuitFrames).not.toBeEmpty();
		await expect(circuitFrames).not.toHaveText('Loading...');
	});
});
