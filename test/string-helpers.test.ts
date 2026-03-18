import {describe, it, expect} from 'vitest';
import {pluralize} from '../src/string-helpers';

describe('string-helpers', () => {
	describe('pluralize', () => {
		it('returns singular for count of 1', () => {
			expect(pluralize(1, 'day')).toBe('1 day');
			expect(pluralize(1, 'hour')).toBe('1 hour');
			expect(pluralize(1, 'minute')).toBe('1 minute');
			expect(pluralize(1, 'second')).toBe('1 second');
		});

		it('returns plural for count of 0', () => {
			expect(pluralize(0, 'day')).toBe('0 days');
			expect(pluralize(0, 'hour')).toBe('0 hours');
		});

		it('returns plural for count > 1', () => {
			expect(pluralize(2, 'day')).toBe('2 days');
			expect(pluralize(100, 'second')).toBe('100 seconds');
		});

		it('uses default plural (singular + "s")', () => {
			expect(pluralize(2, 'cat')).toBe('2 cats');
			expect(pluralize(1, 'cat')).toBe('1 cat');
		});

		it('uses custom plural when provided', () => {
			expect(pluralize(1, 'ox', 'oxen')).toBe('1 ox');
			expect(pluralize(2, 'ox', 'oxen')).toBe('2 oxen');
			expect(pluralize(0, 'ox', 'oxen')).toBe('0 oxen');
		});
	});
});
