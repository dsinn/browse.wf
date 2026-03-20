/**
 * Tests for News card mark-as-read functionality
 *
 * Note: Content filtering behavior (updateNewsTicker) is not tested here to avoid
 * test drift. The mock implementation would need to duplicate production logic,
 * and any divergence would give false confidence.
 *
 * Content filtering logic should be tested via E2E tests or manual testing.
 */
import {
	describe, test, expect, beforeEach, afterEach,
} from 'vitest';
import {getById} from '../../helpers/dom-helpers';
import {testCardFilters} from '../card-filters-factory';
import {
	generateNewsItemKey, isNewsItemRead, markNewsItemAsRead, markAllNewsAsRead, pruneStaleNewsRead, initializeMarkAsRead,
} from '../../../src/news-mark-read';

// Test generic card filter integration for News card
// This verifies: gear icon, accordion, checkboxes, localStorage persistence, auto-expand
testCardFilters('news');

describe('News Card - Basic Structure', () => {
	test('news body element exists', () => {
		const newsBody = getById('news-body');
		expect(newsBody).toBeTruthy();
	});

	test('mark all as read button exists', () => {
		const markAllBtn = getById('news-mark-all-read');
		expect(markAllBtn).toBeTruthy();
		expect(markAllBtn.tagName).toBe('BUTTON');
		expect(markAllBtn.textContent?.trim()).toContain('Mark read');
	});

	test('displays news items', () => {
		const newsBody = getById('news-body');

		// Simulate rendering a news item
		newsBody.innerHTML = '';
		const p = document.createElement('p');
		p.className = 'card-text mb-1';

		const badge = document.createElement('span');
		badge.className = 'badge text-bg-secondary';
		badge.textContent = 'Just now';
		p.append(badge);

		const textSpan = document.createElement('span');
		textSpan.className = 'text-danger';
		textSpan.textContent = ' Server restart in 5 minutes';
		p.append(textSpan);

		newsBody.append(p);

		expect(newsBody.querySelector('p')).toBeTruthy();
		expect(newsBody.querySelector('.text-danger')?.textContent).toBe(' Server restart in 5 minutes');
	});
});

// Helper to create news item elements
function createNewsItem(type: 'primary' | 'success' | 'danger', key?: string): HTMLParagraphElement {
	const element = document.createElement('p');
	element.className = `news-item news-${type}`;
	if (key && type !== 'danger') {
		element.dataset.newsKey = key;
	}

	return element;
}

