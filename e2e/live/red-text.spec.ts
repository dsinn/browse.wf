import {test, expect} from '@playwright/test';
import {setupMockRoutes} from '../helpers/api-mocks';

const COLLAPSE_KEY = 'live.collapse.red-text';

test.describe('Red Text Card (/live)', () => {
	test.beforeEach(async ({page}) => {
		await setupMockRoutes(page);
		await page.goto('/live');
		await page.waitForSelector('#red-text-body p', {timeout: 10_000});
	});

	test('WALLOPS prefix is stripped from message text', async ({page}) => {
		const bodyText = await page.locator('#red-text-body').textContent();
		expect(bodyText).not.toContain('WALLOPS');
	});

	test.describe('Collapse behaviour', () => {
		test('collapse state persists after reload', async ({page}) => {
			const toggle = page.locator('[data-collapse-toggle="red-text"]');
			await toggle.click();
			await expect(page.locator('#red-text-body')).toBeHidden();

			await page.reload();
			await page.waitForSelector('[data-collapse-toggle="red-text"]:not(:empty)', {timeout: 10_000});

			await expect(page.locator('#red-text-body')).toBeHidden();
		});
	});

	test.describe('API optimization', () => {
		test('fetches redtext.json on page load when card is expanded', async ({page}) => {
			const redtextRequestPromise = page.waitForRequest(
				request => request.url().includes('redtext.json'),
				{timeout: 10_000},
			);

			await page.reload();
			expect(await redtextRequestPromise).toBeTruthy();
		});

		test('skips fetch when card is collapsed on load', async ({page}) => {
			const redtextRequestPromise = page.waitForRequest(
				request => request.url().includes('redtext.json'),
				{timeout: 5000},
			).catch(() => null);

			await page.evaluate(key => {
				localStorage.setItem(key, '1');
			}, COLLAPSE_KEY);
			await page.reload();
			await page.waitForSelector('[data-collapse-toggle="red-text"]:not(:empty)', {timeout: 10_000});

			expect(await redtextRequestPromise).toBeNull();
		});

		test('expanding a collapsed card triggers fetch', async ({page}) => {
			await page.evaluate(key => {
				localStorage.setItem(key, '1');
			}, COLLAPSE_KEY);

			const redtextRequestPromise = page.waitForRequest(
				request => request.url().includes('redtext.json'),
				{timeout: 5000},
			).catch(() => null);

			await page.reload();
			await page.waitForSelector('[data-collapse-toggle="red-text"]:not(:empty)', {timeout: 10_000});

			expect(await redtextRequestPromise).toBeNull();

			const redtextRequestAfterExpandPromise = page.waitForRequest(
				request => request.url().includes('redtext.json'),
				{timeout: 5000},
			);
			await page.locator('[data-collapse-toggle="red-text"]').click();

			expect(await redtextRequestAfterExpandPromise).toBeTruthy();
		});
	});
});
