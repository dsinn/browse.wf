/**
 * Unit tests for src/teshin/index.ts.
 *
 * Covers: one row per offer (8, matching upstream's teshinOffer.length), 6 appearance
 * columns per row, and correct appearance-date math (each offer appears every 8 weeks
 * starting from its rotation index).
 */
import {
	describe, test, expect, vi, afterEach,
} from 'vitest';
import {renderTeshinForecastHeader, renderTeshinForecastTable} from './index.js';

afterEach(() => {
	vi.useRealTimers();
});

describe('renderTeshinForecastHeader', () => {
	test('renders an Offer column plus 6 appearance columns', () => {
		const theadRow = document.createElement('tr');
		renderTeshinForecastHeader(theadRow);
		expect(theadRow.querySelectorAll('th')).toHaveLength(7);
		expect(theadRow.querySelectorAll('th')[0].textContent).toBe('Offer');
	});
});

describe('renderTeshinForecastTable', () => {
	function render(nowMs: number) {
		vi.useFakeTimers();
		vi.setSystemTime(nowMs);
		const tbody = document.createElement('tbody');
		renderTeshinForecastTable(tbody);
		return tbody;
	}

	test('renders one row per offer (8 rows)', () => {
		const tbody = render(Date.UTC(2026, 0, 1));
		expect(tbody.querySelectorAll('tr')).toHaveLength(8);
	});

	test('each row has an offer name plus 6 appearance date columns', () => {
		const tbody = render(Date.UTC(2026, 0, 1));
		for (const tr of tbody.querySelectorAll('tr')) {
			expect(tr.querySelectorAll('td')).toHaveLength(7);
		}
	});

	test('at EPOCH week 0, rows start with the active offer (index 0) in upstream order', () => {
		const tbody = render(1_736_121_600_000);
		const rows = tbody.querySelectorAll('tr');
		expect(rows[0].querySelectorAll('td')[0].textContent).toBe('Umbra Forma Blueprint');
		expect(rows[1].querySelectorAll('td')[0].textContent).toBe('50,000x Kuva');
		expect(rows[7].querySelectorAll('td')[0].textContent).toBe('Shotgun Riven Mod');
	});

	test('the currently active offer is always the top row, rotation order preserved after it', () => {
		// Week 3 from EPOCH: teshinOffer[3] ("3x Forma") is active this week.
		const weekMs = 1_736_121_600_000 + (3 * 604_800_000);
		const tbody = render(weekMs);
		const rows = tbody.querySelectorAll('tr');
		expect(rows[0].querySelectorAll('td')[0].textContent).toBe('3x Forma');
		expect(rows[1].querySelectorAll('td')[0].textContent).toBe('Zaw Riven Mod');
		expect(rows[4].querySelectorAll('td')[0].textContent).toBe('Shotgun Riven Mod');
		// Wraps back to the start of teshinOffer
		expect(rows[5].querySelectorAll('td')[0].textContent).toBe('Umbra Forma Blueprint');
		expect(rows[7].querySelectorAll('td')[0].textContent).toBe('Kitgun Riven Mod');
	});

	test('first appearance column is the current week for the active offer', () => {
		// At EPOCH (week 0), teshinOffer[0] ("Umbra Forma Blueprint") is the active offer
		const tbody = render(1_736_121_600_000);
		const firstRowCells = tbody.querySelectorAll('tr')[0].querySelectorAll('td');
		expect(firstRowCells[1].textContent).toBe(new Date(1_736_121_600_000).toLocaleDateString('en', {month: 'short', day: 'numeric'}));
	});

	test('successive appearance columns are 8 weeks (56 days) apart', () => {
		const tbody = render(1_736_121_600_000);
		const firstRowCells = tbody.querySelectorAll('tr')[0].querySelectorAll('td');
		const firstAppearanceMs = 1_736_121_600_000;
		const secondAppearanceMs = firstAppearanceMs + (8 * 604_800_000);
		expect(firstRowCells[2].textContent).toBe(new Date(secondAppearanceMs).toLocaleDateString('en', {month: 'short', day: 'numeric'}));
	});

	test('an offer not active this week shows its next upcoming appearance first', () => {
		// At EPOCH, teshinOffer[7] ("Shotgun Riven Mod") last appeared 1 week before EPOCH and
		// next appears 7 weeks after EPOCH.
		const tbody = render(1_736_121_600_000);
		const lastRowCells = tbody.querySelectorAll('tr')[7].querySelectorAll('td');
		const nextAppearanceMs = 1_736_121_600_000 + (7 * 604_800_000);
		expect(lastRowCells[1].textContent).toBe(new Date(nextAppearanceMs).toLocaleDateString('en', {month: 'short', day: 'numeric'}));
	});
});
