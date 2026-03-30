import {test, expect} from '@playwright/test';
import {ENTRY_MAG_VOLT_EXCALIBUR} from '../test/invigorations/cache-fixtures';
import {setupMockRoutes} from './helpers/api-mocks';

/**
 * E2E tests for Invigorations Page (/invigorations.php)
 */

test.describe('Invigorations Page (/invigorations.php)', () => {
	// Freeze time at module load time (intentionally non-deterministic: different runs may land
	// on different weeks, providing coverage of week-boundary behaviour over time)
	const FROZEN_TIME = Date.now();
	let CURRENT_WEEK = 0;

	test.beforeEach(async ({page}) => {
		// Mock API responses for deterministic, fast, offline-capable tests
		// Freeze time to prevent flakiness on weekly boundaries
		await setupMockRoutes(page, {freezeTime: true, frozenTime: FROZEN_TIME});

		await page.goto('/invigorations');

		// Clear localStorage after page loads
		await page.evaluate(() => {
			localStorage.clear();
		});

		// Wait for warframe data to load (indicated by dropdown options being populated)
		await page.waitForFunction(() => {
			const select = document.querySelector('.suit-select');
			return select && (select as HTMLSelectElement).options.length > 1;
		}, {timeout: 30_000});

		// Derive CURRENT_WEEK from production code — if the offset formula changes, this follows automatically
		CURRENT_WEEK = await page.evaluate(() => (globalThis as any).getWeekIndex(Date.now()));
	});

	test('loads without JavaScript errors', async ({page}) => {
		const errors: string[] = [];
		page.on('pageerror', error => {
			errors.push(error.message);
		});
		page.on('console', message => {
			if (message.type() === 'error') {
				errors.push(message.text());
			}
		});

		// Warframe data already loaded in beforeEach
		expect(errors).toHaveLength(0);
	});

	test('displays form correctly without cache', async ({page}) => {
		await expect(page.locator('#username')).toBeVisible();
		await expect(page.locator('#peek')).toBeVisible();
		await expect(page.locator('.suit-select')).toHaveCount(3);
		await expect(page.locator('input[type="submit"]')).toBeVisible();
		await expect(page.locator('#results')).toHaveClass(/d-none/u);
		await expect(page.locator('#cache-alert')).toHaveClass(/d-none/u);
	});

	test('submitting form shows results and saves cache', async ({page}) => {
		await page.locator('#username').fill('TestUser');
		await page.locator('#peek').check();

		const selects = page.locator('.suit-select');
		await selects.nth(0).selectOption('/Lotus/Powersuits/Mag/MagBaseSuit');
		await selects.nth(1).selectOption('/Lotus/Powersuits/Volt/VoltBaseSuit');

		await page.route('**/oracle.browse.wf/invigorations*', route => {
			void route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(ENTRY_MAG_VOLT_EXCALIBUR.response),
			});
		});

		await page.locator('input[type="submit"]').click();
		await expect(page.locator('#results')).not.toHaveClass(/d-none/u);

		// Verify rendered content for all 3 suits — exercises the full invigorationNames lookup pipeline
		await expect(page.locator('#out-off-0')).toHaveText('+200% Ability Strength');
		await expect(page.locator('#out-def-0')).toHaveText('+1000 Health');
		await expect(page.locator('#out-off-1')).toHaveText('+100% Ability Range');
		await expect(page.locator('#out-def-1')).toHaveText('+1000 Armor');
		await expect(page.locator('#out-off-2')).toHaveText('+100% Ability Duration');
		await expect(page.locator('#out-def-2')).toHaveText('+200% Energy Max');

		const savedCache = await page.evaluate(() => {
			const raw = localStorage.getItem('invigorations.cache');
			return raw ? JSON.parse(raw) : null;
		});
		expect(savedCache).not.toBeNull();
	});

	test('loads cache and shows history with timer', async ({page}) => {
		await page.evaluate(cache => {
			localStorage.setItem('invigorations.cache', JSON.stringify(cache));
		}, {[CURRENT_WEEK]: ENTRY_MAG_VOLT_EXCALIBUR});

		await page.reload();
		await page.waitForFunction(() => {
			const select = document.querySelector('.suit-select');
			return select && (select as HTMLSelectElement).options.length > 1;
		}, {timeout: 30_000});

		await expect(page.locator('#cache-alert')).toBeVisible();
		await expect(page.locator('#history')).not.toHaveClass(/d-none/u);
		await expect(page.locator('#invigoration-timer')).toBeVisible();
	});

	test('inventory suppresses cache and shows inventory status', async ({page}) => {
		await page.evaluate(({inventory, cache}) => {
			localStorage.setItem('inventory', JSON.stringify(inventory));
			localStorage.setItem('invigorations.cache', JSON.stringify(cache));
		}, {
			inventory: {
				InfestedFoundry: {
					InvigorationIndex: CURRENT_WEEK,
					InvigorationSuitOfferings: [
						'/Lotus/Powersuits/Trinity/TrinityBaseSuit',
						'/Lotus/Powersuits/Nova/NovaBaseSuit',
						'/Lotus/Powersuits/Valkyr/ValkyrBaseSuit',
					],
				},
			},
			cache: {[CURRENT_WEEK]: ENTRY_MAG_VOLT_EXCALIBUR},
		});

		await page.reload();
		await page.waitForFunction(() => {
			const select = document.querySelector('.suit-select');
			return select && (select as HTMLSelectElement).options.length > 1;
		}, {timeout: 30_000});

		await expect(page.locator('#cache-alert')).toHaveClass(/d-none/u);
		await expect(page.locator('#inventory-status')).not.toHaveClass(/d-none/u);
	});
});
