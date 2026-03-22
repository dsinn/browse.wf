/**
 * Integration tests for the async tab-rendering functions in src/weekly-forecast.ts:
 *   - renderConquestTabs  (via initWeeklyForecast with CT_LAB / CT_HEX data)
 *   - renderDescentTabs   (via initWeeklyForecast with Descents data)
 *   - renderCalendarSeasonTabs (via initWeeklyForecast with KnownCalendarSeasons data)
 *   - initWeeklyMissionsNotice
 *   - initWeeklyForecast  (main entry point — conditional rendering, tab preservation)
 *
 * These functions are not exported, so we test them by wiring up the required
 * DOM structure and mocking external dependencies, then importing the module.
 *
 * Strategy: vi.resetModules() + dynamic import in each describe block so the
 * module-level side effects (initWeeklyMissionsNotice, initWeeklyForecast) run
 * with the DOM and mocks we have prepared.
 */
import {
	describe, test, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {loadMock} from '../helpers/api-mocks';
import {mockBootstrapTooltip} from '../helpers/dom-helpers';

const {mockFetchWorldState} = vi.hoisted(() => ({
	mockFetchWorldState: vi.fn(),
}));

vi.mock('../../src/warframe-api-proxy-client', () => ({
	WarframeApiFrontProxyClient: {
		fetchWorldState: mockFetchWorldState,
	},
}));

vi.mock('../../src/public-export-fetcher', () => ({
	fetchExport: vi.fn(async () => ({})),
	exportCache: new Map(),
}));

vi.mock('../../src/arbys-timer', () => ({
	createArbyCountdownBadge: vi.fn(() => {
		const span = document.createElement('span');
		span.className = 'arby-badge';
		return span;
	}),
}));

const worldState = loadMock('worldState.json');

/** Build the full weekly-forecast DOM scaffold. */
function buildDom() {
	document.body.innerHTML = `
		<div id="weekly-missions-timer"></div>

		<ul id="lab-conquest-tabs" class="nav nav-tabs"></ul>
		<div id="lab-conquest-content" class="tab-content"></div>

		<ul id="hex-conquest-tabs" class="nav nav-tabs"></ul>
		<div id="hex-conquest-content" class="tab-content"></div>

		<ul id="descendia-tabs" class="nav nav-tabs"></ul>
		<div id="descendia-content" class="tab-content"></div>

		<ul id="calendar-season-tabs" class="nav nav-tabs"></ul>
		<div id="calendar-season-content" class="tab-content"></div>
	`;
}

function clearDom() {
	document.body.innerHTML = '';
}

async function loadModule() {
	// Use fake timers to prevent the auto-refresh setTimeout from running
	vi.useFakeTimers();
	const mod = await import('../../src/weekly-forecast.js');
	// Flush microtasks so async initWeeklyForecast() settles
	for (let i = 0; i < 30; i++) {
		await Promise.resolve();
	}

	return mod;
}

describe('initWeeklyMissionsNotice', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		mockBootstrapTooltip();

		buildDom();
		// Stub getDictPromise / getOSDictPromise for conquest rendering
		(globalThis as any).getDictPromise = async () => ({});
		(globalThis as any).getOSDictPromise = async () => ({});
		(globalThis as any).toTitleCase = (s: string) => s;
		mockFetchWorldState.mockResolvedValue({Conquests: [], Descents: [], KnownCalendarSeasons: []});
	});

	afterEach(() => {
		vi.useRealTimers();
		clearDom();
		delete (globalThis as any).getDictPromise;
		delete (globalThis as any).getOSDictPromise;
		delete (globalThis as any).toTitleCase;
	});

	test('appends a countdown badge inside #weekly-missions-timer', async () => {
		await loadModule();
		const timer = document.querySelector('#weekly-missions-timer')!;
		expect(timer.querySelector('.arby-badge')).not.toBeNull();
	});

	test('does nothing when #weekly-missions-timer is absent', async () => {
		document.querySelector('#weekly-missions-timer')!.remove();
		// Should not throw
		await expect(loadModule()).resolves.not.toThrow();
	});
});

