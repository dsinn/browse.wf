import {test, expect} from '@playwright/test';
import {setupMockRoutes} from '../helpers/api-mocks';
import {openFilterPanel} from '../helpers/dom-helpers';

test.describe('News Card (/live)', () => {
	test.beforeEach(async ({page, context}) => {
		// Clear all cookies and storage for test isolation
		await context.clearCookies();

		// Mock API responses for deterministic, fast, offline-capable tests
		await setupMockRoutes(page);

		await page.goto('/live');

		// Clear localStorage after page loads but before tests run
		await page.evaluate(() => {
			localStorage.clear();
		});

		// Wait for initial data to load
		await page.waitForSelector('#arby-what:not(:has-text("Loading..."))', {timeout: 10_000});
	});

	test.describe('News card filters', () => {
		test('clicking gear icon shows filter panel', async ({page}) => {
			const filterPanel = page.locator('#news-filters');
			await expect(filterPanel).toBeHidden();
			await openFilterPanel(page, 'news');
			await expect(filterPanel).toBeVisible();
		});

		test('unchecking filter checkbox filters content', async ({page}) => {
			await openFilterPanel(page, 'news');

			// Check which filter type has items we can test with
			const primaryCount = await page.locator('#news-body .news-item.news-primary').count();
			const successCount = await page.locator('#news-body .news-item.news-success').count();

			// Pick the first available filter type to test
			let filterSelector: string;
			let newsItemClass: string;
			let initialFilteredCount: number;

			if (primaryCount > 0) {
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
			await openFilterPanel(page, 'news');

			// Uncheck primary filter
			const primaryFilter = page.locator('#filter-news-primary');
			await primaryFilter.uncheck();
			await expect(primaryFilter).not.toBeChecked();

			// Reload page
			await page.reload();
			await page.waitForSelector('#arby-what:not(:has-text("Loading..."))', {timeout: 10_000});

			// Open filter panel again
			await openFilterPanel(page, 'news');

			// Verify state persisted (should still be unchecked)
			await expect(primaryFilter).not.toBeChecked();
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

			// Verify localStorage threshold was set
			const threshold = await page.evaluate(() => localStorage.getItem('live.news.all_read_timestamp'));
			expect(threshold).toBeTruthy();
			expect(Number(threshold)).toBeGreaterThan(0);
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

			const primaryItems = page.locator('#news-body .news-item.news-primary');
			const successItems = page.locator('#news-body .news-item.news-success');

			const totalItems = await primaryItems.count() + await successItems.count();
			expect(totalItems).toBeGreaterThan(0);

			if (await primaryItems.count() > 0) {
				await expect(primaryItems.first()).toHaveAttribute('data-news-key');
			}
		});
	});
});
