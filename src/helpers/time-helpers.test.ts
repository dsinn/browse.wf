import {
	describe, it, expect, vi, afterEach,
} from 'vitest';
import timezoneMock from 'timezone-mock';
import {
	getDaysInMonth,
	localDateToUtcDayTimestamp,
	getNextDailyResetMs,
	getNextWeeklyResetMs,
	getNextWeeklyResetSeconds,
	getWeekIndex,
	SECONDS_PER_DAY,
	MILLIS_PER_WEEK,
} from './time-helpers';

describe('time-helpers', () => {
	describe('getDaysInMonth', () => {
		it('returns 31 for January', () => {
			expect(getDaysInMonth(new Date(2025, 0, 1))).toBe(31);
		});

		it('returns 28 for February in a non-leap year', () => {
			expect(getDaysInMonth(new Date(2025, 1, 1))).toBe(28);
		});

		it('returns 29 for February in a leap year', () => {
			expect(getDaysInMonth(new Date(2024, 1, 1))).toBe(29);
		});

		it('returns 30 for April', () => {
			expect(getDaysInMonth(new Date(2025, 3, 1))).toBe(30);
		});

		it('returns 31 for December', () => {
			expect(getDaysInMonth(new Date(2025, 11, 1))).toBe(31);
		});
	});

	describe('localDateToUtcDayTimestamp', () => {
		it('converts a local date to a UTC day timestamp in seconds', () => {
			const date = new Date(2025, 0, 13); // Jan 13, 2025 local
			expect(localDateToUtcDayTimestamp(date)).toBe(Date.UTC(2025, 0, 13) / 1000);
		});

		it('returns a multiple of 86400', () => {
			const date = new Date(2025, 5, 15);
			expect(localDateToUtcDayTimestamp(date) % SECONDS_PER_DAY).toBe(0);
		});
	});

	describe('getNextDailyResetMs', () => {
		afterEach(() => {
			vi.useRealTimers();
			timezoneMock.unregister();
		});

		it('one millisecond before midnight returns the next midnight', () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2026-04-11T23:59:59.999Z'));
			expect(getNextDailyResetMs()).toBe(new Date('2026-04-12T00:00:00Z').getTime());
		});

		it('exactly on midnight returns the following midnight', () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2026-04-12T00:00:00.000Z'));
			expect(getNextDailyResetMs()).toBe(new Date('2026-04-13T00:00:00Z').getTime());
		});

		it('one millisecond after midnight returns the following midnight', () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2026-04-12T00:00:00.001Z'));
			expect(getNextDailyResetMs()).toBe(new Date('2026-04-13T00:00:00Z').getTime());
		});

		it('is unaffected by local DST (summer, UTC-4)', () => {
			timezoneMock.register('US/Eastern');
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2026-07-15T15:30:00Z')); // EDT: 11:30 local
			expect(getNextDailyResetMs()).toBe(new Date('2026-07-16T00:00:00Z').getTime());
		});

		it('is unaffected by local DST (winter, UTC-5)', () => {
			timezoneMock.register('US/Eastern');
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2026-01-15T15:30:00Z')); // EST: 10:30 local
			expect(getNextDailyResetMs()).toBe(new Date('2026-01-16T00:00:00Z').getTime());
		});
	});

	describe('getNextWeeklyResetMs', () => {
		afterEach(() => {
			vi.useRealTimers();
			timezoneMock.unregister();
		});

		it('one millisecond before Monday midnight returns that Monday', () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2026-04-12T23:59:59.999Z')); // Sunday
			expect(getNextWeeklyResetMs()).toBe(new Date('2026-04-13T00:00:00Z').getTime());
		});

		it('exactly on Monday midnight returns the following Monday', () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2026-04-13T00:00:00.000Z'));
			expect(getNextWeeklyResetMs()).toBe(new Date('2026-04-20T00:00:00Z').getTime());
		});

		it('one millisecond after Monday midnight returns the following Monday', () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2026-04-13T00:00:00.001Z'));
			expect(getNextWeeklyResetMs()).toBe(new Date('2026-04-20T00:00:00Z').getTime());
		});

		it('is unaffected by local DST (summer, UTC-4)', () => {
			timezoneMock.register('US/Eastern');
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2026-07-11T10:00:00Z')); // Saturday, EDT: 06:00 local
			expect(getNextWeeklyResetMs()).toBe(new Date('2026-07-13T00:00:00Z').getTime());
		});

		it('is unaffected by local DST (winter, UTC-5)', () => {
			timezoneMock.register('US/Eastern');
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2026-01-10T10:00:00Z')); // Saturday, EST: 05:00 local
			expect(getNextWeeklyResetMs()).toBe(new Date('2026-01-12T00:00:00Z').getTime());
		});
	});

	describe('getNextWeeklyResetSeconds', () => {
		afterEach(() => {
			vi.useRealTimers();
		});

		it('returns getNextWeeklyResetMs divided by 1000', () => {
			vi.useFakeTimers();
			expect(getNextWeeklyResetSeconds()).toBe(getNextWeeklyResetMs() / 1000);
		});
	});

	describe('getWeekIndex', () => {
		it('returns consecutive indices for three consecutive weeks', () => {
			expect(getWeekIndex(Date.UTC(2026, 0, 5))).toBe(621);
			expect(getWeekIndex(Date.UTC(2026, 0, 5) + MILLIS_PER_WEEK)).toBe(622);
			expect(getWeekIndex(Date.UTC(2026, 0, 5) + (2 * MILLIS_PER_WEEK))).toBe(623);
		});
	});
});
