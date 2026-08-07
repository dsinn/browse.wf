import {
	describe, it, expect, vi, afterEach,
} from 'vitest';
import timezoneMock from 'timezone-mock';
import {
	getCycleWindows,
	formatWindow,
	getDayBucket,
	formatDayHeading,
	groupWindowsByDay,
	isWindowPast,
	isWindowActive,
	getNextBoundary,
	addCalendarDays,
	PERIOD_MS,
	NIGHT_MS,
	EPOCH_EXPIRY,
	MAX_WINDOWS_PER_DAY,
	type CycleWindow,
} from '../src/bounty-cycle-schedule';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

describe('bounty-cycle-schedule', () => {
	describe('getCycleWindows', () => {
		it('returns windows for the requested phase only, each with the expected duration', () => {
			const from = EPOCH_EXPIRY;
			const nightWindows = getCycleWindows('night', from, WEEK_MS);
			const dayWindows = getCycleWindows('day', from, WEEK_MS);

			expect(nightWindows.length).toBeGreaterThan(0);
			expect(dayWindows.length).toBeGreaterThan(0);

			for (const w of nightWindows) {
				expect(w.end - w.start).toBe(NIGHT_MS);
			}

			for (const w of dayWindows) {
				expect(w.end - w.start).toBeCloseTo(PERIOD_MS - NIGHT_MS, 0);
			}
		});

		it('produces roughly one window per period across a week', () => {
			const from = EPOCH_EXPIRY;
			const windows = getCycleWindows('night', from, WEEK_MS);
			const expectedCount = WEEK_MS / PERIOD_MS;
			expect(windows.length).toBeGreaterThanOrEqual(Math.floor(expectedCount) - 1);
			expect(windows.length).toBeLessThanOrEqual(Math.ceil(expectedCount) + 1);
		});

		it('all returned window starts fall within [from, from + spanMs]', () => {
			const from = EPOCH_EXPIRY + 12_345;
			const span = WEEK_MS;
			const windows = getCycleWindows('night', from, span);
			for (const w of windows) {
				expect(w.start).toBeGreaterThanOrEqual(from);
				expect(w.start).toBeLessThanOrEqual(from + span);
			}
		});

		it('night and day windows for the same cycle are exactly complementary (no gap/overlap)', () => {
			const from = EPOCH_EXPIRY;
			const nightWindows = getCycleWindows('night', from, WEEK_MS);
			const dayWindows = getCycleWindows('day', from, WEEK_MS);

			// Every night window's start should equal some day window's end (same cycle boundary).
			const dayEnds = new Set(dayWindows.map(w => Math.round(w.end)));
			for (const nightWindow of nightWindows) {
				expect(dayEnds.has(Math.round(nightWindow.start))).toBe(true);
			}
		});

		it('windows are in chronological order', () => {
			const windows = getCycleWindows('night', EPOCH_EXPIRY, WEEK_MS);
			for (let i = 1; i < windows.length; i++) {
				expect(windows[i].start).toBeGreaterThan(windows[i - 1].start);
			}
		});
	});

	describe('formatWindow', () => {
		it('formats as HH:MM–HH:MM with an en dash, two-digit leading-zero hours, in UTC', () => {
			const window: CycleWindow = {
				start: Date.UTC(2026, 0, 1, 3, 5),
				end: Date.UTC(2026, 0, 1, 4, 15),
			};
			expect(formatWindow(window, 'utc')).toBe('03:05–04:15');
		});

		it('pads midnight hour as 00', () => {
			const window: CycleWindow = {start: Date.UTC(2026, 0, 1, 0, 9), end: Date.UTC(2026, 0, 1, 0, 59)};
			expect(formatWindow(window, 'utc')).toBe('00:09–00:59');
		});

		it('defaults to 24-hour format when hourFormat is omitted', () => {
			const window: CycleWindow = {start: Date.UTC(2026, 0, 1, 13, 5), end: Date.UTC(2026, 0, 1, 14, 15)};
			expect(formatWindow(window, 'utc')).toBe('13:05–14:15');
		});

		it('formats as military time with a Z suffix in UTC', () => {
			const window: CycleWindow = {start: Date.UTC(2026, 0, 1, 3, 5), end: Date.UTC(2026, 0, 1, 14, 15)};
			expect(formatWindow(window, 'utc', 'mil')).toBe('0305Z–1415Z');
		});

		it('formats as military time without a Z suffix in local time', () => {
			const start = new Date(2026, 0, 1, 3, 5).getTime();
			const end = new Date(2026, 0, 1, 14, 15).getTime();
			const window: CycleWindow = {start, end};
			expect(formatWindow(window, 'local', 'mil')).toBe('0305–1415');
		});

		it('formats as 12-hour time with am/pm', () => {
			const window: CycleWindow = {
				start: Date.UTC(2026, 0, 1, 0, 5),
				end: Date.UTC(2026, 0, 1, 12, 0),
			};
			expect(formatWindow(window, 'utc', '12')).toBe('12:05am–12:00pm');
		});

		it('formats 12-hour time correctly for standard afternoon and morning hours', () => {
			const afternoon: CycleWindow = {start: Date.UTC(2026, 0, 1, 13, 30), end: Date.UTC(2026, 0, 1, 15, 0)};
			expect(formatWindow(afternoon, 'utc', '12')).toBe('01:30pm–03:00pm');

			const morning: CycleWindow = {start: Date.UTC(2026, 0, 1, 9, 0), end: Date.UTC(2026, 0, 1, 11, 45)};
			expect(formatWindow(morning, 'utc', '12')).toBe('09:00am–11:45am');
		});

		it('zero-pads the leading hour in 12-hour format (no bare single digit)', () => {
			const window: CycleWindow = {start: Date.UTC(2026, 0, 1, 3, 0), end: Date.UTC(2026, 0, 1, 4, 0)};
			expect(formatWindow(window, 'utc', '12')).toBe('03:00am–04:00am');
		});
	});

	describe('getDayBucket', () => {
		it('returns UTC midnight for a UTC timestamp', () => {
			const timestamp = Date.UTC(2026, 7, 7, 23, 59);
			expect(getDayBucket(timestamp, 'utc')).toBe(Date.UTC(2026, 7, 7));
		});

		it('returns local midnight for a local timestamp', () => {
			const date = new Date(2026, 7, 7, 23, 59);
			expect(getDayBucket(date.getTime(), 'local')).toBe(new Date(2026, 7, 7).getTime());
		});
	});

	describe('formatDayHeading', () => {
		it('formats as "Day, Mon D"', () => {
			const dayBucket = Date.UTC(2026, 7, 7); // Friday
			expect(formatDayHeading(dayBucket, 'utc')).toMatch(/^[A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2}$/u);
		});
	});

	describe('groupWindowsByDay', () => {
		it('creates exactly dayCount buckets, including empty ones', () => {
			const startDayBucket = Date.UTC(2026, 7, 7);
			const grouped = groupWindowsByDay([], startDayBucket, 7, 'utc');
			expect(grouped.size).toBe(7);
			for (const windows of grouped.values()) {
				expect(windows).toEqual([]);
			}
		});

		it('buckets a window by its start day', () => {
			const startDayBucket = Date.UTC(2026, 7, 7);
			const window: CycleWindow = {
				start: Date.UTC(2026, 7, 8, 3, 0),
				end: Date.UTC(2026, 7, 8, 3, 50),
			};
			const grouped = groupWindowsByDay([window], startDayBucket, 7, 'utc');
			expect(grouped.get(Date.UTC(2026, 7, 8))).toEqual([window]);
			expect(grouped.get(Date.UTC(2026, 7, 7))).toEqual([]);
		});

		it('keeps a window that crosses midnight in its start day bucket', () => {
			const startDayBucket = Date.UTC(2026, 7, 7);
			const window: CycleWindow = {
				start: Date.UTC(2026, 7, 7, 23, 40),
				end: Date.UTC(2026, 7, 8, 0, 30),
			};
			const grouped = groupWindowsByDay([window], startDayBucket, 7, 'utc');
			expect(grouped.get(Date.UTC(2026, 7, 7))).toEqual([window]);
			expect(grouped.get(Date.UTC(2026, 7, 8))).toEqual([]);
		});

		it('iterates buckets in ascending day order', () => {
			// `bounty-cycle-schedule-page.ts`'s dayColumns() zips this Map's iteration order 1:1
			// against header cells by position (day 0 -> header 0, etc.), relying on ascending
			// insertion order rather than checking dayBucket identity per cell. If this ordering
			// ever changes, that positional pairing would silently misrender.
			const startDayBucket = Date.UTC(2026, 7, 7);
			const grouped = groupWindowsByDay([], startDayBucket, 5, 'utc');
			const buckets = [...grouped.keys()];
			const sorted = [...buckets].sort((a, b) => a - b);
			expect(buckets).toEqual(sorted);
			expect(buckets).toEqual([
				Date.UTC(2026, 7, 7),
				Date.UTC(2026, 7, 8),
				Date.UTC(2026, 7, 9),
				Date.UTC(2026, 7, 10),
				Date.UTC(2026, 7, 11),
			]);
		});
	});

	describe('isWindowPast', () => {
		const window: CycleWindow = {start: 1000, end: 2000};

		it('is false for now at or before end (start - 1, start, midpoint, end)', () => {
			expect(isWindowPast(window, window.start - 1)).toBe(false);
			expect(isWindowPast(window, window.start)).toBe(false);
			expect(isWindowPast(window, (window.start + window.end) / 2)).toBe(false);
			expect(isWindowPast(window, window.end)).toBe(false);
		});

		it('is true for now strictly after end (end + 1)', () => {
			expect(isWindowPast(window, window.end + 1)).toBe(true);
		});
	});

	describe('isWindowActive', () => {
		it('is true when now falls strictly inside the window', () => {
			const window: CycleWindow = {start: 1000, end: 2000};
			expect(isWindowActive(window, 1500)).toBe(true);
		});

		it('is true when now equals the window start (inclusive)', () => {
			const window: CycleWindow = {start: 1000, end: 2000};
			expect(isWindowActive(window, 1000)).toBe(true);
		});

		it('is false when now equals the window end (exclusive)', () => {
			const window: CycleWindow = {start: 1000, end: 2000};
			expect(isWindowActive(window, 2000)).toBe(false);
		});

		it('is false when now is before the window starts', () => {
			const window: CycleWindow = {start: 1000, end: 2000};
			expect(isWindowActive(window, 999)).toBe(false);
		});

		it('is false when now is after the window ends', () => {
			const window: CycleWindow = {start: 1000, end: 2000};
			expect(isWindowActive(window, 2001)).toBe(false);
		});

		it('is mutually exclusive with isWindowPast for any given now', () => {
			const window: CycleWindow = {start: 1000, end: 2000};
			for (const now of [500, 1000, 1500, 1999, 2000, 2500]) {
				expect(isWindowActive(window, now) && isWindowPast(window, now)).toBe(false);
			}
		});
	});

	describe('cross-check against real worldState data', () => {
		afterEach(() => {
			vi.useRealTimers();
		});

		it('projects a window matching the known real cycle at EPOCH_EXPIRY', () => {
			const windows = getCycleWindows('night', EPOCH_EXPIRY - NIGHT_MS, 1);
			expect(windows).toHaveLength(1);
			expect(windows[0].start).toBe(EPOCH_EXPIRY - NIGHT_MS);
			expect(windows[0].end).toBe(EPOCH_EXPIRY);
		});
	});

	describe('getNextBoundary', () => {
		it('returns the night-window start when currently in a day phase, before the day boundary', () => {
			const nightStart = EPOCH_EXPIRY - NIGHT_MS;
			const now = nightStart - 60_000; // 1 minute before night starts
			const boundary = getNextBoundary(now, 'utc');
			expect(boundary).toBeLessThanOrEqual(nightStart);
		});

		it('returns the cycle expiry (night-window end) when currently in the night phase', () => {
			const nightStart = EPOCH_EXPIRY - NIGHT_MS;
			const now = nightStart + 60_000; // 1 minute into the night window
			const boundary = getNextBoundary(now, 'utc');
			expect(boundary).toBeLessThanOrEqual(EPOCH_EXPIRY);
			expect(boundary).toBeGreaterThan(now);
		});

		it('returns the next day rollover when it comes before the next phase transition', () => {
			// Choose `now` just before a UTC day boundary, far from any phase transition.
			const dayBucket = getDayBucket(EPOCH_EXPIRY, 'utc');
			const nextDayBucket = dayBucket + DAY_MS;
			const now = nextDayBucket - 60_000; // 1 minute before midnight UTC
			const boundary = getNextBoundary(now, 'utc');
			expect(boundary).toBeLessThanOrEqual(nextDayBucket);
			expect(boundary).toBeGreaterThan(now);
		});

		it('always returns a timestamp strictly after now', () => {
			const now = EPOCH_EXPIRY + 12_345;
			expect(getNextBoundary(now, 'utc')).toBeGreaterThan(now);
		});
	});

	describe('MAX_WINDOWS_PER_DAY', () => {
		it('is never exceeded by the actual render pipeline (getCycleWindows/groupWindowsByDay), over a 1-year span', () => {
			// MAX_WINDOWS_PER_DAY is a closed-form bound (Math.ceil(day length / period length)),
			// so its own value is correct by construction - what's worth verifying is that the
			// real window-generation functions the app calls never disagree with it in practice.
			// A year already cycles through every possible phase alignment relative to calendar
			// day boundaries, since the cycle period doesn't depend on the year.
			let maxObserved = 0;
			for (let dayIndex = 0; dayIndex < 365; dayIndex++) {
				const dayStart = EPOCH_EXPIRY + (dayIndex * DAY_MS);
				const dayBucket = getDayBucket(dayStart, 'utc');
				const windows = getCycleWindows('night', dayBucket, DAY_MS);
				const grouped = groupWindowsByDay(windows, dayBucket, 1, 'utc');
				const count = grouped.get(dayBucket)!.length;
				maxObserved = Math.max(maxObserved, count);
			}

			expect(maxObserved).toBeLessThanOrEqual(MAX_WINDOWS_PER_DAY);
		});
	});

	describe('addCalendarDays', () => {
		afterEach(() => {
			timezoneMock.unregister();
		});

		it('adds a fixed 24h in UTC mode', () => {
			const dayBucket = Date.UTC(2026, 7, 7);
			expect(addCalendarDays(dayBucket, 1, 'utc')).toBe(dayBucket + DAY_MS);
			expect(addCalendarDays(dayBucket, 3, 'utc')).toBe(dayBucket + (3 * DAY_MS));
		});

		it('lands on the correct next local midnight across a spring-forward DST transition', () => {
			timezoneMock.register('US/Eastern');
			// 2026-03-08 is the US spring-forward date (clocks skip 2am -> 3am at 2am local),
			// so the wall-clock-short day is Mar 8 -> Mar 9, not Mar 7 -> Mar 8.
			const march8 = getDayBucket(new Date(2026, 2, 8).getTime(), 'local');
			const march9 = addCalendarDays(march8, 1, 'local');
			expect(march9).toBe(new Date(2026, 2, 9).getTime());
			// The wall-clock gap is only 23 hours on the transition day, not 24.
			expect(march9 - march8).toBe(23 * 60 * 60 * 1000);
		});

		it('lands on the correct next local midnight across a fall-back DST transition', () => {
			timezoneMock.register('US/Eastern');
			// 2026-11-01 is the US fall-back date (clocks repeat 1am-2am at 2am local),
			// so the wall-clock-long day is Nov 1 -> Nov 2.
			const nov1 = getDayBucket(new Date(2026, 10, 1).getTime(), 'local');
			const nov2 = addCalendarDays(nov1, 1, 'local');
			expect(nov2).toBe(new Date(2026, 10, 2).getTime());
			// The wall-clock gap is 25 hours on the transition day, not 24.
			expect(nov2 - nov1).toBe(25 * 60 * 60 * 1000);
		});
	});

	describe('DST regression: groupWindowsByDay does not drop windows across a transition', () => {
		afterEach(() => {
			timezoneMock.unregister();
		});

		it('every day bucket in a week spanning spring-forward DST accumulates windows', () => {
			timezoneMock.register('US/Eastern');
			const startDayBucket = getDayBucket(new Date(2026, 2, 6).getTime(), 'local'); // Fri, before the Mar 8 transition
			const windows = getCycleWindows('night', startDayBucket, 7 * DAY_MS);
			const grouped = groupWindowsByDay(windows, startDayBucket, 7, 'local');

			expect(grouped.size).toBe(7);
			for (const [dayBucket, dayWindows] of grouped) {
				expect(dayWindows.length).toBeGreaterThan(0);
				// Every window assigned to this bucket must actually belong to it, per getDayBucket.
				for (const window of dayWindows) {
					expect(getDayBucket(window.start, 'local')).toBe(dayBucket);
				}
			}
		});
	});

	describe('DST regression: getNextBoundary times the day rollover correctly', () => {
		afterEach(() => {
			timezoneMock.unregister();
		});

		it('returns the true next local midnight, not now + 24h, on the spring-forward date', () => {
			timezoneMock.register('US/Eastern');
			// Pick a `now` late on Mar 8 (the transition day), far from any phase boundary,
			// so the day-rollover branch of getNextBoundary is what gets returned.
			const march8Midnight = new Date(2026, 2, 8).getTime();
			const now = march8Midnight + (20 * 60 * 60 * 1000); // 20h into a 23h-long local day
			const boundary = getNextBoundary(now, 'local');
			const trueNextMidnight = new Date(2026, 2, 9).getTime();

			// The naive `now + 24h` bug would return a timestamp still on Mar 8 wall-clock time
			// on the US Eastern spring-forward date, since that day is only 23 hours long.
			expect(boundary).toBeLessThanOrEqual(trueNextMidnight);
		});
	});
});
