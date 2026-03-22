/**
 * Tests for src/live/calendar-seasons.ts — updateCalendarSeason()
 *
 * The global test setup (setup.ts) loads live.html as the DOM fixture, which already
 * contains #calendar-season-expiry, #calendar-season-checks, and #calendar-season-body.
 * We use those elements directly.
 *
 * Covers:
 *  - Retry when worldState is empty (setTimeout)
 *  - Retry when no active season found (stale worldState)
 *  - Active season: expiry badge, completion toggle, season pane injected
 *  - Re-render scheduled at season expiry
 *  - Missing DOM elements handled gracefully
 */
import {
	describe, test, expect, beforeAll, beforeEach, afterEach, vi,
} from 'vitest';
import {updateCalendarSeason} from '../../../src/live/calendar-seasons';
import {loadMock} from '../../helpers/api-mocks';
import {freezeTime, MOCK_TIMESTAMP} from '../../helpers/time-helpers';

// Captured before any fake timers are installed
const realNow = Date.now();

const {mockRenderCalendarSeasonPane, mockFetchExport} = vi.hoisted(() => ({
	mockRenderCalendarSeasonPane: vi.fn(),
	mockFetchExport: vi.fn(async () => ({})),
}));

vi.mock('../../../src/calendar-seasons', () => ({
	renderCalendarSeasonPane: mockRenderCalendarSeasonPane,
}));

vi.mock('../../../src/public-export-fetcher', () => ({
	fetchExport: mockFetchExport,
	exportCache: new Map(),
}));

const mockWorldState = {
	KnownCalendarSeasons: loadMock('worldState.json').KnownCalendarSeasons,
};

beforeAll(() => {
	(globalThis as any).worldState = mockWorldState;
});

beforeEach(() => {
	vi.clearAllMocks();
	vi.useFakeTimers();
	freezeTime(MOCK_TIMESTAMP);

	(globalThis as any).createExpiryBadge = vi.fn((ms: number) => {
		const span = document.createElement('span');
		span.className = 'expiry-badge';
		span.dataset.expiry = String(ms);
		return span;
	});
	(globalThis as any).createCompletionToggle = vi.fn((oid: string) => {
		const span = document.createElement('span');
		span.className = 'completion-toggle';
		span.dataset.oid = oid;
		return span;
	});
	(globalThis as any).setImageSource = vi.fn();

	const pane = document.createElement('div');
	pane.className = 'season-pane';
	mockRenderCalendarSeasonPane.mockResolvedValue(pane);
});

afterEach(() => {
	vi.useRealTimers();
	(globalThis as any).worldState = mockWorldState;
	delete (globalThis as any).createExpiryBadge;
	delete (globalThis as any).createCompletionToggle;
	delete (globalThis as any).setImageSource;
	delete (globalThis as any).ExportImages;
});

describe('updateCalendarSeason — empty worldState', () => {
	test('schedules retry in 5s when KnownCalendarSeasons is empty', () => {
		(globalThis as any).worldState = {KnownCalendarSeasons: []};

		void updateCalendarSeason();

		expect(vi.getTimerCount()).toBeGreaterThan(0);
	});

	test('schedules retry when worldState has no KnownCalendarSeasons', () => {
		(globalThis as any).worldState = {};

		void updateCalendarSeason();

		expect(vi.getTimerCount()).toBeGreaterThan(0);
	});

	test('does not call renderCalendarSeasonPane when no seasons', () => {
		(globalThis as any).worldState = {KnownCalendarSeasons: []};

		void updateCalendarSeason();

		expect(mockRenderCalendarSeasonPane).not.toHaveBeenCalled();
	});
});

describe('updateCalendarSeason — no active season', () => {
	beforeEach(() => {
		freezeTime(realNow);
	});

	test('schedules retry when all seasons are in the past', async () => {
		void updateCalendarSeason();
		for (let i = 0; i < 20; i++) {
			await Promise.resolve();
		}

		expect(vi.getTimerCount()).toBeGreaterThan(0);
		expect(mockRenderCalendarSeasonPane).not.toHaveBeenCalled();
	});
});

describe('updateCalendarSeason — active season', () => {
	let activeSeason: any;

	beforeEach(() => {
		activeSeason = mockWorldState.KnownCalendarSeasons[0];
	});

	test('calls fetchExport("ExportImages") before rendering', async () => {
		await updateCalendarSeason();

		expect(mockFetchExport).toHaveBeenCalledWith('ExportImages');
	});

	test('sets globalThis.ExportImages from fetchExport result', async () => {
		const exportData = {SomeImage: '/path.png'};
		mockFetchExport.mockResolvedValue(exportData);

		await updateCalendarSeason();

		expect((globalThis as any).ExportImages).toEqual(exportData);
	});

	test('injects expiry badge into #calendar-season-expiry', async () => {
		await updateCalendarSeason();

		const badge = document.querySelector('#calendar-season-expiry .expiry-badge');
		expect(badge).not.toBeNull();
	});

	test('calls createExpiryBadge with the season expiry timestamp', async () => {
		const expiryMs = Number.parseInt(activeSeason.Expiry.$date.$numberLong, 10);

		await updateCalendarSeason();

		expect((globalThis as any).createExpiryBadge).toHaveBeenCalledWith(expiryMs);
	});

	test('injects completion toggle into #calendar-season-checks', async () => {
		await updateCalendarSeason();

		const toggle = document.querySelector('#calendar-season-checks .completion-toggle');
		expect(toggle).not.toBeNull();
	});

	test('completion toggle oid contains expiry timestamp', async () => {
		const expiryMs = Number.parseInt(activeSeason.Expiry.$date.$numberLong, 10);

		await updateCalendarSeason();

		const toggle = document.querySelector<HTMLElement>('#calendar-season-checks .completion-toggle')!;
		expect(toggle.dataset.oid).toContain(String(expiryMs));
	});

	test('calls renderCalendarSeasonPane with the active season', async () => {
		await updateCalendarSeason();

		expect(mockRenderCalendarSeasonPane).toHaveBeenCalledWith(activeSeason);
	});

	test('injects season pane into #calendar-season-body', async () => {
		await updateCalendarSeason();

		expect(document.querySelector('#calendar-season-body .season-pane')).not.toBeNull();
	});

	test('clears previous body content before injecting new pane', async () => {
		const body = document.querySelector('#calendar-season-body')!;
		body.innerHTML = '<div class="old-content"></div>';

		await updateCalendarSeason();

		expect(body.querySelector('.old-content')).toBeNull();
		expect(body.querySelector('.season-pane')).not.toBeNull();
	});

	test('schedules re-render timer at season expiry', async () => {
		await updateCalendarSeason();

		expect(vi.getTimerCount()).toBeGreaterThan(0);
	});
});

describe('updateCalendarSeason — missing DOM elements', () => {
	test('runs without throwing when #calendar-season-expiry is absent', async () => {
		document.querySelector('#calendar-season-expiry')!.remove();

		await expect(updateCalendarSeason()).resolves.not.toThrow();
	});

	test('runs without throwing when #calendar-season-body is absent', async () => {
		document.querySelector('#calendar-season-body')!.remove();

		await expect(updateCalendarSeason()).resolves.not.toThrow();
	});
});
