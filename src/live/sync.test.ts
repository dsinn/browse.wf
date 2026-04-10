/**
 * Tests for src/live/sync.ts
 *
 * This module registers listeners for 'cloud-sync-before-push' and 'cloud-sync-pulled'.
 * Tests verify that each listener performs the correct actions given different DOM/localStorage states.
 */
import {
	describe, test, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {MOCK_TIMESTAMP} from '@test/helpers/test-constants';

const mockRefreshFilterStatus = vi.fn();
const mockInitializeBountyFiltersAll = vi.fn();
const mockPruneStaleNewsRead = vi.fn();

vi.mock('../../src/card-filters.js', () => ({
	refreshFilterStatus: mockRefreshFilterStatus,
}));
vi.mock('../../src/live/bounty-filters.js', () => ({
	initializeBountyFiltersAll: mockInitializeBountyFiltersAll,
}));
vi.mock('../../src/live/news-mark-read.js', () => ({
	pruneStaleNewsRead: mockPruneStaleNewsRead,
}));

// Import and call initLiveSync to register event listeners
const {initLiveSync} = await import('../../src/live/sync.js');
initLiveSync();

function dispatchBeforePush() {
	globalThis.dispatchEvent(new CustomEvent('cloud-sync-before-push'));
}

function dispatchPulled() {
	globalThis.dispatchEvent(new CustomEvent('cloud-sync-pulled'));
}

describe('cloud-sync-before-push', () => {
	afterEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
	});

	test('calls pruneStaleNewsRead', () => {
		dispatchBeforePush();
		expect(mockPruneStaleNewsRead).toHaveBeenCalledOnce();
	});

	test('does nothing to oids_completed when key is not set', () => {
		dispatchBeforePush();
		expect(localStorage.getItem('oids_completed')).toBeNull();
	});

	test('removes oids_completed on malformed JSON', () => {
		localStorage.setItem('oids_completed', 'not-valid-json');
		dispatchBeforePush();
		expect(localStorage.getItem('oids_completed')).toBeNull();
	});

	test('keeps unknown-format OIDs (unknown format — keep)', () => {
		localStorage.setItem('oids_completed', JSON.stringify(['unknown-format']));
		dispatchBeforePush();
		expect(JSON.parse(localStorage.getItem('oids_completed')!)).toEqual(['unknown-format']);
	});

	// -------------------------------------------------------------------------
	// Millisecond-timestamp OIDs (weekly missions, vendors, daily syndicates, Archimedea, calendar season)
	// -------------------------------------------------------------------------

	test('keeps future circuit-hard OID', () => {
		const futureMs = MOCK_TIMESTAMP + 604_800_000;
		localStorage.setItem('oids_completed', JSON.stringify([`circuit-hard-${futureMs}`]));
		dispatchBeforePush();
		expect(JSON.parse(localStorage.getItem('oids_completed')!)).toEqual([`circuit-hard-${futureMs}`]);
	});

	test('drops past circuit-hard OID', () => {
		const pastMs = MOCK_TIMESTAMP - 1000;
		localStorage.setItem('oids_completed', JSON.stringify([`circuit-hard-${pastMs}`]));
		dispatchBeforePush();
		expect(localStorage.getItem('oids_completed')).toBeNull();
	});

	test('keeps future kahl OID', () => {
		const futureMs = MOCK_TIMESTAMP + 604_800_000;
		localStorage.setItem('oids_completed', JSON.stringify([`kahl-${futureMs}`]));
		dispatchBeforePush();
		expect(JSON.parse(localStorage.getItem('oids_completed')!)).toEqual([`kahl-${futureMs}`]);
	});

	test('drops past kahlb3 OID', () => {
		const pastMs = MOCK_TIMESTAMP - 1000;
		localStorage.setItem('oids_completed', JSON.stringify([`kahlb3-${pastMs}`]));
		dispatchBeforePush();
		expect(localStorage.getItem('oids_completed')).toBeNull();
	});

	test('keeps future teshin OID', () => {
		const futureMs = MOCK_TIMESTAMP + 604_800_000;
		localStorage.setItem('oids_completed', JSON.stringify([`teshin-${futureMs}`]));
		dispatchBeforePush();
		expect(JSON.parse(localStorage.getItem('oids_completed')!)).toEqual([`teshin-${futureMs}`]);
	});

	test('drops past ironwake OID', () => {
		const pastMs = MOCK_TIMESTAMP - 1000;
		localStorage.setItem('oids_completed', JSON.stringify([`ironwake-${pastMs}`]));
		dispatchBeforePush();
		expect(localStorage.getItem('oids_completed')).toBeNull();
	});

	test('keeps future HexSyndicate-check OID', () => {
		const futureMs = MOCK_TIMESTAMP + 86_400_000;
		localStorage.setItem('oids_completed', JSON.stringify([`HexSyndicate-check-${futureMs}`]));
		dispatchBeforePush();
		expect(JSON.parse(localStorage.getItem('oids_completed')!)).toEqual([`HexSyndicate-check-${futureMs}`]);
	});

	test('drops past HexSyndicate-check OID', () => {
		const pastMs = MOCK_TIMESTAMP - 1000;
		localStorage.setItem('oids_completed', JSON.stringify([`HexSyndicate-check-${pastMs}`]));
		dispatchBeforePush();
		expect(localStorage.getItem('oids_completed')).toBeNull();
	});

	test('keeps future EntratiLabSyndicate-check OID', () => {
		const futureMs = MOCK_TIMESTAMP + 86_400_000;
		localStorage.setItem('oids_completed', JSON.stringify([`EntratiLabSyndicate-check-${futureMs}`]));
		dispatchBeforePush();
		expect(JSON.parse(localStorage.getItem('oids_completed')!)).toEqual([`EntratiLabSyndicate-check-${futureMs}`]);
	});

	test('keeps future hexconquest OID', () => {
		const futureMs = MOCK_TIMESTAMP + 604_800_000;
		localStorage.setItem('oids_completed', JSON.stringify([`hexconquest-${futureMs}`]));
		dispatchBeforePush();
		expect(JSON.parse(localStorage.getItem('oids_completed')!)).toEqual([`hexconquest-${futureMs}`]);
	});

	test('drops past labconquest OID', () => {
		const pastMs = MOCK_TIMESTAMP - 1000;
		localStorage.setItem('oids_completed', JSON.stringify([`labconquest-${pastMs}`]));
		dispatchBeforePush();
		expect(localStorage.getItem('oids_completed')).toBeNull();
	});

	test('keeps future calendarseason OID', () => {
		const futureMs = MOCK_TIMESTAMP + 604_800_000;
		localStorage.setItem('oids_completed', JSON.stringify([`calendarseason-${futureMs}`]));
		dispatchBeforePush();
		expect(JSON.parse(localStorage.getItem('oids_completed')!)).toEqual([`calendarseason-${futureMs}`]);
	});

	test('drops past calendarseason OID', () => {
		const pastMs = MOCK_TIMESTAMP - 1000;
		localStorage.setItem('oids_completed', JSON.stringify([`calendarseason-${pastMs}`]));
		dispatchBeforePush();
		expect(localStorage.getItem('oids_completed')).toBeNull();
	});

	// -------------------------------------------------------------------------
	// MongoDB ObjectIDs
	// -------------------------------------------------------------------------

	const SORTIE_OID = '6974e8fee68ad4bc31ce5f49';
	const ARCHON_OID = '6974e8fee68ad4bc31ce5f50';
	const INVASION_OID = '6974e8fee68ad4bc31ce5f51';
	const ALERT_OID = '6974e8fee68ad4bc31ce5f52';
	const STALE_OID = '1234567890abcdef12345678';

	function setupLoadedCards(options: {
		sortie?: boolean;
		litesortie?: boolean;
		invasions?: boolean;
		alerts?: 'loaded' | 'loading' | 'none';
	} = {}) {
		const {sortie = true, litesortie = true, invasions = true, alerts = 'loaded'} = options;
		let alertsContent: string;
		if (alerts === 'loading') {
			alertsContent = 'Loading...';
		} else if (alerts === 'loaded') {
			alertsContent = `<span data-oid="${ALERT_OID}"></span>`;
		} else {
			alertsContent = 'None right now.';
		}

		document.body.innerHTML = `
			<span id="sortie-header">${sortie ? `<a data-oid="${SORTIE_OID}"></a>` : ''}</span>
			<span id="litesortie-header">${litesortie ? `<a data-oid="${ARCHON_OID}"></a>` : ''}</span>
			<table id="invasions-table">${invasions ? `<tr><td><a data-oid="${INVASION_OID}"></a></td></tr>` : ''}</table>
			<div id="alerts-body">${alertsContent}</div>
		`;
	}

	test('prunes stale Mongo OID when all cards loaded', () => {
		setupLoadedCards();
		localStorage.setItem('oids_completed', JSON.stringify([SORTIE_OID, STALE_OID]));
		dispatchBeforePush();
		expect(JSON.parse(localStorage.getItem('oids_completed')!)).toEqual([SORTIE_OID]);
	});

	test('keeps all Mongo OIDs in valid set when all cards loaded', () => {
		setupLoadedCards();
		localStorage.setItem('oids_completed', JSON.stringify([SORTIE_OID, ARCHON_OID, INVASION_OID, ALERT_OID]));
		dispatchBeforePush();
		expect(JSON.parse(localStorage.getItem('oids_completed')!)).toEqual([SORTIE_OID, ARCHON_OID, INVASION_OID, ALERT_OID]);
	});

	test('skips Mongo pruning when sortie not loaded', () => {
		setupLoadedCards({sortie: false});
		localStorage.setItem('oids_completed', JSON.stringify([STALE_OID]));
		dispatchBeforePush();
		expect(JSON.parse(localStorage.getItem('oids_completed')!)).toEqual([STALE_OID]);
	});

	test('skips Mongo pruning when litesortie not loaded', () => {
		setupLoadedCards({litesortie: false});
		localStorage.setItem('oids_completed', JSON.stringify([STALE_OID]));
		dispatchBeforePush();
		expect(JSON.parse(localStorage.getItem('oids_completed')!)).toEqual([STALE_OID]);
	});

	test('skips Mongo pruning when invasions not loaded', () => {
		setupLoadedCards({invasions: false});
		localStorage.setItem('oids_completed', JSON.stringify([STALE_OID]));
		dispatchBeforePush();
		expect(JSON.parse(localStorage.getItem('oids_completed')!)).toEqual([STALE_OID]);
	});

	test('skips Mongo pruning when alerts still loading', () => {
		setupLoadedCards({alerts: 'loading'});
		localStorage.setItem('oids_completed', JSON.stringify([STALE_OID]));
		dispatchBeforePush();
		expect(JSON.parse(localStorage.getItem('oids_completed')!)).toEqual([STALE_OID]);
	});

	test('prunes Mongo OIDs when alerts shows "None right now."', () => {
		setupLoadedCards({alerts: 'none'});
		localStorage.setItem('oids_completed', JSON.stringify([STALE_OID]));
		dispatchBeforePush();
		expect(localStorage.getItem('oids_completed')).toBeNull();
	});

	test('removes oids_completed entirely when all OIDs are pruned', () => {
		setupLoadedCards();
		localStorage.setItem('oids_completed', JSON.stringify([STALE_OID]));
		dispatchBeforePush();
		expect(localStorage.getItem('oids_completed')).toBeNull();
	});
});

