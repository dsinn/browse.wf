/**
 * Tests for the News card — rendering (updateNewsTicker) and mark-as-read
 */
import {
	describe, test, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {loadMock} from '@test/helpers/api-mocks';
import {getById, mockBootstrapTooltip} from '@test/helpers/dom-helpers';
import {testCardFilters} from '@test/live/card-filters-factory';
import * as triggerModule from '../cloud-sync/trigger.js';
import {
	setNewsItemData, isNewsItemRead, markNewsItemAsRead, markAllNewsAsRead, pruneStaleNewsRead, initializeMarkAsRead,
} from './news-mark-read';
import {updateNewsTicker, resetNewsState} from './news';

vi.mock('../cloud-sync/trigger.js', () => ({
	triggerCloudSyncWithDebounce: vi.fn(),
}));

// Test generic card filter integration for News card
// This verifies: gear icon, accordion, checkboxes, localStorage persistence, auto-expand
testCardFilters('news');

const worldState = loadMock('worldState.json');
const worldStateEmptyEvents = loadMock('worldState-empty-events.json');

// Helper to create news item elements
function createNewsItem(type: 'primary' | 'success'): HTMLParagraphElement {
	const element = document.createElement('p');
	element.className = `news-item news-${type}`;
	return element;
}

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

describe('updateNewsTicker', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="news-body">Loading...</div>';
		localStorage.clear();
		resetNewsState();

		mockBootstrapTooltip();
		(globalThis as any).worldState = worldState;
		(globalThis as any).sendNotification = vi.fn();
		(globalThis as any).formatActivation = vi.fn((ms: number) => `${ms}ms`);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		delete (globalThis as any).bootstrap;
		delete (globalThis as any).worldState;
		delete (globalThis as any).sendNotification;
		delete (globalThis as any).formatActivation;
	});

	describe('no worldState', () => {
		test('shows "no news items available" when worldState is absent', () => {
			(globalThis as any).worldState = undefined;
			updateNewsTicker();
			expect(document.querySelector('#news-body')!.innerHTML).toBe('No news items available.');
		});

		test('shows "no news items available" when Events is empty', () => {
			(globalThis as any).worldState = worldStateEmptyEvents;
			updateNewsTicker();
			expect(document.querySelector('#news-body')!.innerHTML).toBe('No news items available.');
		});
	});

	describe('rendering items', () => {
		test('renders news items from worldState', () => {
			updateNewsTicker();
			const items = document.querySelectorAll('#news-body .news-item');
			expect(items.length).toBeGreaterThan(0);
		});

		test('renders community events as news-success', () => {
			updateNewsTicker();
			// The worldState has Community=true events e.g. "Known Issues List" and "Community Stream"
			expect(document.querySelector('#news-body .news-success')).toBeTruthy();
		});

		test('renders non-community events as news-primary', () => {
			updateNewsTicker();
			// The worldState has non-community events e.g. "Instantly Acquire The Old Peace Packs Now"
			expect(document.querySelector('#news-body .news-primary')).toBeTruthy();
		});

		test('renders item with Prop as anchor tag', () => {
			updateNewsTicker();
			// All rendered items have Prop URLs
			const anchor = document.querySelector<HTMLAnchorElement>('#news-body a');
			expect(anchor).toBeTruthy();
			expect(anchor!.target).toBe('_blank');
		});

		test('renders item without Prop as plain text', () => {
			(globalThis as any).worldState = {
				Events: [{
					Date: {$date: {$numberLong: '1765387020000'}},
					Messages: [{LanguageCode: 'en', Message: 'Plain text event'}],
				}],
			};
			updateNewsTicker();
			expect(document.querySelector('#news-body a')).toBeNull();
			expect(document.querySelector('#news-body')!.textContent).toContain('Plain text event');
		});

		test('renders badge with data-activation attribute', () => {
			updateNewsTicker();
			const badge = document.querySelector<HTMLElement>('#news-body .badge');
			expect(badge?.dataset.activation).toMatch(/^\d+$/u);
		});

		test('uses formatActivation for badge text', () => {
			updateNewsTicker();
			expect((globalThis as any).formatActivation).toHaveBeenCalled();
		});

		test('falls back to toLocaleString when formatActivation is absent', () => {
			delete (globalThis as any).formatActivation;
			updateNewsTicker();
			const badge = document.querySelector('#news-body .badge');
			expect(badge?.textContent).toBeTruthy();
		});

		test('renders items newest-first', () => {
			updateNewsTicker();
			const badges = document.querySelectorAll<HTMLElement>('#news-body .badge');
			const times = [...badges].map(b => Number(b.dataset.activation));
			for (let i = 1; i < times.length; i++) {
				expect(times[i]).toBeLessThanOrEqual(times[i - 1]);
			}
		});

		test('adds news-read class when item is already read', () => {
			// Mark all items as read via threshold
			localStorage.setItem('live.news.all_read_timestamp', String(Number.MAX_SAFE_INTEGER));
			updateNewsTicker();
			const items = document.querySelectorAll('#news-body .news-item');
			for (const item of items) {
				expect(item.classList.contains('news-read')).toBe(true);
			}
		});

		test('does not add news-read class for unread items', () => {
			updateNewsTicker();
			expect(document.querySelector('#news-body .news-read')).toBeNull();
		});

		test('click handler marks item as read', () => {
			updateNewsTicker();
			const item = document.querySelector<HTMLElement>('#news-body .news-item');
			item!.querySelector<HTMLElement>('a')!.dispatchEvent(new MouseEvent('click', {bubbles: true}));
			expect(item!.classList.contains('news-read')).toBe(true);
		});

		test('skips JoinDiscord events', () => {
			updateNewsTicker();
			const body = document.querySelector('#news-body')!;
			expect(body.textContent).not.toContain('JoinDiscord');
		});

		test('skips events without a Date field', () => {
			// The worldState has community events without Date (e.g. the wiki/forums links near the top)
			// Those should not appear; only events with Date are rendered
			updateNewsTicker();
			// All rendered items must have data-activation set by badge
			const itemsWithoutBadge = [...document.querySelectorAll('#news-body .news-item')]
				.filter(p => !p.querySelector('.badge'));
			expect(itemsWithoutBadge).toHaveLength(0);
		});
	});

	describe('language selection', () => {
		test('uses the en Messages entry when lang=en', () => {
			localStorage.setItem('lang', 'en');
			updateNewsTicker();
			// "Known Issues List" is an en-only event in worldState.json
			expect(document.querySelector('#news-body')!.textContent).toContain('Known Issues List');
		});

		test('uses a localised Messages entry when lang matches', () => {
			localStorage.setItem('lang', 'de');
			updateNewsTicker();
			// "Instantly Acquire The Old Peace Packs Now" has a de translation
			expect(document.querySelector('#news-body')!.textContent)
				.toContain('Sichert euch jetzt sofort die Pakete zum Alten Frieden');
		});

		test('defaults to en when no lang in localStorage', () => {
			updateNewsTicker();
			expect(document.querySelector('#news-body')!.textContent).toContain('Known Issues List');
		});
	});

	describe('filtering', () => {
		test('skips items filtered out by isFilterEnabled', () => {
			localStorage.setItem('live.filter.news.primary', '0');
			updateNewsTicker();
			expect(document.querySelector('#news-body .news-primary')).toBeNull();
			expect(document.querySelector('#news-body .news-success')).toBeTruthy();
		});

		test('shows "no items based on filters" when all filtered out', () => {
			localStorage.setItem('live.filter.news.primary', '0');
			localStorage.setItem('live.filter.news.success', '0');
			updateNewsTicker();
			expect(document.querySelector('#news-body')!.textContent).toContain('current filters');
		});

		test('forceRender=true re-renders even when time unchanged', () => {
			updateNewsTicker();
			document.querySelector('#news-body')!.innerHTML = 'modified';
			updateNewsTicker(true);
			expect(document.querySelectorAll('#news-body .news-item').length).toBeGreaterThan(0);
		});

		test('skips re-render when highestTime unchanged and forceRender is false', () => {
			updateNewsTicker();
			document.querySelector('#news-body')!.innerHTML = 'modified';
			updateNewsTicker();
			expect(document.querySelector('#news-body')!.innerHTML).toBe('modified');
		});
	});

	const oldEventWorldState = {
		Events: [{
			Date: {$date: {$numberLong: '1000000'}},
			Messages: [{LanguageCode: 'en', Message: 'Old event'}],
		}],
	};

	describe('notifications', () => {
		test('sends notification for new items when notif enabled', () => {
			// Prime newsNotifyAfter with an old event, then render newer events with notif on
			(globalThis as any).worldState = oldEventWorldState;
			updateNewsTicker();

			localStorage.setItem('live.notif.news', '1');
			(globalThis as any).worldState = worldState;
			updateNewsTicker(true);
			expect((globalThis as any).sendNotification).toHaveBeenCalled();
		});

		test('does not send notification for items at or before newsNotifyAfter', () => {
			// Prime newsNotifyAfter past all worldState event times
			(globalThis as any).worldState = {
				Events: [{
					Date: {$date: {$numberLong: String(Number.MAX_SAFE_INTEGER)}},
					Messages: [{LanguageCode: 'en', Message: 'Far future event'}],
				}],
			};
			updateNewsTicker();

			localStorage.setItem('live.notif.news', '1');
			(globalThis as any).worldState = worldState;
			updateNewsTicker(true);
			expect((globalThis as any).sendNotification).not.toHaveBeenCalled();
		});

		test('does not send notification when notif not enabled in localStorage', () => {
			// Prime newsNotifyAfter with an old event
			(globalThis as any).worldState = oldEventWorldState;
			updateNewsTicker();

			(globalThis as any).worldState = worldState;
			updateNewsTicker(true);
			expect((globalThis as any).sendNotification).not.toHaveBeenCalled();
		});

		test('does not send notification for filtered-out items', () => {
			// Prime newsNotifyAfter with an old event
			(globalThis as any).worldState = oldEventWorldState;
			updateNewsTicker();

			localStorage.setItem('live.notif.news', '1');
			localStorage.setItem('live.filter.news.primary', '0');
			localStorage.setItem('live.filter.news.success', '0');
			(globalThis as any).worldState = worldState;
			updateNewsTicker(true);
			expect((globalThis as any).sendNotification).not.toHaveBeenCalled();
		});
	});
});