describe('renderConquestTabs — CT_LAB (Deep Archimedea)', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		mockBootstrapTooltip();

		buildDom();
		(globalThis as any).getDictPromise = async () => ({});
		(globalThis as any).getOSDictPromise = async () => ({});
		(globalThis as any).toTitleCase = (s: string) => s;

		// Provide a world state with at least one CT_LAB conquest
		mockFetchWorldState.mockResolvedValue({
			Conquests: worldState.Conquests.filter((c: any) => c.Type === 'CT_LAB'),
			Descents: [],
			KnownCalendarSeasons: [],
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		clearDom();
		delete (globalThis as any).getDictPromise;
		delete (globalThis as any).getOSDictPromise;
		delete (globalThis as any).toTitleCase;
	});

	test('renders at least one nav tab in #lab-conquest-tabs', async () => {
		await loadModule();
		const tabs = document.querySelectorAll('#lab-conquest-tabs .nav-item');
		expect(tabs.length).toBeGreaterThan(0);
	});

	test('renders a corresponding tab pane in #lab-conquest-content', async () => {
		await loadModule();
		const panes = document.querySelectorAll('#lab-conquest-content .tab-pane');
		expect(panes.length).toBeGreaterThan(0);
	});

	test('first tab is marked active', async () => {
		await loadModule();
		const activeBtn = document.querySelector('#lab-conquest-tabs .nav-link.active');
		expect(activeBtn).not.toBeNull();
	});

	test('each tab pane contains a missions table', async () => {
		await loadModule();
		const panes = document.querySelectorAll('#lab-conquest-content .tab-pane');
		for (const pane of panes) {
			expect(pane.querySelector('table')).not.toBeNull();
		}
	});

	test('does not render tabs when no CT_LAB conquests exist', async () => {
		mockFetchWorldState.mockResolvedValue({Conquests: [], Descents: [], KnownCalendarSeasons: []});
		await loadModule();
		const tabs = document.querySelectorAll('#lab-conquest-tabs .nav-item');
		expect(tabs.length).toBe(0);
	});

	test('does not render tabs when #lab-conquest-tabs is absent', async () => {
		document.querySelector('#lab-conquest-tabs')!.remove();
		document.querySelector('#lab-conquest-content')!.remove();
		// Should not throw
		await expect(loadModule()).resolves.not.toThrow();
	});
});

describe('renderConquestTabs — CT_HEX (Temporal Archimedea)', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		mockBootstrapTooltip();

		buildDom();
		(globalThis as any).getDictPromise = async () => ({});
		(globalThis as any).getOSDictPromise = async () => ({});
		(globalThis as any).toTitleCase = (s: string) => s;

		mockFetchWorldState.mockResolvedValue({
			Conquests: worldState.Conquests.filter((c: any) => c.Type === 'CT_HEX'),
			Descents: [],
			KnownCalendarSeasons: [],
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		clearDom();
		delete (globalThis as any).getDictPromise;
		delete (globalThis as any).getOSDictPromise;
		delete (globalThis as any).toTitleCase;
	});

	test('renders at least one nav tab in #hex-conquest-tabs', async () => {
		await loadModule();
		const tabs = document.querySelectorAll('#hex-conquest-tabs .nav-item');
		expect(tabs.length).toBeGreaterThan(0);
	});

	test('renders a corresponding tab pane in #hex-conquest-content', async () => {
		await loadModule();
		const panes = document.querySelectorAll('#hex-conquest-content .tab-pane');
		expect(panes.length).toBeGreaterThan(0);
	});
});

describe('renderDescentTabs', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		mockBootstrapTooltip();

		buildDom();
		(globalThis as any).getDictPromise = async () => loadMock('dicts/en.json');
		(globalThis as any).getOSDictPromise = async () => loadMock('dicts/en.json');
		(globalThis as any).toTitleCase = (s: string) => s;

		mockFetchWorldState.mockResolvedValue({
			Conquests: [],
			Descents: worldState.Descents,
			KnownCalendarSeasons: [],
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		clearDom();
		delete (globalThis as any).getDictPromise;
		delete (globalThis as any).getOSDictPromise;
		delete (globalThis as any).toTitleCase;
	});

	test('renders one tab per descent entry', async () => {
		await loadModule();
		const tabs = document.querySelectorAll('#descendia-tabs .nav-item');
		expect(tabs.length).toBe(worldState.Descents.length);
	});

	test('renders one pane per descent entry', async () => {
		await loadModule();
		const panes = document.querySelectorAll('#descendia-content .tab-pane');
		expect(panes.length).toBe(worldState.Descents.length);
	});

	test('exactly one tab is active', async () => {
		await loadModule();
		const activeTabs = document.querySelectorAll('#descendia-tabs .nav-link.active');
		expect(activeTabs.length).toBe(1);
	});

	test('each pane contains a challenges table', async () => {
		await loadModule();
		const panes = document.querySelectorAll('#descendia-content .tab-pane');
		for (const pane of panes) {
			expect(pane.querySelector('table')).not.toBeNull();
		}
	});

	test('table has column headers: #, Type, Challenge, Arena, Specs, Auras', async () => {
		await loadModule();
		// Use the first pane's thead to avoid counting headers across all tabs
		const firstPane = document.querySelector('#descendia-content .tab-pane')!;
		const ths = firstPane.querySelectorAll('thead th');
		const headers = [...ths].map(th => th.textContent);
		expect(headers).toEqual(['#', 'Type', 'Challenge', 'Arena', 'Specs', 'Auras']);
	});

	test('does not render tabs when Descents is empty', async () => {
		mockFetchWorldState.mockResolvedValue({Conquests: [], Descents: [], KnownCalendarSeasons: []});
		await loadModule();
		const tabs = document.querySelectorAll('#descendia-tabs .nav-item');
		expect(tabs.length).toBe(0);
	});

	test('first tab is active when no descent is currently active', async () => {
		// All descents in the past
		const pastDescents = worldState.Descents.map((d: any) => ({
			...d,
			Activation: {$date: {$numberLong: '0'}},
			Expiry: {$date: {$numberLong: '1'}},
		}));
		mockFetchWorldState.mockResolvedValue({Conquests: [], Descents: pastDescents, KnownCalendarSeasons: []});

		await loadModule();

		const firstBtn = document.querySelector('#descendia-tabs .nav-link');
		expect(firstBtn?.classList.contains('active')).toBe(true);
	});
});

