/**
 * Unit tests for src/card-filters.ts
 */
import {
	describe, test, expect, beforeEach, vi,
} from 'vitest';
import {loadFixture} from '@test/helpers/fixture-loader';
import {initializeCardFilters} from './card-filters';

describe('initializeCardFilters', () => {
	beforeEach(() => {
		localStorage.clear();
		document.body.innerHTML = loadFixture('live');
	});

	test('persists unchecked state to localStorage', () => {
		initializeCardFilters('news', vi.fn<() => void>());

		const panel = document.querySelector('#news-filters');
		const checkbox = panel?.querySelector<HTMLInputElement>('[data-filter-type]');
		const filterType = checkbox?.dataset.filterType;

		checkbox!.checked = false;
		checkbox!.dispatchEvent(new Event('change'));

		expect(localStorage.getItem(`live.filter.news.${filterType}`)).toBe('0');
	});

	test('persists checked state to localStorage', () => {
		initializeCardFilters('news', vi.fn<() => void>());

		const panel = document.querySelector('#news-filters');
		const checkbox = panel?.querySelector<HTMLInputElement>('[data-filter-type]');
		const filterType = checkbox?.dataset.filterType;

		checkbox!.checked = false;
		checkbox!.dispatchEvent(new Event('change'));
		checkbox!.checked = true;
		checkbox!.dispatchEvent(new Event('change'));

		expect(localStorage.getItem(`live.filter.news.${filterType}`)).toBe('1');
	});

	test('invokes callback on checkbox change', () => {
		const onFilterChange = vi.fn<() => void>();
		initializeCardFilters('news', onFilterChange);

		const panel = document.querySelector('#news-filters');
		const checkbox = panel?.querySelector<HTMLInputElement>('[data-filter-type]');

		checkbox!.dispatchEvent(new Event('change'));

		expect(onFilterChange).toHaveBeenCalledOnce();
	});

	test('omitting callback does not throw on checkbox change', () => {
		initializeCardFilters('calendar-season');

		const panel = document.querySelector('#calendar-season-filters');
		const checkbox = panel?.querySelector<HTMLInputElement>('[data-filter-type]');

		expect(() => checkbox!.dispatchEvent(new Event('change'))).not.toThrow();
	});
});