describe('cloud-sync-pulled', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
		document.body.innerHTML = '';
	});

	test('calls refreshAllCompletionToggles when defined', () => {
		const fn = vi.fn();
		(globalThis as any).refreshAllCompletionToggles = fn;

		dispatchPulled();

		expect(fn).toHaveBeenCalledOnce();
		delete (globalThis as any).refreshAllCompletionToggles;
	});

	test('does not throw when refreshAllCompletionToggles is undefined', () => {
		delete (globalThis as any).refreshAllCompletionToggles;
		expect(() => {
			dispatchPulled();
		}).not.toThrow();
	});

	test('calls refreshCollapseStatus for each [data-collapse-toggle] element', () => {
		document.body.innerHTML = `
			<div data-collapse-toggle="news"></div>
			<div data-collapse-toggle="bounties"></div>
		`;
		const fn = vi.fn();
		(globalThis as any).refreshCollapseStatus = fn;

		dispatchPulled();

		expect(fn).toHaveBeenCalledTimes(2);
		delete (globalThis as any).refreshCollapseStatus;
	});

	test('does not throw when refreshCollapseStatus is undefined', () => {
		document.body.innerHTML = '<div data-collapse-toggle="news"></div>';
		delete (globalThis as any).refreshCollapseStatus;
		expect(() => {
			dispatchPulled();
		}).not.toThrow();
	});

	test('calls refreshNotifStatus for each [data-notif-toggle] element', () => {
		document.body.innerHTML = `
			<div data-notif-toggle="alert1"></div>
			<div data-notif-toggle="alert2"></div>
		`;
		const fn = vi.fn();
		(globalThis as any).refreshNotifStatus = fn;

		dispatchPulled();

		expect(fn).toHaveBeenCalledTimes(2);
		delete (globalThis as any).refreshNotifStatus;
	});

	test('calls refreshFilterStatus for each [data-filter-toggle] element', () => {
		document.body.innerHTML = `
			<div data-filter-toggle="news"></div>
			<div data-filter-toggle="bounties"></div>
		`;

		dispatchPulled();

		expect(mockRefreshFilterStatus).toHaveBeenCalledTimes(2);
	});

	test('restores filter checkbox state from localStorage', () => {
		localStorage.setItem('live.filter.news.danger', '1');

		document.body.innerHTML = `
			<input type="checkbox" id="filter-news-danger" data-filter-type="danger">
		`;

		dispatchPulled();

		const checkbox = document.querySelector<HTMLInputElement>('#filter-news-danger')!;
		expect(checkbox.checked).toBe(true);
	});

	test('sets checkbox unchecked when storage value is "0"', () => {
		localStorage.setItem('live.filter.news.primary', '0');

		document.body.innerHTML = `
			<input type="checkbox" id="filter-news-primary" data-filter-type="primary" checked>
		`;

		dispatchPulled();

		const checkbox = document.querySelector<HTMLInputElement>('#filter-news-primary')!;
		expect(checkbox.checked).toBe(false);
	});

	test('ignores [data-filter-type] elements with no filterType value', () => {
		// Element has the attribute but empty value — should not throw
		document.body.innerHTML = `
			<input type="checkbox" id="filter-news-danger" data-filter-type="">
		`;

		expect(() => {
			dispatchPulled();
		}).not.toThrow();
	});

	test('does not change checkbox when no localStorage value', () => {
		document.body.innerHTML = `
			<input type="checkbox" id="filter-news-danger" data-filter-type="danger" checked>
		`;

		dispatchPulled();

		// Checked state unchanged (no saved value)
		const checkbox = document.querySelector<HTMLInputElement>('#filter-news-danger')!;
		expect(checkbox.checked).toBe(true);
	});

	test('calls initializeBountyFiltersAll', () => {
		dispatchPulled();
		expect(mockInitializeBountyFiltersAll).toHaveBeenCalledOnce();
	});

	test('calls updateNewsTicker when defined', () => {
		const fn = vi.fn();
		(globalThis as any).updateNewsTicker = fn;

		dispatchPulled();

		expect(fn).toHaveBeenCalledOnce();
		delete (globalThis as any).updateNewsTicker;
	});

	test('calls updateBountyCycleLocalised when defined', () => {
		const fn = vi.fn();
		(globalThis as any).updateBountyCycleLocalised = fn;

		dispatchPulled();

		expect(fn).toHaveBeenCalledOnce();
		delete (globalThis as any).updateBountyCycleLocalised;
	});

	test('calls updateIncursionsLocalised when defined', () => {
		const fn = vi.fn();
		(globalThis as any).updateIncursionsLocalised = fn;

		dispatchPulled();

		expect(fn).toHaveBeenCalledOnce();
		delete (globalThis as any).updateIncursionsLocalised;
	});

	test('calls checkLoadButtonState when defined', () => {
		const fn = vi.fn();
		(globalThis as any).checkLoadButtonState = fn;

		dispatchPulled();

		expect(fn).toHaveBeenCalledOnce();
		delete (globalThis as any).checkLoadButtonState;
	});

	test('does not throw when all optional globals are undefined', () => {
		delete (globalThis as any).updateNewsTicker;
		delete (globalThis as any).updateBountyCycleLocalised;
		delete (globalThis as any).updateIncursionsLocalised;
		delete (globalThis as any).checkLoadButtonState;

		expect(() => {
			dispatchPulled();
		}).not.toThrow();
	});
});
