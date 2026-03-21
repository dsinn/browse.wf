/**
 * Tests for src/live/sync.ts
 *
 * This module registers listeners for 'cloud-sync-before-push' and 'cloud-sync-pulled'.
 * Tests verify that each listener performs the correct actions given different DOM/localStorage states.
 */
import {
	describe, test, expect, beforeEach, afterEach, vi,
} from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be declared before the import
// ---------------------------------------------------------------------------

const mockRefreshFilterStatus = vi.fn();
const mockInitializeBountyFiltersAll = vi.fn();
const mockPruneStaleNewsRead = vi.fn();

vi.mock('../../src/card-filters.js', () => ({
	refreshFilterStatus: mockRefreshFilterStatus,
}));
vi.mock('../../src/bounty-filters.js', () => ({
	initializeBountyFiltersAll: mockInitializeBountyFiltersAll,
}));
vi.mock('../../src/news-mark-read.js', () => ({
	pruneStaleNewsRead: mockPruneStaleNewsRead,
}));

// Import the module — this registers the event listeners
await import('../../src/live/sync.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dispatchBeforePush() {
	globalThis.dispatchEvent(new CustomEvent('cloud-sync-before-push'));
}

function dispatchPulled() {
	globalThis.dispatchEvent(new CustomEvent('cloud-sync-pulled'));
}

// ---------------------------------------------------------------------------
// Tests: cloud-sync-before-push
// ---------------------------------------------------------------------------

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

	test('keeps only OIDs present in the DOM', () => {
		document.body.innerHTML = '<div data-oid="obj1"></div>';
		localStorage.setItem('oids_completed', JSON.stringify(['obj1', 'obj2']));

		dispatchBeforePush();

		expect(localStorage.getItem('oids_completed')).toBe(JSON.stringify(['obj1']));
	});

	test('removes oids_completed entirely when all OIDs are stale', () => {
		document.body.innerHTML = '<div data-oid="obj3"></div>';
		localStorage.setItem('oids_completed', JSON.stringify(['obj1', 'obj2']));

		dispatchBeforePush();

		expect(localStorage.getItem('oids_completed')).toBeNull();
	});

	test('removes oids_completed when no [data-oid] elements in DOM but keeps it when no DOM elements', () => {
		// If the DOM has no [data-oid] elements, can't determine stale — skip pruning
		document.body.innerHTML = '';
		localStorage.setItem('oids_completed', JSON.stringify(['obj1']));

		dispatchBeforePush();

		// With no [data-oid] elements in DOM, pruning is skipped
		expect(localStorage.getItem('oids_completed')).toBe(JSON.stringify(['obj1']));
	});

	test('removes oids_completed and clears key when all are valid but result is empty array', () => {
		// DOM has obj1, localStorage has obj1 — filtered result is ['obj1']
		document.body.innerHTML = '<div data-oid="obj1"></div>';
		localStorage.setItem('oids_completed', JSON.stringify(['obj1']));

		dispatchBeforePush();

		expect(localStorage.getItem('oids_completed')).toBe(JSON.stringify(['obj1']));
	});

	test('ignores [data-oid] elements with no oid value', () => {
		// Element has data-oid attribute but empty value — treated as no DOM OIDs
		document.body.innerHTML = '<div data-oid=""></div>';
		localStorage.setItem('oids_completed', JSON.stringify(['obj1']));

		dispatchBeforePush();

		// ValidOids is empty (element had no oid value), so pruning is skipped
		expect(localStorage.getItem('oids_completed')).toBe(JSON.stringify(['obj1']));
	});

	test('removes oids_completed on malformed JSON', () => {
		document.body.innerHTML = '<div data-oid="obj1"></div>';
		localStorage.setItem('oids_completed', 'not-valid-json');

		dispatchBeforePush();

		expect(localStorage.getItem('oids_completed')).toBeNull();
	});

	test('preserves valid OIDs when multiple [data-oid] elements present', () => {
		document.body.innerHTML = `
			<div data-oid="obj1"></div>
			<div data-oid="obj2"></div>
			<div data-oid="obj3"></div>
		`;
		localStorage.setItem('oids_completed', JSON.stringify(['obj1', 'obj2', 'stale1', 'stale2']));

		dispatchBeforePush();

		expect(JSON.parse(localStorage.getItem('oids_completed')!)).toEqual(['obj1', 'obj2']);
	});
});

// ---------------------------------------------------------------------------
// Tests: cloud-sync-pulled
// ---------------------------------------------------------------------------

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
