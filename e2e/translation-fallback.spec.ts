import {test, expect} from '@playwright/test';
import {setupMockRoutes} from './helpers/api-mocks';

test.describe('Item name fallback - Live alerts card', () => {
	// Matches worldState-alerts-moonflesh.json's "Time" field (all five alerts are active)
	const MOONFLESH_FROZEN_TIMESTAMP = 1_793_503_000_000;

	let itemDataRequested: boolean;

	test.beforeEach(async ({page}) => {
		itemDataRequested = false;
		await setupMockRoutes(page, {worldStateFile: 'worldState-alerts-moonflesh.json', frozenTime: MOONFLESH_FROZEN_TIMESTAMP});
		// Mirror production (browse.wf 404s for this resource), but the fallback should make the request unnecessary
		await page.route('**/browse.wf/Lotus/Types/Gameplay/Events/RoadToTauEvent/RoadToTauEventResource', route => {
			itemDataRequested = true;
			void route.fulfill({status: 404, contentType: 'text/html', body: 'Not Found'});
		});

		await page.goto('/live');
		await page.waitForSelector('#alerts-body .card-block', {timeout: 10_000});
	});

	test('Road to Tau alert rewards show "Moonflesh" even though item data 404s', async ({page}) => {
		const tauBlocks = page.locator('#alerts-body .card-block').filter({hasText: '17,000 Credits'});
		await expect(tauBlocks).toHaveCount(3);
		for (const block of await tauBlocks.all()) {
			await expect(block).toContainText('50X Moonflesh');
		}

		await expect(page.locator('#alerts-body')).not.toContainText('RoadToTauEventResource');
		expect(itemDataRequested).toBe(false);
	});
});
