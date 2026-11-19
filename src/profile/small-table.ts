/**
 Small tables for the profile Stats > Overview sections: compact and only as wide as their content, with text in
 the first column and numbers (or dates) in the others.
 */

import {NO_VALUE_TEXT} from './no-value.js';

/**
 Builds the table. Cells given as undefined show a placeholder.
 */
export function createTable(headers: string[], rows: Array<Array<string | undefined>>): HTMLTableElement {
	const table = document.createElement('table');
	table.className = 'table table-sm w-auto';

	const headerRow = document.createElement('tr');
	for (const [index, header] of headers.entries()) {
		const cell = document.createElement('th');
		cell.textContent = header;
		cell.className = index === 0 ? 'text-nowrap' : 'text-end text-nowrap';
		headerRow.append(cell);
	}

	const thead = document.createElement('thead');
	thead.append(headerRow);

	const tbody = document.createElement('tbody');
	for (const row of rows) {
		const tr = document.createElement('tr');
		for (const [index, value] of row.entries()) {
			const cell = document.createElement('td');
			cell.textContent = value ?? NO_VALUE_TEXT;
			cell.className = [index === 0 ? '' : 'text-end', value === undefined ? 'text-body-secondary' : ''].join(' ').trim();
			tr.append(cell);
		}

		tbody.append(tr);
	}

	table.append(thead, tbody);
	return table;
}
