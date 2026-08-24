/**
 * Unit tests for src/circuit/index.ts.
 *
 * Covers: forecast week count, rotation math (independent per column), and
 * dict-key-to-display-name resolution.
 */
import {
	describe, test, expect, vi, afterEach,
} from 'vitest';
import {getForecastWeekCount, renderCircuitForecastTable} from './index.js';

afterEach(() => {
	vi.useRealTimers();
});

describe('getForecastWeekCount', () => {
	test('returns the length of the longer choice list', () => {
		expect(getForecastWeekCount()).toBe(11);
	});
});

describe('renderCircuitForecastTable', () => {
	function render(nowMs: number) {
		vi.useFakeTimers();
		vi.setSystemTime(nowMs);
		const tbody = document.createElement('tbody');
		renderCircuitForecastTable(tbody, {});
		return tbody;
	}

	test('renders one row per forecast week', () => {
		const tbody = render(Date.UTC(2026, 0, 1));
		expect(tbody.querySelectorAll('tr')).toHaveLength(11);
	});

	test('each row has date, normal, and steel path columns', () => {
		const tbody = render(Date.UTC(2026, 0, 1));
		for (const tr of tbody.querySelectorAll('tr')) {
			expect(tr.querySelectorAll('td')).toHaveLength(3);
		}
	});

	test('resolves dict keys to display names', () => {
		const dict: Record<string, string> = {
			'/Lotus/Language/Suits/InfestationName': 'Nidus',
			'/Lotus/Language/Suits/BardName': 'Octavia',
			'/Lotus/Language/Suits/PriestName': 'Harrow',
		};
		vi.useFakeTimers();
		// CIRCUIT_EPOCH_MS itself is week 0, whose frame row is InfestationName/BardName/PriestName
		vi.setSystemTime(1_734_307_200_000);
		const tbody = document.createElement('tbody');
		renderCircuitForecastTable(tbody, dict);

		const firstRowCells = tbody.querySelector('tr')!.querySelectorAll('td');
		expect(firstRowCells[1].textContent).toBe('Nidus · Octavia · Harrow');
	});

	test('falls back to the raw key when dict has no translation', () => {
		vi.useFakeTimers();
		vi.setSystemTime(1_734_307_200_000);
		const tbody = document.createElement('tbody');
		renderCircuitForecastTable(tbody, {});

		const firstRowCells = tbody.querySelector('tr')!.querySelectorAll('td');
		expect(firstRowCells[1].textContent).toContain('/Lotus/Language/Suits/InfestationName');
	});

	test('frame and weapon columns rotate independently (11 vs 9-length cycles)', () => {
		// Week 9 (index 9): frame row 9 % 11 = 9, weapon row 9 % 9 = 0 (cycle wrapped, frame did not)
		const weekMs = 1_734_307_200_000 + (9 * 604_800_000);
		vi.useFakeTimers();
		vi.setSystemTime(weekMs);
		const tbody = document.createElement('tbody');
		const dict: Record<string, string> = {
			'/Lotus/Language/Suits/MesaName': 'Mesa',
			'/Lotus/Language/Items/AutoShotgunName': 'Sobek',
		};
		renderCircuitForecastTable(tbody, dict);

		const firstRowCells = tbody.querySelector('tr')!.querySelectorAll('td');
		expect(firstRowCells[1].textContent).toContain('Mesa');
		expect(firstRowCells[2].textContent).toContain('Sobek');
	});
});
