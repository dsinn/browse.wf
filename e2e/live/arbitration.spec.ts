import {test, expect} from '@playwright/test';
import {setupMockRoutes, MOCK_TIMESTAMP} from '../helpers/api-mocks';

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
