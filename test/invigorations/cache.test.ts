import {
	describe, test, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {
	getWeekIndex, loadCache, saveToCache, preFillForm, showResults, showHistory,
	showCacheAlert, initInvigorationsFromCache, initInvigorations,
} from '../../src/invigorations';
import {loadFixture} from '../helpers/fixture-loader';
import {registerSyncHandler} from '../../src/cloud-sync/trigger';
import {
	ENTRY_MAG_VOLT_EXCALIBUR,
	ENTRY_RHINO_FROST_LOKI_PEEK,
	ENTRY_RHINO_FROST_LOKI,
} from './cache-fixtures';

type InvigorationCacheEntry = typeof ENTRY_MAG_VOLT_EXCALIBUR;
type InvigorationCache = Record<number, InvigorationCacheEntry>;

let CURRENT_WEEK: number;

beforeEach(() => {
	// Derived from production code — if the offset formula changes, this follows automatically
	CURRENT_WEEK = getWeekIndex(Date.now());
});

function makeResultsDOM() {
	document.body.innerHTML = loadFixture('invigorations');
	(globalThis as any).baseSuitTypes = {};
	(globalThis as any).dict = {};
	initInvigorations({});
}

function makeHistoryDOM() {
	document.body.innerHTML = loadFixture('invigorations');
	(globalThis as any).baseSuitTypes = {};
	(globalThis as any).dict = {};
	initInvigorations({});
}

describe('getWeekIndex()', () => {
	test('increments by 1 per week', () => {
		const oneWeek = 7 * 24 * 60 * 60 * 1000;
		expect(getWeekIndex(Date.now() + oneWeek)).toBe(CURRENT_WEEK + 1);
		expect(getWeekIndex(Date.now() + (2 * oneWeek))).toBe(CURRENT_WEEK + 2);
	});

	test('known timestamps', () => {
		expect(getWeekIndex(Date.UTC(2026, 1, 7))).toBe(625);
		expect(getWeekIndex(Date.UTC(2026, 1, 14))).toBe(626);
	});

	test('returns -1 for one week before Warframe epoch', () => {
		expect(getWeekIndex((1_391_990_400 - 604_800) * 1000)).toBe(-1);
	});
});

describe('loadCache()', () => {
	beforeEach(() => {
		localStorage.clear();
	});

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
		const cache: InvigorationCache = {[CURRENT_WEEK]: ENTRY_MAG_VOLT_EXCALIBUR};
		localStorage.setItem('invigorations.cache', JSON.stringify(cache));
		expect(loadCache()[CURRENT_WEEK]).toEqual(ENTRY_MAG_VOLT_EXCALIBUR);
	});
});

