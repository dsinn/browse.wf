import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
	ENTRY_MAG_VOLT_EXCALIBUR,
	ENTRY_RHINO_FROST_LOKI_PEEK,
	ENTRY_RHINO_FROST_LOKI,
} from './cache-fixtures';
import { getWeekIndex, loadCache, saveToCache, preFillForm, showResults, showHistory } from '../../src/invigorations';

type InvigorationCacheEntry = typeof ENTRY_MAG_VOLT_EXCALIBUR;
type InvigorationCache = Record<number, InvigorationCacheEntry>;

let CURRENT_WEEK: number;

beforeEach(() => {
	// Derived from production code — if the offset formula changes, this follows automatically
	CURRENT_WEEK = getWeekIndex(Date.now());
});

// Minimal DOM stub for showResults
function makeResultsDOM() {
	document.body.innerHTML = `
		<div id="results" class="d-none">
			<h4></h4>
			<p id="explain-noprev" class="explainer d-none"><b></b></p>
			<p id="explain-current" class="explainer d-none"><b></b></p>
			<p id="explain-peek" class="explainer d-none"><b></b></p>
			<div id="out-suit-0"></div><div id="out-off-0"></div><div id="out-def-0"></div>
			<div id="out-suit-1"></div><div id="out-off-1"></div><div id="out-def-1"></div>
			<div id="out-suit-2"></div><div id="out-off-2"></div><div id="out-def-2"></div>
		</div>
	`;
	(window as any).baseSuitTypes = {};
	(window as any).dict = {};
	(window as any).invigorationNames = {};
}

// Minimal DOM stub for showHistory
function makeHistoryDOM() {
	document.body.innerHTML = `
		<div id="history" class="d-none">
			<div id="history-this-week" class="d-none">
				<h6 id="this-week-suit-0"></h6><p id="this-week-off-0"></p><p id="this-week-def-0"></p>
				<h6 id="this-week-suit-1"></h6><p id="this-week-off-1"></p><p id="this-week-def-1"></p>
				<h6 id="this-week-suit-2"></h6><p id="this-week-off-2"></p><p id="this-week-def-2"></p>
			</div>
			<div id="history-last-week" class="d-none">
				<h6 id="last-week-suit-0"></h6><p id="last-week-off-0"></p><p id="last-week-def-0"></p>
				<h6 id="last-week-suit-1"></h6><p id="last-week-off-1"></p><p id="last-week-def-1"></p>
				<h6 id="last-week-suit-2"></h6><p id="last-week-off-2"></p><p id="last-week-def-2"></p>
			</div>
		</div>
	`;

	(window as any).baseSuitTypes = {};
	(window as any).dict = {};
	(window as any).invigorationNames = {};
}

describe('getWeekIndex()', () => {
	test('increments by 1 per week', () => {
		const oneWeek = 7 * 24 * 60 * 60 * 1000;
		expect(getWeekIndex(Date.now() + oneWeek)).toBe(CURRENT_WEEK + 1);
		expect(getWeekIndex(Date.now() + 2 * oneWeek)).toBe(CURRENT_WEEK + 2);
	});

	test('known timestamps', () => {
		expect(getWeekIndex(Date.UTC(2026, 1, 7))).toBe(625);
		expect(getWeekIndex(Date.UTC(2026, 1, 14))).toBe(626);
	});

	test('returns -1 for one week before Warframe epoch', () => {
		expect(getWeekIndex((1391990400 - 604800) * 1000)).toBe(-1);
	});
});

describe('loadCache()', () => {
	beforeEach(() => localStorage.clear());

	test('returns {} when nothing stored', () => {
		expect(loadCache()).toEqual({});
	});

	test('returns {} for invalid JSON', () => {
		localStorage.setItem('invigorations.cache', 'not-json');
		expect(loadCache()).toEqual({});
	});

	test('returns {} for non-object values', () => {
		localStorage.setItem('invigorations.cache', JSON.stringify([1, 2, 3]));
		expect(loadCache()).toEqual({});
		localStorage.setItem('invigorations.cache', JSON.stringify(null));
		expect(loadCache()).toEqual({});
	});

	test('round-trips cache data', () => {
		const cache: InvigorationCache = { [CURRENT_WEEK]: ENTRY_MAG_VOLT_EXCALIBUR };
		localStorage.setItem('invigorations.cache', JSON.stringify(cache));
		expect(loadCache()[CURRENT_WEEK]).toEqual(ENTRY_MAG_VOLT_EXCALIBUR);
	});
});

