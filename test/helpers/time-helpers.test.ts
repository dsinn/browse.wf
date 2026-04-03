import {describe, it, expect} from 'vitest';
import {getDaysInMonth, localDateToUtcDayTimestamp} from '../../src/helpers/time-helpers';

const SECONDS_PER_DAY = 86_400;

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
});
