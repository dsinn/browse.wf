import {test, expect, Page} from '@playwright/test';
import {setupMockRoutes} from './helpers/api-mocks';

test.describe('Live Page (/live)', () => {
	test.beforeEach(async ({page}) => {
		// Mock API responses for deterministic, fast, offline-capable tests
		await setupMockRoutes(page);

		await page.goto('/live');
		// Wait for initial data to load (arbitration card loads quickly)
		await page.waitForSelector('#arby-what:not(:has-text("Loading..."))', {timeout: 10_000});
	});

	test.describe('Page loads correctly', () => {
		test('displays the main card headers', async ({page}) => {
			// Check that major card headers are present (using IDs for reliability)
			await expect(page.locator('#arby-header')).toBeVisible();
			await expect(page.locator('#sortie-header')).toBeVisible();
			await expect(page.locator('#darvo-header')).toBeVisible();
		});

		test('loads game data from API', async ({page}) => {
			// Check that arbitration data loaded
			const arbyWhat = await page.locator('#arby-what').textContent();
			expect(arbyWhat).not.toBe('Loading...');
			expect(arbyWhat).toBeTruthy();
		});
	});

	test.describe('Card collapse functionality', () => {
		test('clicking collapse toggle hides card content', async ({page}) => {
			// Find the News card collapse toggle
			const newsToggle = page.locator('[data-collapse-toggle="news"]');
			const newsBody = page.locator('#news-body');

			// Verify card body is initially visible
			await expect(newsBody).toBeVisible();

			// Click collapse toggle
			await newsToggle.click();

			// Verify card body is now hidden (auto-retries)
			await expect(newsBody).toBeHidden();

			// Verify toggle has engaged class
			await expect(newsToggle).toHaveClass(/engaged/u);
		});

		test('clicking collapsed card expands it again', async ({page}) => {
			const newsToggle = page.locator('[data-collapse-toggle="news"]');
			const newsBody = page.locator('#news-body');

			// Collapse the card
			await newsToggle.click();
			await expect(newsBody).toBeHidden();
			await expect(newsToggle).toHaveClass(/engaged/u);

			// Expand it again
			await newsToggle.click();
			await expect(newsBody).toBeVisible();
			await expect(newsToggle).not.toHaveClass(/engaged/u);
		});
	});

	test.describe('Notification toggles', () => {
		test('clicking notification toggle changes icon state', async ({page}) => {
			// Find a notification toggle (e.g., News)
			const newsNotifToggle = page.locator('[data-notif-toggle="news"]');

			// Wait for notification icon to be initialized
			await page.waitForSelector('[data-notif-toggle="news"] span', {timeout: 5000});

			// Get initial bell state
			const initialSpan = newsNotifToggle.locator('span');
			const initialClass = await initialSpan.getAttribute('class');

			// Click to toggle
			await newsNotifToggle.click();

			// Wait for class to change
			await expect(initialSpan).not.toHaveAttribute('class', initialClass || '');

			// Verify class changed
			const newClass = await initialSpan.getAttribute('class');
			expect(newClass).not.toBe(initialClass);

			// Should be either enabled or disabled
			expect(newClass === 'notif-bell-enabled' || newClass === 'notif-bell-disabled').toBe(true);
		});

		test('notification preferences persist in localStorage', async ({page}) => {
			const darvoNotifToggle = page.locator('[data-notif-toggle="darvo"]');

			// Wait for initialization
			await page.waitForSelector('[data-notif-toggle="darvo"] span', {timeout: 5000});

			// Toggle notification
			await darvoNotifToggle.click();

			// Wait for localStorage to be set
			await page.waitForFunction(() => localStorage.getItem('live.notif.darvo') !== null);

			// Check localStorage (note: keys are prefixed with "live.notif.")
			const notifState = await page.evaluate(() => localStorage.getItem('live.notif.darvo'));

			expect(notifState).toBeTruthy();

			// Reload page
			await page.reload();
			await page.waitForSelector('#arby-what:not(:has-text("Loading..."))', {timeout: 10_000});
			await page.waitForSelector('[data-notif-toggle="darvo"] span', {timeout: 5000});

			// Verify state persisted
			const stateAfterReload = await page.evaluate(() => localStorage.getItem('live.notif.darvo'));

			expect(stateAfterReload).toBe(notifState);
		});
	});

	// Note: News card filter tests moved to e2e/live/news.spec.ts

	test.describe('Language selector', () => {
		test('language selector exists and has options', async ({page}) => {
			const langSelect = page.locator('#language-select');

			if (await langSelect.count() > 0) {
				await expect(langSelect).toBeVisible();

				const options = await langSelect.locator('option').count();
				expect(options).toBeGreaterThan(1);
			}
		});

		test('changing language updates localStorage', async ({page}) => {
			const langSelect = page.locator('#language-select');

			if (await langSelect.count() > 0) {
				// Get current language
				const initialValue = await langSelect.inputValue();

				// Get all options
				const options = await langSelect.locator('option').all();
				if (options.length > 1) {
					// Find a different language
					const secondOption = await options[1].getAttribute('value');

					if (secondOption && secondOption !== initialValue) {
						// Change language
						await langSelect.selectOption(secondOption);

						// Wait for localStorage to be set
						await page.waitForFunction(expected => localStorage.getItem('language') === expected, secondOption);

						// Check localStorage
						const storedLang = await page.evaluate(() => localStorage.getItem('language'));

						expect(storedLang).toBe(secondOption);
					}
				}
			}
		});
	});

	test.describe('Navbar interactions', () => {
		test('navbar pin toggle works', async ({page}) => {
			const pinToggle = page.locator('[data-toggle="navbar-pin"]');

			if (await pinToggle.count() > 0) {
				const navbar = page.locator('.navbar');

				// Click pin toggle
				await pinToggle.click();

				// Wait for localStorage to be set
				await page.waitForFunction(() => localStorage.getItem('navbar-pinned') !== null);

				// Check localStorage for pin state
				const pinState = await page.evaluate(() => localStorage.getItem('navbar-pinned'));

				expect(pinState).toBeTruthy();

				// Toggle back
				await pinToggle.click();

				// Wait for localStorage to change
				await page.waitForFunction(oldState => localStorage.getItem('navbar-pinned') !== oldState, pinState);

				const pinStateAfter = await page.evaluate(() => localStorage.getItem('navbar-pinned'));

				expect(pinStateAfter).not.toBe(pinState);
			}
		});
	});

	test.describe('Specific card rendering', () => {
		test('Arbitration card displays information', async ({page}) => {
			// Wait for arbitration data to load
			await page.waitForSelector('#arby-what', {timeout: 10_000});

			const arbyWhat = page.locator('#arby-what');
			const arbyWhere = page.locator('#arby-where');

			// Should have some text content
			const whatText = await arbyWhat.textContent();
			const whereText = await arbyWhere.textContent();

			expect(whatText).toBeTruthy();
			expect(whereText).toBeTruthy();

			// Node name should have a tileset tooltip
			const abbr = arbyWhere.locator('abbr');
			await expect(abbr).toBeVisible();
			expect(await abbr.getAttribute('data-bs-title')).toBe('Corpus Ship');
		});

		test('Darvo deal card displays item information', async ({page}) => {
			// Wait for Darvo data
			await page.waitForSelector('#darvo-item', {timeout: 10_000});

			const darvoItem = page.locator('#darvo-item');
			const itemText = await darvoItem.textContent();

			expect(itemText).toBeTruthy();
		});
	});

	// eslint-disable-next-line no-warning-comments
	// TODO: Split card-specific tests into separate files under e2e/live/

	test.describe('Responsive behavior', () => {
		test('page is mobile responsive', async ({page}) => {
			// Set mobile viewport
			await page.setViewportSize({width: 375, height: 667});

			// Wait for cards to be visible after viewport change
			await expect(page.locator('.card').first()).toBeVisible();

			// Cards should still be visible
			const cards = await page.locator('.card').count();
			expect(cards).toBeGreaterThan(0);

			// Should be able to interact with cards
			const firstCollapseToggle = page.locator('[data-collapse-toggle]').first();
			if (await firstCollapseToggle.count() > 0) {
				await expect(firstCollapseToggle).toBeVisible();
				await firstCollapseToggle.click();
				// Click completes successfully - no need to wait
			}
		});
	});
});