describe('saveToCache()', () => {
	beforeEach(() => localStorage.clear());

	test('peek=false saves at currentWeek', () => {
		saveToCache(ENTRY_MAG_VOLT_EXCALIBUR.request, ENTRY_MAG_VOLT_EXCALIBUR.response);
		const cache = loadCache();
		expect(cache[CURRENT_WEEK]).toBeDefined();
		expect(cache[CURRENT_WEEK + 1]).toBeUndefined();
	});

	test('peek=true saves at currentWeek+1', () => {
		saveToCache(ENTRY_RHINO_FROST_LOKI_PEEK.request, ENTRY_RHINO_FROST_LOKI_PEEK.response);
		const cache = loadCache();
		expect(cache[CURRENT_WEEK]).toBeUndefined();
		expect(cache[CURRENT_WEEK + 1]).toBeDefined();
	});

	test('prunes weeks older than currentWeek-1', () => {
		const staleCache: InvigorationCache = {
			[CURRENT_WEEK - 3]: ENTRY_MAG_VOLT_EXCALIBUR,
			[CURRENT_WEEK - 2]: ENTRY_MAG_VOLT_EXCALIBUR,
			[CURRENT_WEEK - 1]: ENTRY_MAG_VOLT_EXCALIBUR,
		};
		localStorage.setItem('invigorations.cache', JSON.stringify(staleCache));

		saveToCache(ENTRY_MAG_VOLT_EXCALIBUR.request, ENTRY_MAG_VOLT_EXCALIBUR.response);
		const cache = loadCache();

		expect(cache[CURRENT_WEEK - 3]).toBeUndefined();
		expect(cache[CURRENT_WEEK - 2]).toBeUndefined();
		expect(cache[CURRENT_WEEK - 1]).toBeDefined();
		expect(cache[CURRENT_WEEK]).toBeDefined();
	});

	test('calls triggerCloudSync if available', () => {
		const mockSync = vi.fn();
		(window as any).triggerCloudSync = mockSync;
		saveToCache(ENTRY_MAG_VOLT_EXCALIBUR.request, ENTRY_MAG_VOLT_EXCALIBUR.response);
		expect(mockSync).toHaveBeenCalledOnce();
		delete (window as any).triggerCloudSync;
	});
});

describe('preFillForm()', () => {
	beforeEach(() => {
		document.body.innerHTML = `
			<h5 id="input-header">Previous Offerings</h5>
			<input id="username" />
			<input id="peek" type="checkbox" />
			<select class="suit-select"><option value="---">---</option><option value="SuitA">A</option><option value="SuitB">B</option><option value="SuitC">C</option></select>
			<select class="suit-select"><option value="---">---</option><option value="SuitA">A</option><option value="SuitB">B</option><option value="SuitC">C</option></select>
			<select class="suit-select"><option value="---">---</option><option value="SuitA">A</option><option value="SuitB">B</option><option value="SuitC">C</option></select>
		`;
		// Wire up onchange as the inline script would
		(document.getElementById('peek') as HTMLInputElement).onchange = function(this: HTMLInputElement) {
			document.getElementById('input-header')!.textContent = this.checked ? 'Current Offerings' : 'Previous Offerings';
		};
	});

	test('sets username', () => {
		preFillForm('MyUser', false, []);
		expect((document.getElementById('username') as HTMLInputElement).value).toBe('MyUser');
	});

	test('sets peek=true and updates header', () => {
		preFillForm('u', true, []);
		expect((document.getElementById('peek') as HTMLInputElement).checked).toBe(true);
		expect(document.getElementById('input-header')!.textContent).toBe('Current Offerings');
	});

	test('sets peek=false and updates header', () => {
		preFillForm('u', false, []);
		expect((document.getElementById('peek') as HTMLInputElement).checked).toBe(false);
		expect(document.getElementById('input-header')!.textContent).toBe('Previous Offerings');
	});

	test('sets suit selects', () => {
		preFillForm('u', false, ['SuitA', 'SuitB', 'SuitC']);
		const selects = document.querySelectorAll<HTMLSelectElement>('.suit-select');
		expect(selects[0].value).toBe('SuitA');
		expect(selects[1].value).toBe('SuitB');
		expect(selects[2].value).toBe('SuitC');
	});

	test('handles empty suits array', () => {
		preFillForm('u', false, []);
		const selects = document.querySelectorAll<HTMLSelectElement>('.suit-select');
		expect(selects[0].value).toBe('---');
		expect(selects[1].value).toBe('---');
		expect(selects[2].value).toBe('---');
	});
});

