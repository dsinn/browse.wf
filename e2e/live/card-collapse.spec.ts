import {test, expect} from '@playwright/test';
import {setupMockRoutes} from '../helpers/api-mocks';

test.describe('Card Collapse (/live)', () => {
	test.beforeEach(async ({page}) => {
		await setupMockRoutes(page);
		await page.goto('/live');
		await page.waitForSelector('#arby-what:not(:has-text("Loading..."))', {timeout: 10_000});
	});

	test('clicking collapse toggle hides card content', async ({page}) => {
		const newsToggle = page.locator('[data-collapse-toggle="news"]');
		const newsBody = page.locator('#news-body');

		await expect(newsBody).toBeVisible();
		await newsToggle.click();
		await expect(newsBody).toBeHidden();
		await expect(newsToggle).toHaveClass(/engaged/u);
	});

	test('clicking collapsed card expands it again', async ({page}) => {
		const newsToggle = page.locator('[data-collapse-toggle="news"]');
		const newsBody = page.locator('#news-body');

		await newsToggle.click();
		await expect(newsBody).toBeHidden();
		await expect(newsToggle).toHaveClass(/engaged/u);

		await newsToggle.click();
		await expect(newsBody).toBeVisible();
		await expect(newsToggle).not.toHaveClass(/engaged/u);
	});
});