describe('saveToCache()', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		registerSyncHandler(vi.fn<() => void>());
	});

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

	test('calls triggerCloudSync', () => {
		const mockSync = vi.fn<() => void>();
		registerSyncHandler(mockSync);
		saveToCache(ENTRY_MAG_VOLT_EXCALIBUR.request, ENTRY_MAG_VOLT_EXCALIBUR.response);
		expect(mockSync).toHaveBeenCalledOnce();
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
		document.querySelector<HTMLInputElement>('#peek')!.addEventListener('change', function (this: HTMLInputElement) {
			document.querySelector('#input-header')!.textContent = this.checked ? 'Current Offerings' : 'Previous Offerings';
		});
	});

	test('sets username', () => {
		preFillForm('MyUser', false, []);
		expect(document.querySelector<HTMLInputElement>('#username')!.value).toBe('MyUser');
	});

	test('sets peek=true and updates header', () => {
		preFillForm('u', true, []);
		expect(document.querySelector<HTMLInputElement>('#peek')!.checked).toBe(true);
		expect(document.querySelector('#input-header')!.textContent).toBe('Current Offerings');
	});

	test('sets peek=false and updates header', () => {
		preFillForm('u', false, []);
		expect(document.querySelector<HTMLInputElement>('#peek')!.checked).toBe(false);
		expect(document.querySelector('#input-header')!.textContent).toBe('Previous Offerings');
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

	const {response} = ENTRY_RHINO_FROST_LOKI_PEEK;

	test('shows results div', () => {
		showResults(response, {n: 'TestUser', s: response.suits, p: false});
		expect(document.querySelector('#results')!.classList.contains('d-none')).toBe(false);
	});

	test('heading is "Current Offerings" when p=false', () => {
		showResults(response, {n: 'TestUser', s: response.suits, p: false});
		expect(document.querySelector('#results h4')!.textContent).toBe('Current Offerings');
	});

	test('heading is "Next Week\'s Offerings" when p=true', () => {
		showResults(response, {n: 'TestUser', s: response.suits, p: true});
		expect(document.querySelector('#results h4')!.textContent).toBe('Next Week\'s Offerings');
	});

	test('week-rollover: p=false override shows "Current Offerings" not "Next Week\'s Offerings"', () => {
		// Bug scenario: data saved as peek=true last week is now this week's data.
		// Caller passes { ...request, p: false } to override before calling showResults.
		const originalRequest = {n: 'TestUser', s: response.suits, p: true};
		showResults(response, {...originalRequest, p: false});
		expect(document.querySelector('#results h4')!.textContent).toBe('Current Offerings');
	});

	test('shows explain-noprev when request suits length differs from response', () => {
		showResults(response, {n: 'TestUser', s: [], p: false});
		expect(document.querySelector('#explain-noprev')!.classList.contains('d-none')).toBe(false);
		expect(document.querySelector('#explain-current')!.classList.contains('d-none')).toBe(true);
		expect(document.querySelector('#explain-peek')!.classList.contains('d-none')).toBe(true);
	});

	test('shows explain-current when p=false and suits match', () => {
		showResults(response, {n: 'TestUser', s: response.suits, p: false});
		expect(document.querySelector('#explain-noprev')!.classList.contains('d-none')).toBe(true);
		expect(document.querySelector('#explain-current')!.classList.contains('d-none')).toBe(false);
		expect(document.querySelector('#explain-peek')!.classList.contains('d-none')).toBe(true);
	});

	test('shows explain-peek when p=true and suits match', () => {
		showResults(response, {n: 'TestUser', s: response.suits, p: true});
		expect(document.querySelector('#explain-noprev')!.classList.contains('d-none')).toBe(true);
		expect(document.querySelector('#explain-current')!.classList.contains('d-none')).toBe(true);
		expect(document.querySelector('#explain-peek')!.classList.contains('d-none')).toBe(false);
	});

	test('sets username in all <b> elements', () => {
		showResults(response, {n: 'MyUser', s: response.suits, p: false});
		for (const b of document.querySelectorAll('#results b')) {
			expect(b.textContent).toBe('MyUser');
		}
	});
});