describe('renderCalendarSeasonTabs', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		mockBootstrapTooltip();

		buildDom();
		(globalThis as any).getDictPromise = async () => ({});
		(globalThis as any).getOSDictPromise = async () => ({});
		(globalThis as any).toTitleCase = (s: string) => s;
		(globalThis as any).setImageSource = vi.fn();

		mockFetchWorldState.mockResolvedValue({
			Conquests: [],
			Descents: [],
			KnownCalendarSeasons: worldState.KnownCalendarSeasons,
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		clearDom();
		delete (globalThis as any).getDictPromise;
		delete (globalThis as any).getOSDictPromise;
		delete (globalThis as any).toTitleCase;
		delete (globalThis as any).setImageSource;
		delete (globalThis as any).ExportImages;
	});

	test('renders one tab per season', async () => {
		await loadModule();
		const tabs = document.querySelectorAll('#calendar-season-tabs .nav-item');
		expect(tabs.length).toBe(worldState.KnownCalendarSeasons.length);
	});

	test('renders one pane per season', async () => {
		await loadModule();
		const panes = document.querySelectorAll('#calendar-season-content .tab-pane');
		expect(panes.length).toBe(worldState.KnownCalendarSeasons.length);
	});

	test('exactly one tab is active', async () => {
		await loadModule();
		const activeTabs = document.querySelectorAll('#calendar-season-tabs .nav-link.active');
		expect(activeTabs.length).toBe(1);
	});

	test('sets globalThis.ExportImages before rendering season panes', async () => {
		const {fetchExport} = await import('../../src/public-export-fetcher');
		vi.mocked(fetchExport).mockResolvedValue({SomeImage: '/img/foo.png'});

		await loadModule();

		expect((globalThis as any).ExportImages).toBeDefined();
	});

	test('does not render tabs when KnownCalendarSeasons is empty', async () => {
		mockFetchWorldState.mockResolvedValue({Conquests: [], Descents: [], KnownCalendarSeasons: []});
		await loadModule();
		const tabs = document.querySelectorAll('#calendar-season-tabs .nav-item');
		expect(tabs.length).toBe(0);
	});
});

describe('initWeeklyForecast — tab activation preservation', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		mockBootstrapTooltip();

		buildDom();
		(globalThis as any).getDictPromise = async () => loadMock('dicts/en.json');
		(globalThis as any).getOSDictPromise = async () => loadMock('dicts/en.json');
		(globalThis as any).toTitleCase = (s: string) => s;
		(globalThis as any).setImageSource = vi.fn();

		// Multiple descents so there are tabs to switch between
		mockFetchWorldState.mockResolvedValue({
			Conquests: [],
			Descents: worldState.Descents,
			KnownCalendarSeasons: [],
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		clearDom();
		delete (globalThis as any).getDictPromise;
		delete (globalThis as any).getOSDictPromise;
		delete (globalThis as any).toTitleCase;
		delete (globalThis as any).setImageSource;
	});

	test('on first load, first tab is active (no activation to preserve)', async () => {
		await loadModule();
		const firstBtn = document.querySelector('#descendia-tabs .nav-link');
		expect(firstBtn?.classList.contains('active')).toBe(true);
	});
});

describe('initWeeklyForecast — refresh scheduling', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		mockBootstrapTooltip();

		buildDom();
		(globalThis as any).getDictPromise = async () => ({});
		(globalThis as any).getOSDictPromise = async () => ({});
		(globalThis as any).toTitleCase = (s: string) => s;
		(globalThis as any).setImageSource = vi.fn();

		mockFetchWorldState.mockResolvedValue({Conquests: [], Descents: [], KnownCalendarSeasons: []});
	});

	afterEach(() => {
		vi.useRealTimers();
		clearDom();
		delete (globalThis as any).getDictPromise;
		delete (globalThis as any).getOSDictPromise;
		delete (globalThis as any).toTitleCase;
		delete (globalThis as any).setImageSource;
	});

	test('schedules a refresh via setTimeout after initial load', async () => {
		// With fake timers installed, we can verify a pending timer exists after module load
		vi.useFakeTimers();
		vi.resetModules();
		await import('../../src/weekly-forecast.js');
		for (let i = 0; i < 30; i++) {
			await Promise.resolve();
		}

		// At least one timer should be pending (the auto-refresh)
		const pendingTimers = vi.getTimerCount();
		expect(pendingTimers).toBeGreaterThan(0);
		vi.useRealTimers();
	});
});
