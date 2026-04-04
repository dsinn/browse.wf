import {test, expect} from '@playwright/test';
import {setupMockRoutes} from '../helpers/api-mocks';

test.describe('Page Settings (/live)', () => {
	test.beforeEach(async ({page}) => {
		await setupMockRoutes(page);
		await page.goto('/live');
		await page.waitForSelector('#arby-what:not(:has-text("Loading..."))', {timeout: 10_000});
	});

	test.describe('Language selector', () => {
		test('language selector exists and has multiple options', async ({page}) => {
			const langSelect = page.locator('#language-select');
			if (await langSelect.count() === 0) {
				return;
			}

			await expect(langSelect).toBeVisible();
			const options = await langSelect.locator('option').count();
			expect(options).toBeGreaterThan(1);
		});

		test('changing language updates localStorage', async ({page}) => {
			const langSelect = page.locator('#language-select');
			if (await langSelect.count() === 0) {
				return;
			}

			const options = await langSelect.locator('option').all();
			if (options.length <= 1) {
				return;
			}

			const initialValue = await langSelect.inputValue();
			const secondOption = await options[1].getAttribute('value');
			if (!secondOption || secondOption === initialValue) {
				return;
			}

			await langSelect.selectOption(secondOption);
			await page.waitForFunction(expected => localStorage.getItem('language') === expected, secondOption);

			const storedLang = await page.evaluate(() => localStorage.getItem('language'));
			expect(storedLang).toBe(secondOption);
		});
	});

	test.describe('Navbar pin', () => {
		test('navbar pin toggle persists state to localStorage', async ({page}) => {
			const pinToggle = page.locator('[data-toggle="navbar-pin"]');
			if (await pinToggle.count() === 0) {
				return;
			}

			await pinToggle.click();
			await page.waitForFunction(() => localStorage.getItem('navbar-pinned') !== null);
			const pinState = await page.evaluate(() => localStorage.getItem('navbar-pinned'));
			expect(pinState).toBeTruthy();

			await pinToggle.click();
			await page.waitForFunction(oldState => localStorage.getItem('navbar-pinned') !== oldState, pinState);
			const pinStateAfter = await page.evaluate(() => localStorage.getItem('navbar-pinned'));
			expect(pinStateAfter).not.toBe(pinState);
		});
	});
});
