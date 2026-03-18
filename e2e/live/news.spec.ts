import {test, expect} from '@playwright/test';
import {setupMockRoutes} from '../helpers/api-mocks';

test.describe('News Card (/live)', () => {
	test.beforeEach(async ({page, context}) => {
		// Clear all cookies and storage for test isolation
		await context.clearCookies();

		// Mock API responses for deterministic, fast, offline-capable tests
		await setupMockRoutes(page);

		await page.goto('/live.php');

		// Clear localStorage after page loads but before tests run
		await page.evaluate(() => {
			localStorage.clear();
		});

		// Wait for initial data to load
		await page.waitForSelector('#arby-what:not(:has-text("Loading..."))', {timeout: 10_000});
	});

	test.describe('News card filters', () => {
		test('clicking gear icon shows filter panel', async ({page}) => {
			// Find the News card filter toggle
			const newsFilterToggle = page.locator('[data-filter-toggle="news"]');

			// Filter panel should not be visible initially
			const filterPanel = page.locator('#news-filters');
			await expect(filterPanel).toBeHidden();

			// Click gear icon
			await newsFilterToggle.click();

			// Filter panel should now be visible
			await expect(filterPanel).toBeVisible();
		});

		test('unchecking filter checkbox filters content', async ({page}) => {
			// Open News filter panel
			const newsFilterToggle = page.locator('[data-filter-toggle="news"]');
			await newsFilterToggle.click();
			await expect(page.locator('#news-filters')).toBeVisible();

			// Check which filter type has items we can test with
			const dangerCount = await page.locator('#news-body .news-item.news-danger').count();
			const primaryCount = await page.locator('#news-body .news-item.news-primary').count();
			const successCount = await page.locator('#news-body .news-item.news-success').count();

			// Pick the first available filter type to test
			let filterSelector: string;
			let newsItemClass: string;
			let initialFilteredCount: number;

			if (dangerCount > 0) {
				filterSelector = '#filter-news-danger';
				newsItemClass = '.news-item.news-danger';
				initialFilteredCount = dangerCount;
			} else if (primaryCount > 0) {
				filterSelector = '#filter-news-primary';
				newsItemClass = '.news-item.news-primary';
				initialFilteredCount = primaryCount;
			} else if (successCount > 0) {
				filterSelector = '#filter-news-success';
				newsItemClass = '.news-item.news-success';
				initialFilteredCount = successCount;
			} else {
				// Skip test if no filtered items exist
				test.skip();
				return;
			}

			// Verify filtered items ARE present
			expect(initialFilteredCount).toBeGreaterThan(0);

			// Get initial count of all news items
			const initialCount = await page.locator('#news-body .news-item').count();

			// Uncheck the filter
			await page.locator(filterSelector).uncheck();

			// Wait for count to decrease
			await expect(page.locator('#news-body .news-item')).not.toHaveCount(initialCount);

			// Count should be less (filtered items removed)
			const newCount = await page.locator('#news-body .news-item').count();
			expect(newCount).toBeLessThan(initialCount);

			// Filtered items should NOW be gone
			const filteredItemsAfter = await page.locator(`#news-body ${newsItemClass}`).count();
			expect(filteredItemsAfter).toBe(0);
		});

		test('filter preferences persist in localStorage', async ({page}) => {
			// Open News filter panel
			const newsFilterToggle = page.locator('[data-filter-toggle="news"]');
			await newsFilterToggle.click();
			await expect(page.locator('#news-filters')).toBeVisible();

			// Uncheck red text filter
			const redtextFilter = page.locator('#filter-news-danger');
			await redtextFilter.uncheck();
			await expect(redtextFilter).not.toBeChecked();

			// Reload page
			await page.reload();
			await page.waitForSelector('#arby-what:not(:has-text("Loading..."))', {timeout: 10_000});

			// Open filter panel again
			await newsFilterToggle.click();
			await expect(page.locator('#news-filters')).toBeVisible();

			// Verify state persisted (should still be unchecked)
			await expect(redtextFilter).not.toBeChecked();
		});
	});

	test.describe('Mark as read functionality', () => {
		test('mark all button exists and is visible', async ({page}) => {
			const markAllBtn = page.locator('#news-mark-all-read');
			await expect(markAllBtn).toBeVisible();
			await expect(markAllBtn).toHaveText(/mark read/iu);
		});

		test('clicking news item marks it as read', async ({page}) => {
			// Wait for news items to load
			await page.waitForSelector('#news-body .news-item', {timeout: 10_000});

			// Wait for mark-as-read module to be loaded
			await page.waitForFunction(() => typeof (globalThis as any).markNewsItemAsRead === 'function', {timeout: 5000});

			// Find an unread primary or success news item and get its key
			const unreadItem = page.locator('#news-body .news-item.news-primary:not(.news-read), #news-body .news-item.news-success:not(.news-read)').first();

			if (await unreadItem.count() === 0) {
				test.skip();
				return;
			}

			const newsKey = await unreadItem.getAttribute('data-news-key');
			expect(newsKey).toBeTruthy();

			// Click the news item
			await unreadItem.click();

			// Re-query for the specific element by its unique key to avoid stale element reference
			const clickedItem = page.locator(`[data-news-key="${newsKey}"]`);

			// Verify it now has the news-read class
			await expect(clickedItem).toHaveClass(/news-read/u);

			// Verify localStorage was updated
			const readItems = await page.evaluate(() => {
				const stored = localStorage.getItem('news_items_read');
				return stored ? JSON.parse(stored) : [];
			});

			expect(readItems.length).toBeGreaterThan(0);
		});

		test('clicking mark all button marks all primary/success items as read', async ({page}) => {
			// Wait for news items to load
			await page.waitForSelector('#news-body .news-item', {timeout: 10_000});

			// Get count of UNREAD primary/success items
			const unreadItems = page.locator('#news-body [data-news-key]:not(.news-read)');
			const unreadCount = await unreadItems.count();

			if (unreadCount === 0) {
				test.skip();
				return;
			}

			// Click mark all button
			const markAllBtn = page.locator('#news-mark-all-read');
			await markAllBtn.click();

			// All previously unread items should now have news-read class
			await expect(unreadItems).toHaveCount(0);

			// Verify localStorage was updated
			const readItems = await page.evaluate(() => {
				const stored = localStorage.getItem('news_items_read');
				return stored ? JSON.parse(stored) : [];
			});

			expect(readItems.length).toBeGreaterThan(0);
		});

		test('danger items (red text) have no mark-as-read functionality', async ({page}) => {
			// Wait for news items to load
			await page.waitForSelector('#news-body .news-item', {timeout: 10_000});

			// Find a danger news item
			const dangerItem = page.locator('#news-body .news-item.news-danger').first();

			if (await dangerItem.count() === 0) {
				test.skip();
				return;
			}

			// Verify danger item has no data-news-key attribute
			const hasNewsKey = await dangerItem.evaluate(element => Object.hasOwn(element.dataset, 'newsKey'));
			expect(hasNewsKey).toBe(false);
		});

		test('read state persists after page reload', async ({page}) => {
			// Wait for news items to load
			await page.waitForSelector('#news-body .news-item', {timeout: 10_000});

			// Find a primary or success news item
			const newsItem = page.locator('#news-body .news-item.news-primary, #news-body .news-item.news-success').first();
			await expect(newsItem).toBeVisible();

			// Get the data-news-key for verification later
			const newsKey = await newsItem.getAttribute('data-news-key');
			expect(newsKey).toBeTruthy();

			// Click to mark as read
			await newsItem.click();
			await expect(newsItem).toHaveClass(/news-read/u);

			// Reload the page
			await page.reload();
			await page.waitForSelector('#arby-what:not(:has-text("Loading..."))', {timeout: 10_000});
			await page.waitForSelector('#news-body .news-item', {timeout: 10_000});

			// Find the same item by data-news-key
			const sameItemAfterReload = page.locator(`#news-body [data-news-key="${newsKey}"]`);

			// Verify it still has news-read class
			await expect(sameItemAfterReload).toHaveClass(/news-read/u);
		});

		test('clicking item adds news-read class', async ({page}) => {
			// Wait for news items to load
			await page.waitForSelector('#news-body .news-item', {timeout: 10_000});

			// Wait for mark-as-read module to be loaded
			await page.waitForFunction(() => typeof (globalThis as any).markNewsItemAsRead === 'function', {timeout: 5000});

			// Find an unread primary or success item and get its key
			const unreadItem = page.locator('#news-body .news-item.news-primary:not(.news-read), #news-body .news-item.news-success:not(.news-read)').first();

			if (await unreadItem.count() === 0) {
				test.skip();
				return;
			}

			const newsKey = await unreadItem.getAttribute('data-news-key');
			expect(newsKey).toBeTruthy();

			// Verify initially does not have news-read class
			await expect(unreadItem).not.toHaveClass(/news-read/u);

			// Mark as read
			await unreadItem.click();

			// Re-query for the specific element by its unique key to avoid stale element reference
			const clickedItem = page.locator(`[data-news-key="${newsKey}"]`);

			// Verify news-read class is now applied (CSS handles visual changes)
			await expect(clickedItem).toHaveClass(/news-read/u);
		});
	});

	test.describe('Visual behavior', () => {
		test('mark all button is visible and clickable', async ({page}) => {
			const markAllBtn = page.locator('#news-mark-all-read');

			// Button should be visible and interactive
			await expect(markAllBtn).toBeVisible();
			await expect(markAllBtn).toBeEnabled();

			// Should be able to click it
			await markAllBtn.click();
			// Click succeeds = button is properly styled and functional
		});

		test('correct CSS classes applied to news items', async ({page}) => {
			await page.waitForSelector('#news-body .news-item', {timeout: 10_000});

			// Verify news items have correct type classes
			const primaryItems = page.locator('#news-body .news-item.news-primary');
			const successItems = page.locator('#news-body .news-item.news-success');
			const dangerItems = page.locator('#news-body .news-item.news-danger');

			// At least one type should exist
			const totalItems = await primaryItems.count() + await successItems.count() + await dangerItems.count();
			expect(totalItems).toBeGreaterThan(0);

			// Primary/success items should have data-news-key (danger should not)
			if (await primaryItems.count() > 0) {
				const firstPrimary = primaryItems.first();
				await expect(firstPrimary).toHaveAttribute('data-news-key');
			}

			if (await dangerItems.count() > 0) {
				const firstDanger = dangerItems.first();
				const hasNewsKey = await firstDanger.evaluate(element => Object.hasOwn(element.dataset, 'newsKey'));
				expect(hasNewsKey).toBe(false);
			}
		});
	});

	test.describe('API optimization', () => {
		test('disabling danger filter skips redtext API call', async ({page}) => {
			// Disable danger filter BEFORE page load
			await page.evaluate(() => {
				localStorage.setItem('live.filter.news.danger', '0');
			});

			// Now reload and check if redtext API is NOT called
			const redtextRequestPromise = page.waitForRequest(
				request => request.url().includes('redtext.json'),
				{timeout: 5000},
			).catch(() => null); // Catch timeout - we EXPECT no request

			await page.reload();
			await page.waitForSelector('#arby-what:not(:has-text("Loading..."))', {timeout: 10_000});

			const redtextRequest = await redtextRequestPromise;

			// Should not have called redtext API
			expect(redtextRequest).toBeNull();
		});

		test('enabling danger filter fetches redtext', async ({page}) => {
			// Disable danger filter initially
			await page.evaluate(() => {
				localStorage.setItem('live.filter.news.danger', '0');
			});

			await page.reload();
			await page.waitForSelector('#arby-what:not(:has-text("Loading..."))', {timeout: 10_000});

			// Wait for redtext API call after enabling filter
			const redtextRequestPromise = page.waitForRequest(
				request => request.url().includes('redtext.json'),
				{timeout: 5000},
			);

			// Open filter panel
			const newsFilterToggle = page.locator('[data-filter-toggle="news"]');
			await newsFilterToggle.click();
			await expect(page.locator('#news-filters')).toBeVisible();

			// Enable danger filter
			const dangerFilter = page.locator('#filter-news-danger');
			await dangerFilter.check();

			// Should have called redtext API when filter enabled
			const redtextRequest = await redtextRequestPromise;
			expect(redtextRequest).toBeTruthy();
		});
	});
});
