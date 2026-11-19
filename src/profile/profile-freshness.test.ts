import {
	describe,
	it,
	expect,
	beforeEach,
	afterEach,
	vi,
} from 'vitest';
import {MILLIS_PER_DAY} from '../helpers/time-helpers';
import {
	PROFILE_TIMESTAMP_STORAGE_KEY,
	describeDailyReset,
	getProfileFetchedAt,
	isProfileFromToday,
} from './profile-freshness';

// 2026-11-13 12:00:00 UTC
const NOW = Date.UTC(2026, 10, 13, 12);
const START_OF_DAY = Date.UTC(2026, 10, 13);

describe('profile freshness', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	describe('getProfileFetchedAt', () => {
		it('returns undefined when nothing is stored', () => {
			expect(getProfileFetchedAt()).toBeUndefined();
		});

		it('returns undefined for a non-numeric value', () => {
			localStorage.setItem(PROFILE_TIMESTAMP_STORAGE_KEY, 'yesterday');
			expect(getProfileFetchedAt()).toBeUndefined();
		});

		it('returns the stored time', () => {
			localStorage.setItem(PROFILE_TIMESTAMP_STORAGE_KEY, String(NOW));
			expect(getProfileFetchedAt()).toBe(NOW);
		});
	});

	describe('isProfileFromToday', () => {
		it('is false when the fetch time is unknown', () => {
			expect(isProfileFromToday(NOW)).toBe(false);
		});

		it('is true for a fetch earlier on the same UTC day', () => {
			localStorage.setItem(PROFILE_TIMESTAMP_STORAGE_KEY, String(START_OF_DAY + 1000));
			expect(isProfileFromToday(NOW)).toBe(true);
		});

		it('is true for a fetch exactly at 00:00 UTC', () => {
			localStorage.setItem(PROFILE_TIMESTAMP_STORAGE_KEY, String(START_OF_DAY));
			expect(isProfileFromToday(NOW)).toBe(true);
		});

		it('is false for a fetch just before 00:00 UTC, even if it was minutes ago', () => {
			localStorage.setItem(PROFILE_TIMESTAMP_STORAGE_KEY, String(START_OF_DAY - 1));
			expect(isProfileFromToday(START_OF_DAY + 60_000)).toBe(false);
		});

		it('is false for a fetch from a previous day', () => {
			localStorage.setItem(PROFILE_TIMESTAMP_STORAGE_KEY, String(NOW - MILLIS_PER_DAY));
			expect(isProfileFromToday(NOW)).toBe(false);
		});
	});
});

describe('describeDailyReset', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('gives the next 00:00 UTC as a time of day in the local time zone', () => {
		const nextReset = new Date(Date.UTC(2026, 10, 14)).toLocaleTimeString(undefined, {
			hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
		});

		expect(describeDailyReset()).toBe(`Resets daily at ${nextReset}.`);
	});

	it('includes the time zone, so the time is unambiguous', () => {
		expect(describeDailyReset()).toMatch(/at \d{1,2}:\d{2}.*[A-Z]/u);
	});
});