describe('showResults()', () => {
	beforeEach(makeResultsDOM);

	const response = ENTRY_RHINO_FROST_LOKI_PEEK.response;

	test('shows results div', () => {
		showResults(response, { n: 'TestUser', s: response.suits, p: false });
		expect(document.getElementById('results')!.classList.contains('d-none')).toBe(false);
	});

	test('heading is "Current Offerings" when p=false', () => {
		showResults(response, { n: 'TestUser', s: response.suits, p: false });
		expect(document.querySelector('#results h4')!.textContent).toBe('Current Offerings');
	});

	test('heading is "Next Week\'s Offerings" when p=true', () => {
		showResults(response, { n: 'TestUser', s: response.suits, p: true });
		expect(document.querySelector('#results h4')!.textContent).toBe("Next Week's Offerings");
	});

	test('week-rollover: p=false override shows "Current Offerings" not "Next Week\'s Offerings"', () => {
		// Bug scenario: data saved as peek=true last week is now this week's data.
		// Caller passes { ...request, p: false } to override before calling showResults.
		const originalRequest = { n: 'TestUser', s: response.suits, p: true };
		showResults(response, { ...originalRequest, p: false });
		expect(document.querySelector('#results h4')!.textContent).toBe('Current Offerings');
	});

	test('shows explain-noprev when request suits length differs from response', () => {
		showResults(response, { n: 'TestUser', s: [], p: false });
		expect(document.getElementById('explain-noprev')!.classList.contains('d-none')).toBe(false);
		expect(document.getElementById('explain-current')!.classList.contains('d-none')).toBe(true);
		expect(document.getElementById('explain-peek')!.classList.contains('d-none')).toBe(true);
	});

	test('shows explain-current when p=false and suits match', () => {
		showResults(response, { n: 'TestUser', s: response.suits, p: false });
		expect(document.getElementById('explain-noprev')!.classList.contains('d-none')).toBe(true);
		expect(document.getElementById('explain-current')!.classList.contains('d-none')).toBe(false);
		expect(document.getElementById('explain-peek')!.classList.contains('d-none')).toBe(true);
	});

	test('shows explain-peek when p=true and suits match', () => {
		showResults(response, { n: 'TestUser', s: response.suits, p: true });
		expect(document.getElementById('explain-noprev')!.classList.contains('d-none')).toBe(true);
		expect(document.getElementById('explain-current')!.classList.contains('d-none')).toBe(true);
		expect(document.getElementById('explain-peek')!.classList.contains('d-none')).toBe(false);
	});

	test('sets username in all <b> elements', () => {
		showResults(response, { n: 'MyUser', s: response.suits, p: false });
		document.querySelectorAll('#results b').forEach(b => {
			expect(b.textContent).toBe('MyUser');
		});
	});
});

