import {test, expect} from '@playwright/test';
import {setupMockRoutes, MOCK_TIMESTAMP} from '../helpers/api-mocks';
import {expiryBadge} from './helpers';

test.describe('Arbitration Card — frozen time', () => {
	test.beforeEach(async ({page}) => {
		await setupMockRoutes(page, {frozenTime: MOCK_TIMESTAMP});
		await page.goto('/live');
		await page.waitForSelector('#arby-what:not(:has-text("Loading..."))', {timeout: 10_000});
	});

	test('displays correct mission type, node, and tileset tooltip', async ({page}) => {
		await expect(page.locator('#arby-what')).toHaveText('Survival - Corpus');
		await expect(page.locator('#arby-where')).toContainText('Palus, Pluto');

		const abbr = page.locator('#arby-where abbr');
		await expect(abbr).toBeVisible();
		expect(await abbr.getAttribute('data-bs-title')).toBe('Corpus Ship');
	});
});

test.describe('Arbitration Card — expiry refresh', () => {
	const HOUR = 3_600_000;
	// The badge counts down to the top of the next hour
	const INITIAL_EXPIRY = (Math.trunc(MOCK_TIMESTAMP / HOUR) + 1) * HOUR;

	test.beforeEach(async ({page}) => {
		await setupMockRoutes(page, {frozenTime: MOCK_TIMESTAMP});
		await page.goto('/live');
		await page.waitForSelector('#arby-what:not(:has-text("Loading..."))', {timeout: 10_000});
	});

	test('moves on to the next hour when the clock passes the expiry', async ({page}) => {
		const badge = expiryBadge(page.locator('#arby-header'));
		await expect(badge).toHaveAttribute('data-expiry', String(INITIAL_EXPIRY));

		await page.clock.fastForward(INITIAL_EXPIRY - MOCK_TIMESTAMP + 1000);

		await expect(badge).toHaveAttribute('data-expiry', String(INITIAL_EXPIRY + HOUR));
		await expect(badge).not.toHaveText('Pending update');
	});

	test('catches up after the clock jumps several hours at once, like a device waking from sleep', async ({page}) => {
		await page.clock.fastForward((5 * HOUR) + 1000);

		await expect(expiryBadge(page.locator('#arby-header'))).toHaveAttribute('data-expiry', String(INITIAL_EXPIRY + (5 * HOUR)));
		await expect(page.locator('#arby-what')).not.toBeEmpty();
	});
});

test.describe('Arbitration Card — real time', () => {
	test.beforeEach(async ({page}) => {
		await setupMockRoutes(page, {freezeTime: false});
		await page.goto('/live');
		await page.waitForSelector('#arby-what:not(:has-text("Loading..."))', {timeout: 10_000});
	});

	test('renders mission type, node name, and tileset tooltip in expected format', async ({page}) => {
		// Content is time-dependent; only assert on structure/format
		await expect(page.locator('#arby-what')).not.toBeEmpty();

		const arbyWhere = page.locator('#arby-where');
		await expect(arbyWhere).toHaveText(/^@ .+, .+$/u);

		const abbr = arbyWhere.locator('abbr');
		await expect(abbr).toBeVisible();
		expect(await abbr.getAttribute('data-bs-title')).toBeTruthy();
	});
});
