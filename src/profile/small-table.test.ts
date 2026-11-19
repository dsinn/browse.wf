import {describe, it, expect} from 'vitest';
import {NO_VALUE_TEXT} from './no-value';
import {createTable} from './small-table';

const text = (table: HTMLTableElement) => [...table.querySelectorAll('tr')].map(row => [...row.cells].map(cell => cell.textContent));

describe('createTable', () => {
	it('builds a header row and a row per entry', () => {
		const table = createTable(['Name', 'Count'], [['a', '1'], ['b', '2']]);

		expect(text(table)).toEqual([['Name', 'Count'], ['a', '1'], ['b', '2']]);
	});

	it('shows a placeholder for an undefined cell', () => {
		const table = createTable(['Name', 'Count'], [['a', undefined]]);
		const cell = table.querySelectorAll('td')[1];

		expect(cell.textContent).toBe(NO_VALUE_TEXT);
	});
});