describe('showHistory()', () => {
	beforeEach(makeHistoryDOM);

	function suitText(prefix: string, i: number) {
		return document.getElementById(`${prefix}-suit-${i}`)!.textContent;
	}

	test('hides history when no current or last-week data', () => {
		showHistory(CURRENT_WEEK, {});
		expect(document.getElementById('history')!.classList.contains('d-none')).toBe(true);
	});

	test('shows this-week and last-week sections when both present', () => {
		const cache: InvigorationCache = {
			[CURRENT_WEEK - 1]: ENTRY_MAG_VOLT_EXCALIBUR,
			[CURRENT_WEEK]: ENTRY_RHINO_FROST_LOKI,
		};
		showHistory(CURRENT_WEEK, cache);
		expect(document.getElementById('history')!.classList.contains('d-none')).toBe(false);
		expect(document.getElementById('history-this-week')!.classList.contains('d-none')).toBe(false);
		expect(document.getElementById('history-last-week')!.classList.contains('d-none')).toBe(false);
	});

	test('hides this-week section when no current data', () => {
		const cache: InvigorationCache = { [CURRENT_WEEK - 1]: ENTRY_MAG_VOLT_EXCALIBUR };
		showHistory(CURRENT_WEEK, cache);
		expect(document.getElementById('history-this-week')!.classList.contains('d-none')).toBe(true);
		expect(document.getElementById('history-last-week')!.classList.contains('d-none')).toBe(false);
	});

	test('this-week uses next-week request suits when available', () => {
		// nextWeekData.request.s contains what the user confirmed as this week's offerings
		const nextWeekEntry: InvigorationCacheEntry = {
			request: { n: 'TestUser', s: ENTRY_RHINO_FROST_LOKI_PEEK.request.s, p: true },
			response: ENTRY_RHINO_FROST_LOKI_PEEK.response,
		};
		const cache: InvigorationCache = {
			[CURRENT_WEEK]: ENTRY_RHINO_FROST_LOKI,
			[CURRENT_WEEK + 1]: nextWeekEntry,
		};
		showHistory(CURRENT_WEEK, cache);
		// Should show request suits from next week entry (Mag/Volt/Excalibur), not response suits (Rhino/Frost/Loki)
		expect(suitText('this-week', 0)).toBe(ENTRY_RHINO_FROST_LOKI_PEEK.request.s[0]);
		expect(suitText('this-week', 1)).toBe(ENTRY_RHINO_FROST_LOKI_PEEK.request.s[1]);
		expect(suitText('this-week', 2)).toBe(ENTRY_RHINO_FROST_LOKI_PEEK.request.s[2]);
	});

	test('this-week falls back to response suits when no next-week data', () => {
		const cache: InvigorationCache = { [CURRENT_WEEK]: ENTRY_RHINO_FROST_LOKI };
		showHistory(CURRENT_WEEK, cache);
		expect(suitText('this-week', 0)).toBe(ENTRY_RHINO_FROST_LOKI.response.suits[0]);
	});

	test('last-week uses current-week request suits when available', () => {
		// currentData.request.s contains what the user confirmed as last week's offerings
		// Use a current-week entry with 3 request suits (matching last week's response length)
		const currentEntry: InvigorationCacheEntry = {
			request: { n: 'TestUser', s: ENTRY_RHINO_FROST_LOKI_PEEK.request.s, p: false },
			response: ENTRY_RHINO_FROST_LOKI.response,
		};
		const cache: InvigorationCache = {
			[CURRENT_WEEK - 1]: ENTRY_MAG_VOLT_EXCALIBUR,
			[CURRENT_WEEK]: currentEntry,
		};
		showHistory(CURRENT_WEEK, cache);
		// Should show request suits from current week entry (Mag/Volt/Excalibur), not last week's response suits
		expect(suitText('last-week', 0)).toBe(ENTRY_RHINO_FROST_LOKI_PEEK.request.s[0]);
		expect(suitText('last-week', 1)).toBe(ENTRY_RHINO_FROST_LOKI_PEEK.request.s[1]);
		expect(suitText('last-week', 2)).toBe(ENTRY_RHINO_FROST_LOKI_PEEK.request.s[2]);
	});

	test('last-week falls back to response suits when no current-week data', () => {
		const cache: InvigorationCache = { [CURRENT_WEEK - 1]: ENTRY_MAG_VOLT_EXCALIBUR };
		showHistory(CURRENT_WEEK, cache);
		expect(suitText('last-week', 0)).toBe(ENTRY_MAG_VOLT_EXCALIBUR.response.suits[0]);
	});

	test('falls back to response suits when request length mismatches response length', () => {
		// nextWeekData.request.s has only 1 suit but response has 3 — mismatch, use response
		const nextWeekEntry: InvigorationCacheEntry = {
			request: { n: 'TestUser', s: ['/Lotus/Powersuits/Mag/MagBaseSuit'], p: true },
			response: ENTRY_RHINO_FROST_LOKI_PEEK.response,
		};
		const cache: InvigorationCache = {
			[CURRENT_WEEK]: ENTRY_RHINO_FROST_LOKI,
			[CURRENT_WEEK + 1]: nextWeekEntry,
		};
		showHistory(CURRENT_WEEK, cache);
		expect(suitText('this-week', 0)).toBe(ENTRY_RHINO_FROST_LOKI.response.suits[0]);
	});
});
