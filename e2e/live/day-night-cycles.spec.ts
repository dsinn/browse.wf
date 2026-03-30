import {test, expect} from '@playwright/test';
import {setupMockRoutes} from '../helpers/api-mocks';
import {expiryBadge} from './helpers';

// At MOCK_TIMESTAMP (1768087200000 = 2026-01-10T23:20:00Z):
//   - Plains of Eidolon / Cambion Drift: Day / Fass
//     bountyCycleExpiry = 1768100622118 (2026-01-11T03:03:42Z)
//     night starts at bountyCycleExpiry - 3_000_000 = 1768097622118 (2026-01-11T02:13:42Z)
//     1768087200000 < 1768097622118 → Day / Fass
//   - Orb Vallis: Cold
//     EPOCH = Nov 10 2018 08:13:48 UTC
//     cycle math: at MOCK_TIMESTAMP, we are past cycleColdStart → Cold
//   - Duviri: Joy (mood index 2)
//     Math.trunc(1768087200000 / 7200000) % 5 = 2 → Joy
const MOCK_TIMESTAMP = 1_768_087_200_000; // 2026-01-10T23:20:00Z

// At NIGHTTIME_TIMESTAMP (1768099122118 = 2026-01-11T02:38:42Z):
//   - Plains of Eidolon / Cambion Drift: Night / Vome
//     Within the night window (02:13:42Z – 03:03:42Z), bounty-cycle not yet stale
const NIGHTTIME_TIMESTAMP = 1_768_099_122_118; // 2026-01-11T02:38:42Z

test.describe('Day/Night Cycles', () => {
	test('daytime: POE shows Day with expiry badge, Cambion Drift shows Fass', async ({page}) => {
		await setupMockRoutes(page, {frozenTime: MOCK_TIMESTAMP});
		await page.goto('/live');
		await page.waitForSelector('#poe:not(:has-text("Fetching data..."))', {timeout: 10_000});

		await expect(page.locator('#poe')).toHaveText(/^☀️ Day/u);
		await expect(expiryBadge(page.locator('#poe'))).toBeVisible();
		await expect(page.locator('#deimos')).toHaveText(/^☀️ Fass/u);
	});

	test('nighttime: POE shows Night, Cambion Drift shows Vome', async ({page}) => {
		await setupMockRoutes(page, {frozenTime: NIGHTTIME_TIMESTAMP});
		await page.goto('/live');
		await page.waitForSelector('#poe:not(:has-text("Fetching data..."))', {timeout: 10_000});

		await expect(page.locator('#poe')).toHaveText(/^🌑 Night/u);
		await expect(page.locator('#deimos')).toHaveText(/^🌑 Vome/u);
	});

	test('Orb Vallis shows cycle state with expiry badge', async ({page}) => {
		await setupMockRoutes(page, {frozenTime: MOCK_TIMESTAMP});
		await page.goto('/live');
		await page.waitForSelector('#vallis:not(:has-text("Fetching data..."))', {timeout: 10_000});

		await expect(page.locator('#vallis')).toHaveText(/^(?:❄️ Cold|☀️ Warm)/u);
		await expect(expiryBadge(page.locator('#vallis'))).toBeVisible();
	});

	test('Duviri shows a named mood with expiry badge', async ({page}) => {
		await setupMockRoutes(page, {frozenTime: MOCK_TIMESTAMP});
		await page.goto('/live');
		await page.waitForSelector('#duviri:not(:has-text("Fetching data..."))', {timeout: 10_000});

		await expect(page.locator('#duviri')).toHaveText(/^(?:Sorrow|Fear|Joy|Anger|Envy)/u);
		await expect(expiryBadge(page.locator('#duviri'))).toBeVisible();
	});
});
