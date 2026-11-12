import {test, expect} from '@playwright/test';
import {setupMockRoutes} from '../helpers/api-mocks';

// Matches worldState-alerts.json's "Time" field (2026-01-11 13:40:00 UTC).
// Alerts expire at +5s (Alpha), +100s (Beta), +200s (Gamma) relative to this timestamp.
const ALERTS_FROZEN_TIMESTAMP = 1_768_140_000_000;

test.describe('Live Page - Alerts Card', () => {
	test.beforeEach(async ({page}) => {
		await setupMockRoutes(page, {worldStateFile: 'worldState-alerts.json', frozenTime: ALERTS_FROZEN_TIMESTAMP});
		await page.goto('/live');
		await page.waitForSelector('#alerts-body .card-block', {timeout: 10_000});
	});

	test('alert location has tileset tooltip', async ({page}) => {
		const blocks = page.locator('#alerts-body .card-block');
		const count = await blocks.count();
		expect(count).toBeGreaterThan(0);

		for (let i = 0; i < count; i++) {
			const abbr = blocks.nth(i).locator('abbr[data-bs-toggle="tooltip"]');
			await expect(abbr).toBeVisible();
			const title = await abbr.getAttribute('data-bs-title');
			expect(title).toBeTruthy();

			// Hovering must actually surface the tooltip popup — asserting only the data-bs-title
			// attribute would pass even if the live Bootstrap Tooltip instance was destroyed by a
			// later innerHTML+= reparse of an ancestor element.
			await abbr.hover();
			await expect(page.locator('.tooltip').filter({hasText: title!})).toBeVisible();
			await page.mouse.move(0, 0);
		}
	});

	test('alerts are sorted by ascending expiry', async ({page}) => {
		const blocks = page.locator('#alerts-body .card-block');
		await expect(blocks).toHaveCount(3);

		const expiries = await blocks.locator('.badge[data-expiry]').all();
		const values = await Promise.all(expiries.map(async badge => Number(await badge.getAttribute('data-expiry'))));

		expect(values).toEqual([...values].sort((a, b) => a - b));
	});

	test('credits-only reward is a single line without stray delimiters', async ({page}) => {
		const rewardLines = page.locator('#alerts-body .alert-rewards');
		await expect(rewardLines).toHaveCount(3);
		for (const line of await rewardLines.all()) {
			await expect(line).toHaveText(/^[\d,]+ Credits$/u);
		}
	});

	test('expired alert is removed from the DOM ~60 seconds after expiry', async ({page}) => {
		await expect(page.locator('#alerts-body .card-block')).toHaveCount(3);

		// Alpha expires at +5s; jump the frozen clock 65s ahead to clear its 60s grace period
		// and let the queued setTimeout fire, without reloading or re-polling worldState.
		await page.clock.fastForward(65_000);

		await expect(page.locator('#alerts-body .card-block')).toHaveCount(2);
	});
});

test.describe('Live Page - Alerts Card rewards', () => {
	// Matches worldState-alerts-moonflesh.json's "Time" field (all five alerts are active)
	const MULTI_REWARD_FROZEN_TIMESTAMP = 1_793_503_000_000;

	test.beforeEach(async ({page}) => {
		await setupMockRoutes(page, {worldStateFile: 'worldState-alerts-moonflesh.json', frozenTime: MULTI_REWARD_FROZEN_TIMESTAMP});
		// Plain items (as opposed to the fallback-named Moonflesh) so the lists have mixed kinds
		for (const [itemPath, name] of [
			['Types/Items/MiscItems/Kuva', 'Kuva'],
			['Upgrades/Mods/Randomized/RawRifleRandomMod', 'Rifle Riven Mod'],
		]) {
			await page.route(`**/browse.wf/Lotus/${itemPath}`, route => {
				void route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({name})});
			});
		}

		await page.goto('/live');
		await page.waitForSelector('#alerts-body .card-block', {timeout: 10_000});
	});

	test('rewards are a single comma-delimited line with Credits last', async ({page}) => {
		const rewardLines = page.locator('#alerts-body .alert-rewards');
		// Alerts are sorted by ascending expiry
		await expect(rewardLines).toHaveText([
			'50X Moonflesh, 17,000 Credits',
			'50X Moonflesh, 17,000 Credits',
			'50X Moonflesh, 17,000 Credits',
			'Rifle Riven Mod, 10,000 Credits', // Items
			'500000X Kuva, 10,000 Credits', // Counted items
		]);
	});
});
