import {test, expect} from '@playwright/test';
import {setupMockRoutes} from './helpers/api-mocks';

// Matches worldState-alerts-moonflesh.json's "Time" field (all five alerts and both goals are active)
const MOONFLESH_FROZEN_TIMESTAMP = 1_793_503_000_000;

test.describe('Item name fallback - Live alerts card', () => {
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
		// The three Road to Tau alerts expire first; the two gift alerts follow
		const rewardLines = page.locator('#alerts-body .alert-rewards');
		await expect(rewardLines.filter({hasText: '17,000 Credits'})).toHaveText(Array.from({length: 3}, () => '50X Moonflesh, 17,000 Credits'));

		await expect(page.locator('#alerts-body')).not.toContainText('RoadToTauEventResource');
		expect(itemDataRequested).toBe(false);
	});
});

test.describe('Translation fallback - Live events card', () => {
	test('event names missing from the Oracle dict use the fallback translations', async ({page}) => {
		await setupMockRoutes(page, {worldStateFile: 'worldState-alerts-moonflesh.json', frozenTime: MOONFLESH_FROZEN_TIMESTAMP});

		await page.goto('/live');

		await expect(page.locator('#goals-body')).toHaveText('Hallowed Nightmares, Epoch Operation: Taubound');
	});
});