describe('News Card - Mark as Read Module', () => {
	beforeEach(() => {
		// Clear localStorage before each test
		localStorage.clear();

		// Mock triggerCloudSync (used for triggering syncs)
		(globalThis as any).triggerCloudSync = () => {
			// No-op stub for tests
		};

		// Initialize the module
		initializeMarkAsRead();
	});

	afterEach(() => {
		delete (globalThis as any).triggerCloudSync;
	});

	describe('generateNewsItemKey', () => {
		test('generates key with link and timestamp', () => {
			const item = {
				type: 'primary' as const,
				data: 'Test event',
				time: 1_234_567_890,
				link: 'https://example.com',
			};

			const key = generateNewsItemKey(item);
			expect(key).toBe('https://example.com|1234567890');
		});

		test('generates key without link (empty string for URL part)', () => {
			const item = {
				type: 'primary' as const,
				data: 'Test event',
				time: 1_234_567_890,
			};

			const key = generateNewsItemKey(item);
			expect(key).toBe('|1234567890');
		});

		test('handles different timestamps correctly', () => {
			const item1 = {
				type: 'primary' as const,
				data: 'Event 1',
				time: 1_000_000_000,
				link: 'https://example.com',
			};

			const item2 = {
				type: 'primary' as const,
				data: 'Event 2',
				time: 2_000_000_000,
				link: 'https://example.com',
			};

			const key1 = generateNewsItemKey(item1);
			const key2 = generateNewsItemKey(item2);

			expect(key1).not.toBe(key2);
			expect(key1).toBe('https://example.com|1000000000');
			expect(key2).toBe('https://example.com|2000000000');
		});
	});

	describe('isNewsItemRead', () => {
		test('returns false when no items are read', () => {
			const result = isNewsItemRead('test-key|123');
			expect(result).toBe(false);
		});

		test('returns true when item is marked as read', () => {
			localStorage.setItem('news_items_read', JSON.stringify(['test-key|123']));

			const result = isNewsItemRead('test-key|123');
			expect(result).toBe(true);
		});

		test('returns false for different key', () => {
			localStorage.setItem('news_items_read', JSON.stringify(['test-key|123']));

			const result = isNewsItemRead('different-key|456');
			expect(result).toBe(false);
		});

		test('handles corrupted localStorage gracefully', () => {
			localStorage.setItem('news_items_read', 'invalid json');

			const result = isNewsItemRead('test-key|123');
			expect(result).toBe(false);
		});
	});

	describe('markNewsItemAsRead', () => {
		test('marks item as read in localStorage', () => {
			const element = createNewsItem('primary', 'test-key|123');

			markNewsItemAsRead('test-key|123', element);

			const stored = localStorage.getItem('news_items_read');
			expect(stored).toBeTruthy();
			expect(JSON.parse(stored!)).toEqual(['test-key|123']);
		});

		test('adds news-read class to element', () => {
			const element = createNewsItem('primary', 'test-key|123');

			markNewsItemAsRead('test-key|123', element);

			expect(element.classList.contains('news-read')).toBe(true);
		});

		test('does not duplicate keys in localStorage when marking different elements', () => {
			const element1 = createNewsItem('primary', 'test-key|123');
			const element2 = createNewsItem('success', 'test-key|123');

			markNewsItemAsRead('test-key|123', element1);
			markNewsItemAsRead('test-key|123', element2);

			const stored = localStorage.getItem('news_items_read');
			expect(JSON.parse(stored!)).toEqual(['test-key|123']);
		});

		test('does not re-mark already read items', () => {
			localStorage.setItem('news_items_read', JSON.stringify(['test-key|123']));
			const element = createNewsItem('primary', 'test-key|123');
			element.classList.add('news-read');

			markNewsItemAsRead('test-key|123', element);

			const stored = localStorage.getItem('news_items_read');
			expect(JSON.parse(stored!)).toEqual(['test-key|123']);
		});

		test('appends to existing read items', () => {
			localStorage.setItem('news_items_read', JSON.stringify(['existing-key|111']));

			const element = createNewsItem('primary', 'new-key|222');

			markNewsItemAsRead('new-key|222', element);

			const stored = localStorage.getItem('news_items_read');
			expect(JSON.parse(stored!)).toEqual(['existing-key|111', 'new-key|222']);
		});
	});

	describe('markAllNewsAsRead', () => {
		test('marks all visible primary/success items as read', () => {
			const newsBody = getById('news-body');
			newsBody.innerHTML = '';

			// Create primary item
			const primary = document.createElement('p');
			primary.className = 'news-item news-primary';
			primary.dataset.newsKey = 'primary-key|123';
			newsBody.append(primary);

			// Create success item
			const success = document.createElement('p');
			success.className = 'news-item news-success';
			success.dataset.newsKey = 'success-key|456';
			newsBody.append(success);

			// Create danger item (should be ignored)
			const danger = document.createElement('p');
			danger.className = 'news-item news-danger';
			// No data-news-key attribute (danger items don't have it)
			newsBody.append(danger);

			markAllNewsAsRead();

			const stored = localStorage.getItem('news_items_read');
			expect(stored).toBeTruthy();
			const readItems = JSON.parse(stored!);
			expect(readItems).toContain('primary-key|123');
			expect(readItems).toContain('success-key|456');
			expect(readItems.length).toBe(2);

			// Check UI classes
			expect(primary.classList.contains('news-read')).toBe(true);
			expect(success.classList.contains('news-read')).toBe(true);
			expect(danger.classList.contains('news-read')).toBe(false);
		});

		test('does nothing when news body is empty', () => {
			const newsBody = getById('news-body');
			newsBody.innerHTML = '';

			markAllNewsAsRead();

			const stored = localStorage.getItem('news_items_read');
			expect(stored).toBeFalsy();
		});

		test('mark all button click handler works', () => {
			const newsBody = getById('news-body');
			newsBody.innerHTML = '';

			const item = document.createElement('p');
			item.className = 'news-item news-primary';
			item.dataset.newsKey = 'test-key|123';
			newsBody.append(item);

			const markAllBtn = getById('news-mark-all-read');
			markAllBtn.click();

			const stored = localStorage.getItem('news_items_read');
			expect(stored).toBeTruthy();
			expect(JSON.parse(stored!)).toEqual(['test-key|123']);
			expect(item.classList.contains('news-read')).toBe(true);
		});
	});

	describe('pruneStaleNewsRead', () => {
		test('removes stale keys that no longer exist in DOM', () => {
			const newsBody = getById('news-body');
			newsBody.innerHTML = '';

			// Set up localStorage with old keys
			localStorage.setItem('news_items_read', JSON.stringify([
				'old-key-1|111',
				'current-key|222',
				'old-key-2|333',
			]));

			// Only add one current item to DOM
			const item = document.createElement('p');
			item.className = 'news-item news-primary';
			item.dataset.newsKey = 'current-key|222';
			newsBody.append(item);

			pruneStaleNewsRead();

			const stored = localStorage.getItem('news_items_read');
			expect(stored).toBeTruthy();
			expect(JSON.parse(stored!)).toEqual(['current-key|222']);
		});

		test('removes localStorage key when all items are stale', () => {
			const newsBody = getById('news-body');
			newsBody.innerHTML = '';

			localStorage.setItem('news_items_read', JSON.stringify(['old-key|111']));

			// Add a different item to DOM
			const item = document.createElement('p');
			item.className = 'news-item news-primary';
			item.dataset.newsKey = 'different-key|222';
			newsBody.append(item);

			pruneStaleNewsRead();

			const stored = localStorage.getItem('news_items_read');
			expect(stored).toBeFalsy();
		});

		test('does not prune when no items in DOM (guard against premature cleanup)', () => {
			const newsBody = getById('news-body');
			newsBody.innerHTML = '';

			localStorage.setItem('news_items_read', JSON.stringify(['key-1|111', 'key-2|222']));

			pruneStaleNewsRead();

			// Should NOT prune when DOM is empty (news hasn't loaded yet)
			const stored = localStorage.getItem('news_items_read');
			expect(stored).toBeTruthy();
			expect(JSON.parse(stored!)).toEqual(['key-1|111', 'key-2|222']);
		});

		test('does nothing when news card not in DOM', () => {
			// Remove news-body from DOM
			const newsBody = getById('news-body');
			const newsParent = newsBody.parentElement;
			newsBody.remove();

			localStorage.setItem('news_items_read', JSON.stringify(['key-1|111']));

			pruneStaleNewsRead();

			// Should preserve data when card not present
			const stored = localStorage.getItem('news_items_read');
			expect(stored).toBeTruthy();
			expect(JSON.parse(stored!)).toEqual(['key-1|111']);

			// Restore DOM for other tests
			newsParent?.append(newsBody);
		});

		test('handles empty localStorage gracefully', () => {
			const newsBody = getById('news-body');
			newsBody.innerHTML = '';

			const item = document.createElement('p');
			item.dataset.newsKey = 'test-key|123';
			newsBody.append(item);

			// Should not throw
			expect(() => {
				pruneStaleNewsRead();
			}).not.toThrow();
		});
	});

	describe('localStorage integration', () => {
		test('appends multiple read items to array', () => {
			const element1 = createNewsItem('primary', 'key-1|123');
			const element2 = createNewsItem('success', 'key-2|456');

			markNewsItemAsRead('key-1|123', element1);
			markNewsItemAsRead('key-2|456', element2);

			const stored = localStorage.getItem('news_items_read');
			expect(stored).toBeTruthy();

			const parsed = JSON.parse(stored!);
			expect(Array.isArray(parsed)).toBe(true);
			expect(parsed.length).toBe(2);
		});

		test('removes localStorage key when all items unmarked', () => {
			const newsBody = getById('news-body');
			newsBody.innerHTML = '';

			localStorage.setItem('news_items_read', JSON.stringify(['key-1|111']));

			// Add different item, making old key stale
			const item = document.createElement('p');
			item.dataset.newsKey = 'new-key|222';
			newsBody.append(item);

			pruneStaleNewsRead();

			// Since only stale item, should remove key entirely
			const stored = localStorage.getItem('news_items_read');
			expect(stored).toBeFalsy();
		});
	});
});
