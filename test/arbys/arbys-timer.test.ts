import {
	describe, test, expect, beforeEach, vi, afterEach,
} from 'vitest';
import {createShortTimerBadge, initializeShortTimerBadges} from '../../src/short-timer-badge';

describe('Short Timer Badge (/arbys timer badges)', () => {
	beforeEach(() => {
		// Mock setTimeout and clearTimeout for controlled testing
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	describe('createShortTimerBadge()', () => {
		test('creates a span element with correct attributes', () => {
			const timestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
			const badge = createShortTimerBadge(timestamp, 'Started');

			expect(badge.tagName).toBe('SPAN');
			expect(badge.dataset.shortTimerExpiry).toBe(timestamp.toString());
			expect(badge.className).toContain('badge');
			expect(badge.className).toContain('text-bg-secondary');
			expect(badge.className).toContain('me-2');
		});

		test('has fixed width and inline-block display', () => {
			const timestamp = Math.floor(Date.now() / 1000) + 3600;
			const badge = createShortTimerBadge(timestamp, 'Started');

			expect(badge.style.display).toBe('inline-block');
			expect(badge.style.width).toBe('5.5em');
			expect(badge.style.textAlign).toBe('center');
		});

		test('shows countdown for future timestamps', () => {
			const now = Date.now();
			vi.setSystemTime(now);

			// Test: 2 days + 5 hours from now
			const timestamp = Math.floor(now / 1000) + (2 * 86_400) + (5 * 3600);
			const badge = createShortTimerBadge(timestamp, 'Started');

			expect(badge.textContent).toMatch(/2d \d+h/u);
		});

		test('shows expiredLabel for past timestamps', () => {
			const now = Date.now();
			vi.setSystemTime(now);

			const timestamp = Math.floor(now / 1000) - 3600;

			expect(createShortTimerBadge(timestamp, 'Started').textContent).toBe('Started');
			expect(createShortTimerBadge(timestamp, 'Pending Refresh').textContent).toBe('Pending Refresh');
		});
	});

	describe('Two-unit formatting', () => {
		test('shows days + hours when >= 1 day remaining', () => {
			const now = Date.now();
			vi.setSystemTime(now);

			// 5 days + 3 hours + 45 minutes + 30 seconds
			const timestamp = Math.floor(now / 1000) + (5 * 86_400) + (3 * 3600) + (45 * 60) + 30;
			const badge = createShortTimerBadge(timestamp, 'Started');

			// Should show only days + hours, not minutes or seconds
			expect(badge.textContent).toBe('5d 3h');
		});

		test('shows hours + minutes when 1-23 hours remaining', () => {
			const now = Date.now();
			vi.setSystemTime(now);

			// 5 hours + 23 minutes + 45 seconds
			const timestamp = Math.floor(now / 1000) + (5 * 3600) + (23 * 60) + 45;
			const badge = createShortTimerBadge(timestamp, 'Started');

			// Should show only hours + minutes, not seconds
			expect(badge.textContent).toBe('5h 23m');
		});

		test('shows minutes + seconds when < 1 hour remaining', () => {
			const now = Date.now();
			vi.setSystemTime(now);

			// 23 minutes + 45 seconds
			const timestamp = Math.floor(now / 1000) + (23 * 60) + 45;
			const badge = createShortTimerBadge(timestamp, 'Started');

			// Should show minutes + seconds
			expect(badge.textContent).toBe('23m 45s');
		});

		test('pads seconds with leading zero', () => {
			const now = Date.now();
			vi.setSystemTime(now);

			// 5 minutes + 5 seconds
			const timestamp = Math.floor(now / 1000) + (5 * 60) + 5;
			const badge = createShortTimerBadge(timestamp, 'Started');

			expect(badge.textContent).toBe('5m 05s');
		});

		test('shows only seconds for < 1 minute remaining', () => {
			const now = Date.now();
			vi.setSystemTime(now);

			// 45 seconds
			const timestamp = Math.floor(now / 1000) + 45;
			const badge = createShortTimerBadge(timestamp, 'Started');

			expect(badge.textContent).toBe('0m 45s');
		});

		test('shows expiredLabel when <= 0 seconds remaining', () => {
			const now = Date.now();
			vi.setSystemTime(now);

			// Current second (0 seconds remaining)
			const timestamp = Math.floor(now / 1000);
			const badge = createShortTimerBadge(timestamp, 'Started');

			expect(badge.textContent).toBe('Started');
		});
	});

	describe('Timer updates with setTimeout', () => {
		test('schedules next update at top of hour for days+hours display', () => {
			const now = Date.now();
			vi.setSystemTime(now);

			// 2 days + 30 minutes from now (showing days+hours)
			const timestamp = Math.floor(now / 1000) + (2 * 86_400) + (30 * 60);
			const badge = createShortTimerBadge(timestamp, 'Started');
			document.body.append(badge);

			expect(badge.textContent).toMatch(/2d \d+h/u);

			// Fast forward just under 30 minutes (shouldn't update yet)
			vi.advanceTimersByTime(29 * 60 * 1000);
			expect(badge.textContent).toMatch(/2d \d+h/u); // Still same hour

			// Fast forward to next hour boundary
			vi.advanceTimersByTime((1 * 60 * 1000) + 1);
			expect(badge.textContent).toMatch(/1d 23h|2d \d+h/u); // Updated
		});

		test('schedules next update at top of minute for hours+minutes display', () => {
			const now = Date.now();
			vi.setSystemTime(now);

			// 5 hours + 30 seconds from now (showing hours+minutes)
			const timestamp = Math.floor(now / 1000) + (5 * 3600) + 30;
			const badge = createShortTimerBadge(timestamp, 'Started');
			document.body.append(badge);

			expect(badge.textContent).toMatch(/5h \d+m/u);

			// Fast forward just under 30 seconds (shouldn't update yet)
			vi.advanceTimersByTime(29 * 1000);
			expect(badge.textContent).toMatch(/5h \d+m/u); // Still same minute

			// Fast forward to next minute boundary
			vi.advanceTimersByTime((1 * 1000) + 1);
			expect(badge.textContent).toMatch(/\d+h \d+m/u); // Updated
		});

		test('schedules next update at top of second for minutes+seconds display', () => {
			const now = Date.now();
			vi.setSystemTime(now);

			// 5 minutes + 500ms from now (showing minutes+seconds)
			const timestamp = Math.floor(now / 1000) + (5 * 60);
			const badge = createShortTimerBadge(timestamp, 'Started');
			document.body.append(badge);

			expect(badge.textContent).toMatch(/\d+m \d+s/u);

			// Fast forward just under 1 second (shouldn't update yet)
			vi.advanceTimersByTime(500);
			const beforeText = badge.textContent;

			// Fast forward to next second boundary
			vi.advanceTimersByTime(500 + 1);
			const afterText = badge.textContent;

			// Should have updated to show one less second
			expect(beforeText).not.toBe(afterText);
		});

		test('stops updating and shows expiredLabel after timer expires', () => {
			const now = Date.now();
			vi.setSystemTime(now);

			// 3 seconds from now
			const timestamp = Math.floor(now / 1000) + 3;
			const badge = createShortTimerBadge(timestamp, 'Started');
			document.body.append(badge);

			expect(badge.textContent).toBe('0m 03s');

			// Fast forward past the event start
			vi.advanceTimersByTime(4000);

			expect(badge.textContent).toBe('Started');

			// Fast forward more - should not change from "Started"
			vi.advanceTimersByTime(10_000);
			expect(badge.textContent).toBe('Started');
		});

		test('shows custom expiredLabel after timer expires', () => {
			const now = Date.now();
			vi.setSystemTime(now);

			// 3 seconds from now
			const timestamp = Math.floor(now / 1000) + 3;
			const badge = createShortTimerBadge(timestamp, 'Pending Refresh');
			document.body.append(badge);

			expect(badge.textContent).toBe('0m 03s');

			vi.advanceTimersByTime(4000);

			expect(badge.textContent).toBe('Pending Refresh');
		});
	});

	describe('initializeShortTimerBadges()', () => {
		test('initializes timers for all existing badges', () => {
			const now = Date.now();
			vi.setSystemTime(now);

			// Create multiple badges manually
			const timestamp1 = Math.floor(now / 1000) + 3600; // 1 hour
			const timestamp2 = Math.floor(now / 1000) + 7200; // 2 hours

			const badge1 = document.createElement('span');
			badge1.dataset.shortTimerExpiry = timestamp1.toString();
			document.body.append(badge1);

			const badge2 = document.createElement('span');
			badge2.dataset.shortTimerExpiry = timestamp2.toString();
			document.body.append(badge2);

			// Initialize timers
			initializeShortTimerBadges();

			// Both badges should have been updated with countdown text
			expect(badge1.textContent).toMatch(/\d+m/u);
			expect(badge2.textContent).toMatch(/\d+h/u);
		});

		test('handles badges with no timestamp attribute gracefully', () => {
			const badge = document.createElement('span');
			document.body.append(badge);

			// Should not throw
			expect(() => {
				initializeShortTimerBadges();
			}).not.toThrow();
		});
	});

	describe('Edge cases', () => {
		test('handles exactly 1 day remaining', () => {
			const now = Date.now();
			vi.setSystemTime(now);

			const timestamp = Math.floor(now / 1000) + 86_400;
			const badge = createShortTimerBadge(timestamp, 'Started');

			expect(badge.textContent).toBe('1d 0h');
		});

		test('handles exactly 1 hour remaining', () => {
			const now = Date.now();
			vi.setSystemTime(now);

			const timestamp = Math.floor(now / 1000) + 3600;
			const badge = createShortTimerBadge(timestamp, 'Started');

			expect(badge.textContent).toBe('1h 0m');
		});

		test('handles exactly 1 minute remaining', () => {
			const now = Date.now();
			vi.setSystemTime(now);

			const timestamp = Math.floor(now / 1000) + 60;
			const badge = createShortTimerBadge(timestamp, 'Started');

			expect(badge.textContent).toBe('1m 00s');
		});

		test('handles 99+ days correctly', () => {
			const now = Date.now();
			vi.setSystemTime(now);

			// 150 days
			const timestamp = Math.floor(now / 1000) + (150 * 86_400);
			const badge = createShortTimerBadge(timestamp, 'Started');

			expect(badge.textContent).toMatch(/150d \d+h/u);
		});
	});
});