describe('News Card - Mark as Read Module', () => {
	beforeEach(() => {
		// Clear localStorage before each test
		localStorage.clear();

		// Initialize the module
		initializeMarkAsRead();
	});

	describe('setNewsItemData', () => {
		test('sets data-news-key with link and timestamp', () => {
			const item = {
				type: 'primary' as const, data: 'Test event', time: 1_234_567_890, link: 'https://example.com',
			};
			const element = createNewsItem('primary');

			setNewsItemData(item, element);

			expect(element.dataset.newsKey).toBe('https://example.com|1234567890');
			expect(element.dataset.newsTime).toBe('1234567890');
		});

		test('sets data-news-key without link', () => {
			const item = {type: 'primary' as const, data: 'Test event', time: 1_234_567_890};
			const element = createNewsItem('primary');

			setNewsItemData(item, element);

			expect(element.dataset.newsKey).toBe('|1234567890');
			expect(element.dataset.newsTime).toBe('1234567890');
		});

		test('different timestamps produce different keys', () => {
			const item1 = {
				type: 'primary' as const, data: 'Event 1', time: 1_000_000_000, link: 'https://example.com',
			};
			const item2 = {
				type: 'primary' as const, data: 'Event 2', time: 2_000_000_000, link: 'https://example.com',
			};
			const element1 = createNewsItem('primary');
			const element2 = createNewsItem('primary');

			setNewsItemData(item1, element1);
			setNewsItemData(item2, element2);

			expect(element1.dataset.newsKey).not.toBe(element2.dataset.newsKey);
		});

		test('round trip: isNewsItemRead returns true after setNewsItemData and markNewsItemAsRead', () => {
			const item = {
				type: 'primary' as const, data: 'Test event', time: 1_234_567_890, link: 'https://example.com',
			};
			const element = createNewsItem('primary');

			setNewsItemData(item, element);
			markNewsItemAsRead(item, element);

			expect(isNewsItemRead(item)).toBe(true);
		});

		test('skips element with empty data-news-time', () => {
			const newsBody = getById('news-body');
			newsBody.innerHTML = '';

			const item = document.createElement('p');
			item.className = 'news-item news-primary';
			item.dataset.newsTime = '';
			newsBody.append(item);

			markAllNewsAsRead();

			expect(localStorage.getItem('live.news.all_read_timestamp')).toBeNull();
		});
	});

	describe('isNewsItemRead', () => {
		test('returns false when no items are read', () => {
			expect(isNewsItemRead({
				type: 'primary', data: 'x', time: 123, link: 'test-key',
			})).toBe(false);
		});

		test('returns true when item is in key array', () => {
			localStorage.setItem('news_items_read', JSON.stringify(['test-key|123']));

			expect(isNewsItemRead({
				type: 'primary', data: 'x', time: 123, link: 'test-key',
			})).toBe(true);
		});

		test('returns false for different key', () => {
			localStorage.setItem('news_items_read', JSON.stringify(['test-key|123']));

			expect(isNewsItemRead({
				type: 'primary', data: 'x', time: 456, link: 'different-key',
			})).toBe(false);
		});

		test('handles corrupted localStorage gracefully', () => {
			localStorage.setItem('news_items_read', 'invalid json');

			expect(isNewsItemRead({
				type: 'primary', data: 'x', time: 123, link: 'test-key',
			})).toBe(false);
		});

		test('returns true when item time is at or before threshold', () => {
			localStorage.setItem('live.news.all_read_timestamp', '1000');

			expect(isNewsItemRead({type: 'primary', data: 'x', time: 1000})).toBe(true);
			expect(isNewsItemRead({type: 'primary', data: 'x', time: 999})).toBe(true);
		});

		test('returns false when item time is after threshold', () => {
			localStorage.setItem('live.news.all_read_timestamp', '1000');

			expect(isNewsItemRead({type: 'primary', data: 'x', time: 1001})).toBe(false);
		});

		test('threshold takes priority over key array check', () => {
			localStorage.setItem('live.news.all_read_timestamp', '1000');
			// Key is NOT in the array, but time is within threshold

			expect(isNewsItemRead({type: 'primary', data: 'x', time: 500})).toBe(true);
		});

		test('falls through to key array when item time exceeds threshold', () => {
			localStorage.setItem('live.news.all_read_timestamp', '1000');
			localStorage.setItem('news_items_read', JSON.stringify(['test-key|2000']));

			expect(isNewsItemRead({
				type: 'primary', data: 'x', time: 2000, link: 'test-key',
			})).toBe(true);
		});
	});

	describe('markNewsItemAsRead', () => {
		test('marks item as read in localStorage', () => {
			const item = {
				type: 'primary' as const, data: 'x', time: 123, link: 'test-key',
			};
			const element = createNewsItem('primary');

			markNewsItemAsRead(item, element);

			const stored = localStorage.getItem('news_items_read');
			expect(stored).toBeTruthy();
			expect(JSON.parse(stored!)).toEqual(['test-key|123']);
		});

		test('adds news-read class to element', () => {
			const item = {
				type: 'primary' as const, data: 'x', time: 123, link: 'test-key',
			};
			const element = createNewsItem('primary');

			markNewsItemAsRead(item, element);

			expect(element.classList.contains('news-read')).toBe(true);
		});

		test('does not duplicate keys in localStorage when marking different elements', () => {
			const item = {
				type: 'primary' as const, data: 'x', time: 123, link: 'test-key',
			};
			const element1 = createNewsItem('primary');
			const element2 = createNewsItem('success');

			markNewsItemAsRead(item, element1);
			markNewsItemAsRead(item, element2);

			const stored = localStorage.getItem('news_items_read');
			expect(JSON.parse(stored!)).toEqual(['test-key|123']);
		});

		test('does not re-mark already read items', () => {
			const item = {
				type: 'primary' as const, data: 'x', time: 123, link: 'test-key',
			};
			localStorage.setItem('news_items_read', JSON.stringify(['test-key|123']));
			const element = createNewsItem('primary');
			element.classList.add('news-read');

			markNewsItemAsRead(item, element);

			const stored = localStorage.getItem('news_items_read');
			expect(JSON.parse(stored!)).toEqual(['test-key|123']);
		});

		test('appends to existing read items', () => {
			localStorage.setItem('news_items_read', JSON.stringify(['existing-key|111']));

			const item = {
				type: 'primary' as const, data: 'x', time: 222, link: 'new-key',
			};
			const element = createNewsItem('primary');

			markNewsItemAsRead(item, element);

			const stored = localStorage.getItem('news_items_read');
			expect(JSON.parse(stored!)).toEqual(['existing-key|111', 'new-key|222']);
		});
	});

	describe('markAllNewsAsRead', () => {
		test('sets threshold to first (newest) item time and clears key array', () => {
			const newsBody = getById('news-body');
			newsBody.innerHTML = '';

			// Items are in descending time order, as rendered by live.ts
			const success = document.createElement('p');
			success.className = 'news-item news-success';
			setNewsItemData({
				type: 'success', data: 'x', time: 456, link: 'success-key',
			}, success);
			newsBody.append(success);

			const primary = document.createElement('p');
			primary.className = 'news-item news-primary';
			setNewsItemData({
				type: 'primary', data: 'x', time: 123, link: 'primary-key',
			}, primary);
			newsBody.append(primary);

			// Pre-populate key array — should be cleared
			localStorage.setItem('news_items_read', JSON.stringify(['old-key|100']));

			markAllNewsAsRead();

			expect(localStorage.getItem('live.news.all_read_timestamp')).toBe('456');
			expect(localStorage.getItem('news_items_read')).toBeNull();

			expect(success.classList.contains('news-read')).toBe(true);
			expect(primary.classList.contains('news-read')).toBe(true);
		});

		test('does not lower an existing threshold', () => {
			const newsBody = getById('news-body');
			newsBody.innerHTML = '';

			localStorage.setItem('live.news.all_read_timestamp', '9999');

			const older = document.createElement('p');
			older.className = 'news-item news-primary';
			setNewsItemData({
				type: 'primary', data: 'x', time: 100, link: 'test-key',
			}, older);
			newsBody.append(older);

			const newer = document.createElement('p');
			newer.className = 'news-item news-primary';
			setNewsItemData({
				type: 'primary', data: 'x', time: 20_000, link: 'test-key-2',
			}, newer);
			newsBody.prepend(newer);

			// Newer item (20000) should raise threshold above old (9999)
			markAllNewsAsRead();
			expect(localStorage.getItem('live.news.all_read_timestamp')).toBe('20000');

			// Re-running with only old items should not lower the threshold
			newsBody.innerHTML = '';
			newsBody.append(older);
			markAllNewsAsRead();
			expect(localStorage.getItem('live.news.all_read_timestamp')).toBe('20000');
		});

		test('does not trigger cloud sync when threshold is unchanged', () => {
			const newsBody = getById('news-body');
			newsBody.innerHTML = '';

			localStorage.setItem('live.news.all_read_timestamp', '9999');

			const item = document.createElement('p');
			item.className = 'news-item news-primary';
			setNewsItemData({
				type: 'primary', data: 'x', time: 100, link: 'test-key',
			}, item);
			newsBody.append(item);

			const syncSpy = vi.mocked(triggerModule.triggerCloudSyncWithDebounce);
			syncSpy.mockClear();

			markAllNewsAsRead();

			expect(syncSpy).not.toHaveBeenCalled();
		});

		test('does nothing when news body is empty', () => {
			const newsBody = getById('news-body');
			newsBody.innerHTML = '';

			markAllNewsAsRead();

			expect(localStorage.getItem('live.news.all_read_timestamp')).toBeNull();
		});

		test('does nothing when news-body element is absent', () => {
			const newsBody = getById('news-body');
			const newsParent = newsBody.parentElement;
			newsBody.remove();

			markAllNewsAsRead();

			expect(localStorage.getItem('live.news.all_read_timestamp')).toBeNull();

			newsParent?.append(newsBody);
		});

		test('mark all button click handler works', () => {
			const newsBody = getById('news-body');
			newsBody.innerHTML = '';

			const item = document.createElement('p');
			item.className = 'news-item news-primary';
			setNewsItemData({
				type: 'primary', data: 'x', time: 123, link: 'test-key',
			}, item);
			newsBody.append(item);

			const markAllBtn = getById('news-mark-all-read');
			markAllBtn.click();

			expect(localStorage.getItem('live.news.all_read_timestamp')).toBe('123');
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
			setNewsItemData({
				type: 'primary', data: 'x', time: 222, link: 'current-key',
			}, item);
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
			setNewsItemData({
				type: 'primary', data: 'x', time: 222, link: 'different-key',
			}, item);
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
			setNewsItemData({
				type: 'primary', data: 'x', time: 123, link: 'test-key',
			}, item);
			newsBody.append(item);

			// Should not throw
			expect(() => {
				pruneStaleNewsRead();
			}).not.toThrow();
		});
	});

	describe('localStorage integration', () => {
		test('appends multiple read items to array', () => {
			const item1 = {
				type: 'primary' as const, data: 'x', time: 123, link: 'key-1',
			};
			const item2 = {
				type: 'success' as const, data: 'y', time: 456, link: 'key-2',
			};

			markNewsItemAsRead(item1, createNewsItem('primary'));
			markNewsItemAsRead(item2, createNewsItem('success'));

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
			setNewsItemData({
				type: 'primary', data: 'x', time: 222, link: 'new-key',
			}, item);
			newsBody.append(item);

			pruneStaleNewsRead();

			// Since only stale item, should remove key entirely
			const stored = localStorage.getItem('news_items_read');
			expect(stored).toBeFalsy();
		});
	});
});