describe('showHistory()', () => {
	beforeEach(makeHistoryDOM);

	function suitText(prefix: string, i: number) {
		return document.querySelector(`#${prefix}-suit-${i}`)!.textContent;
	}

	test('hides history when no current or last-week data', () => {
		showHistory(CURRENT_WEEK, {});
		expect(document.querySelector('#history')!.classList.contains('d-none')).toBe(true);
	});

	test('shows this-week and last-week sections when both present', () => {
		const cache: InvigorationCache = {
			[CURRENT_WEEK - 1]: ENTRY_MAG_VOLT_EXCALIBUR,
			[CURRENT_WEEK]: ENTRY_RHINO_FROST_LOKI,
		};
		showHistory(CURRENT_WEEK, cache);
		expect(document.querySelector('#history')!.classList.contains('d-none')).toBe(false);
		expect(document.querySelector('#history-this-week')!.classList.contains('d-none')).toBe(false);
		expect(document.querySelector('#history-last-week')!.classList.contains('d-none')).toBe(false);
	});

	test('hides this-week section when no current data', () => {
		const cache: InvigorationCache = {[CURRENT_WEEK - 1]: ENTRY_MAG_VOLT_EXCALIBUR};
		showHistory(CURRENT_WEEK, cache);
		expect(document.querySelector('#history-this-week')!.classList.contains('d-none')).toBe(true);
		expect(document.querySelector('#history-last-week')!.classList.contains('d-none')).toBe(false);
	});

	test('this-week uses next-week request suits when available', () => {
		// NextWeekData.request.s contains what the user confirmed as this week's offerings
		const nextWeekEntry: InvigorationCacheEntry = {
			request: {n: 'TestUser', s: ENTRY_RHINO_FROST_LOKI_PEEK.request.s, p: true},
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
		const cache: InvigorationCache = {[CURRENT_WEEK]: ENTRY_RHINO_FROST_LOKI};
		showHistory(CURRENT_WEEK, cache);
		expect(suitText('this-week', 0)).toBe(ENTRY_RHINO_FROST_LOKI.response.suits[0]);
	});

	test('last-week uses current-week request suits when available', () => {
		// CurrentData.request.s contains what the user confirmed as last week's offerings
		// Use a current-week entry with 3 request suits (matching last week's response length)
		const currentEntry: InvigorationCacheEntry = {
			request: {n: 'TestUser', s: ENTRY_RHINO_FROST_LOKI_PEEK.request.s, p: false},
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
		const cache: InvigorationCache = {[CURRENT_WEEK - 1]: ENTRY_MAG_VOLT_EXCALIBUR};
		showHistory(CURRENT_WEEK, cache);
		expect(suitText('last-week', 0)).toBe(ENTRY_MAG_VOLT_EXCALIBUR.response.suits[0]);
	});

	test('falls back to response suits when request length mismatches response length', () => {
		// NextWeekData.request.s has only 1 suit but response has 3 — mismatch, use response
		const nextWeekEntry: InvigorationCacheEntry = {
			request: {n: 'TestUser', s: ['/Lotus/Powersuits/Mag/MagBaseSuit'], p: true},
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

describe('showCacheAlert()', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="cache-alert" class="alert d-none mb-3" role="alert"></div>';
	});

	test('removes d-none and sets type class', () => {
		showCacheAlert('success', 'Hello');
		const element = document.querySelector('#cache-alert')!;
		expect(element.classList.contains('d-none')).toBe(false);
		expect(element.classList.contains('alert-success')).toBe(true);
	});

	test('sets message text', () => {
		showCacheAlert('info', 'Test message');
		expect(document.querySelector('#cache-alert')!.textContent).toBe('Test message');
	});

	test('replaces previous alert type', () => {
		showCacheAlert('danger', 'Error');
		showCacheAlert('warning', 'Warn');
		const element = document.querySelector('#cache-alert')!;
		expect(element.classList.contains('alert-warning')).toBe(true);
		expect(element.classList.contains('alert-danger')).toBe(false);
	});

	test('does nothing when element is absent', () => {
		document.body.innerHTML = '';
		expect(() => {
			showCacheAlert('info', 'x');
		}).not.toThrow();
	});
});

describe('initInvigorationsFromCache()', () => {
	beforeEach(() => {
		localStorage.clear();
		document.body.innerHTML = loadFixture('invigorations');
		(globalThis as any).baseSuitTypes = {};
		(globalThis as any).dict = {};
		document.querySelector<HTMLInputElement>('#peek')!.addEventListener('change', function (this: HTMLInputElement) {
			document.querySelector('#input-header')!.textContent = this.checked ? 'Current Offerings' : 'Previous Offerings';
		});
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	test('does nothing when inventoryDataUsed=true', () => {
		localStorage.setItem('invigorations.cache', JSON.stringify({[CURRENT_WEEK]: ENTRY_MAG_VOLT_EXCALIBUR}));
		initInvigorationsFromCache(true);
		expect(document.querySelector('#results')!.classList.contains('d-none')).toBe(true);
		expect(document.querySelector('#cache-alert')!.classList.contains('d-none')).toBe(true);
	});

	test('shows next-week data with success alert when nextWeekData exists', () => {
		const cache: InvigorationCache = {[CURRENT_WEEK + 1]: ENTRY_RHINO_FROST_LOKI_PEEK};
		localStorage.setItem('invigorations.cache', JSON.stringify(cache));
		initInvigorationsFromCache(false);
		expect(document.querySelector('#cache-alert')!.classList.contains('alert-success')).toBe(true);
		expect(document.querySelector('#results')!.classList.contains('d-none')).toBe(false);
		expect(document.querySelector<HTMLInputElement>('#username')!.value).toBe(ENTRY_RHINO_FROST_LOKI_PEEK.request.n);
	});

	test('shows current-week data with info alert when only currentWeekData exists', () => {
		const cache: InvigorationCache = {[CURRENT_WEEK]: ENTRY_MAG_VOLT_EXCALIBUR};
		localStorage.setItem('invigorations.cache', JSON.stringify(cache));
		initInvigorationsFromCache(false);
		expect(document.querySelector('#cache-alert')!.classList.contains('alert-info')).toBe(true);
		expect(document.querySelector('#results')!.classList.contains('d-none')).toBe(false);
	});

	test('current-week peek data pre-fills response suits into selects', () => {
		// Scenario: user peeked last week (data now in currentWeek slot after week rolled over).
		// request.s has last week's suits; response.suits has this week's offerings.
		// Selects should show response.suits so the user can immediately peek at next week.
		const selects = document.querySelectorAll<HTMLSelectElement>('.suit-select');
		for (const [i, select] of selects.entries()) {
			const option = document.createElement('option');
			option.value = ENTRY_RHINO_FROST_LOKI_PEEK.response.suits[i];
			select.append(option);
		}

		const cache: InvigorationCache = {[CURRENT_WEEK]: ENTRY_RHINO_FROST_LOKI_PEEK};
		localStorage.setItem('invigorations.cache', JSON.stringify(cache));
		initInvigorationsFromCache(false);
		expect(selects[0].value).toBe(ENTRY_RHINO_FROST_LOKI_PEEK.response.suits[0]);
		expect(selects[1].value).toBe(ENTRY_RHINO_FROST_LOKI_PEEK.response.suits[1]);
		expect(selects[2].value).toBe(ENTRY_RHINO_FROST_LOKI_PEEK.response.suits[2]);
	});

	test('pre-fills form with info alert when only lastWeekData exists', () => {
		const cache: InvigorationCache = {[CURRENT_WEEK - 1]: ENTRY_MAG_VOLT_EXCALIBUR};
		localStorage.setItem('invigorations.cache', JSON.stringify(cache));
		initInvigorationsFromCache(false);
		expect(document.querySelector('#cache-alert')!.classList.contains('alert-info')).toBe(true);
		// Results should NOT be shown for last-week-only data
		expect(document.querySelector('#results')!.classList.contains('d-none')).toBe(true);
		expect(document.querySelector<HTMLInputElement>('#username')!.value).toBe(ENTRY_MAG_VOLT_EXCALIBUR.request.n);
	});

	test('shows warning alert for stale cache (2+ weeks old)', () => {
		const cache: InvigorationCache = {[CURRENT_WEEK - 3]: ENTRY_MAG_VOLT_EXCALIBUR};
		localStorage.setItem('invigorations.cache', JSON.stringify(cache));
		initInvigorationsFromCache(false);
		expect(document.querySelector('#cache-alert')!.classList.contains('alert-warning')).toBe(true);
		expect(document.querySelector<HTMLInputElement>('#username')!.value).toBe(ENTRY_MAG_VOLT_EXCALIBUR.request.n);
	});

	test('shows no alert for empty cache', () => {
		initInvigorationsFromCache(false);
		expect(document.querySelector('#cache-alert')!.classList.contains('d-none')).toBe(true);
	});

	test('schedules reload when cache has recent data', () => {
		const cache: InvigorationCache = {[CURRENT_WEEK]: ENTRY_MAG_VOLT_EXCALIBUR};
		localStorage.setItem('invigorations.cache', JSON.stringify(cache));
		const reloadMock = vi.fn();
		vi.stubGlobal('location', {reload: reloadMock});
		initInvigorationsFromCache(false);
		// Advance time past the week boundary
		const weekEnd = (((getWeekIndex(Date.now()) + 1) * 604_800) + 1_391_990_400) * 1000;
		vi.advanceTimersByTime(weekEnd - Date.now() + 1000);
		expect(reloadMock).toHaveBeenCalled();
	});
});
