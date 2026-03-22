/**
 * Integration tests for the async tab-rendering functions in src/weekly-forecast.ts:
 *   - renderConquestTabs  (via initWeeklyForecast with CT_LAB / CT_HEX data)
 *   - renderDescentTabs   (via initWeeklyForecast with Descents data)
 *   - renderCalendarSeasonTabs (via initWeeklyForecast with KnownCalendarSeasons data)
 *   - initWeeklyMissionsNotice
 *   - initWeeklyForecast  (main entry point — conditional rendering, tab preservation)
 */
import {
	describe, test, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {loadMock} from '../helpers/api-mocks';
import {mockBootstrapTooltip} from '../helpers/dom-helpers';
import {freezeTime, MOCK_TIMESTAMP} from '../helpers/time-helpers';
import {initWeeklyForecast, initWeeklyMissionsNotice} from '../../src/weekly-forecast';

const {mockFetchWorldState} = vi.hoisted(() => ({
	mockFetchWorldState: vi.fn().mockResolvedValue({Conquests: [], Descents: [], KnownCalendarSeasons: []}),
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

vi.mock('../../src/short-timer-badge', () => ({
	createShortTimerBadge: vi.fn(() => {
		const span = document.createElement('span');
		span.className = 'arby-badge';
		return span;
	}),
}));

const worldState = loadMock('worldState.json');

afterEach(() => {
	vi.useRealTimers();
	clearDom();
	delete (globalThis as any).ExportImages;
	delete (globalThis as any).getDictPromise;
	delete (globalThis as any).getOSDictPromise;
	delete (globalThis as any).setImageSource;
	delete (globalThis as any).toTitleCase;
});

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

		<div id="calendar-season-columns"></div>
		<ul id="calendar-season-tabs" class="nav nav-tabs"></ul>
		<div id="calendar-season-content" class="tab-content"></div>
	`;
}

function clearDom() {
	document.body.innerHTML = '';
}

type SetupOptions = {
	dict?: Record<string, string>;
	setImageSource?: boolean;
};

async function setup(partialWorldState: Record<string, unknown>, timestamp: number = MOCK_TIMESTAMP, options: SetupOptions = {}) {
	vi.clearAllMocks();
	mockBootstrapTooltip();

	buildDom();
	const dict = options.dict ?? {};
	(globalThis as any).getDictPromise = async () => dict;
	(globalThis as any).getOSDictPromise = async () => dict;
	(globalThis as any).toTitleCase = (s: string) => s;
	if (options.setImageSource) {
		(globalThis as any).setImageSource = vi.fn();
	}

	mockFetchWorldState.mockResolvedValue({
		Conquests: [], Descents: [], KnownCalendarSeasons: [], ...partialWorldState,
	});

	vi.useFakeTimers();
	freezeTime(timestamp);
	await initWeeklyForecast();
}

describe('initWeeklyMissionsNotice', () => {
	beforeEach(async () => {
		await setup({});
	});

	test('appends a countdown badge inside #weekly-missions-timer', () => {
		initWeeklyMissionsNotice();
		const timer = document.querySelector('#weekly-missions-timer')!;
		expect(timer.querySelector('.arby-badge')).not.toBeNull();
	});

	test('does nothing when #weekly-missions-timer is absent', () => {
		document.querySelector('#weekly-missions-timer')!.remove();
		expect(() => {
			initWeeklyMissionsNotice();
		}).not.toThrow();
	});
});

describe('renderConquestTabs — CT_LAB (Deep Archimedea)', () => {
	beforeEach(async () => {
		await setup({Conquests: worldState.Conquests.filter((c: any) => c.Type === 'CT_LAB')});
	});

	test('renders at least one nav tab in #lab-conquest-tabs', () => {
		const tabs = document.querySelectorAll('#lab-conquest-tabs .nav-item');
		expect(tabs.length).toBeGreaterThan(0);
	});

	test('renders a corresponding tab pane in #lab-conquest-content', () => {
		const panes = document.querySelectorAll('#lab-conquest-content .tab-pane');
		expect(panes.length).toBeGreaterThan(0);
	});

	test('first tab is marked active', () => {
		const activeBtn = document.querySelector('#lab-conquest-tabs .nav-link.active');
		expect(activeBtn).not.toBeNull();
	});

	test('each tab pane contains a missions table', () => {
		const panes = document.querySelectorAll('#lab-conquest-content .tab-pane');
		for (const pane of panes) {
			expect(pane.querySelector('table')).not.toBeNull();
		}
	});

	test('does not render tabs when no CT_LAB conquests exist', async () => {
		mockFetchWorldState.mockResolvedValue({Conquests: [], Descents: [], KnownCalendarSeasons: []});
		clearDom();
		buildDom();
		await initWeeklyForecast();
		const tabs = document.querySelectorAll('#lab-conquest-tabs .nav-item');
		expect(tabs.length).toBe(0);
	});

	test('does not render tabs when #lab-conquest-tabs is absent', async () => {
		document.querySelector('#lab-conquest-tabs')!.remove();
		document.querySelector('#lab-conquest-content')!.remove();
		await expect(initWeeklyForecast()).resolves.not.toThrow();
	});
});

describe('renderConquestTabs — CT_HEX (Temporal Archimedea)', () => {
	beforeEach(async () => {
		await setup({Conquests: worldState.Conquests.filter((c: any) => c.Type === 'CT_HEX')});
	});

	test('renders at least one nav tab in #hex-conquest-tabs', () => {
		const tabs = document.querySelectorAll('#hex-conquest-tabs .nav-item');
		expect(tabs.length).toBeGreaterThan(0);
	});

	test('renders a corresponding tab pane in #hex-conquest-content', () => {
		const panes = document.querySelectorAll('#hex-conquest-content .tab-pane');
		expect(panes.length).toBeGreaterThan(0);
	});
});

describe('renderDescentTabs', () => {
	beforeEach(async () => {
		await setup({Descents: worldState.Descents}, MOCK_TIMESTAMP, {dict: loadMock('dicts/en.json')});
	});

	test('renders one tab per descent entry', () => {
		const tabs = document.querySelectorAll('#descendia-tabs .nav-item');
		expect(tabs.length).toBe(worldState.Descents.length);
	});

	test('renders one pane per descent entry', () => {
		const panes = document.querySelectorAll('#descendia-content .tab-pane');
		expect(panes.length).toBe(worldState.Descents.length);
	});

	test('exactly one tab is active', () => {
		const activeTabs = document.querySelectorAll('#descendia-tabs .nav-link.active');
		expect(activeTabs.length).toBe(1);
	});

	test('each pane contains a challenges table', () => {
		const panes = document.querySelectorAll('#descendia-content .tab-pane');
		for (const pane of panes) {
			expect(pane.querySelector('table')).not.toBeNull();
		}
	});

	test('table has column headers: #, Type, Challenge, Arena, Specs & Auras', () => {
		const firstPane = document.querySelector('#descendia-content .tab-pane')!;
		const ths = firstPane.querySelectorAll('thead th');
		const headers = [...ths].map(th => th.textContent);
		expect(headers).toEqual(['#', 'Type', 'Challenge', 'Arena', 'Specs & Auras']);
	});

	test('does not render tabs when Descents is empty', async () => {
		mockFetchWorldState.mockResolvedValue({Conquests: [], Descents: [], KnownCalendarSeasons: []});
		clearDom();
		buildDom();
		await initWeeklyForecast();
		const tabs = document.querySelectorAll('#descendia-tabs .nav-item');
		expect(tabs.length).toBe(0);
	});

	test('second tab is active (first future descent at MOCK_TIMESTAMP)', () => {
		// At MOCK_TIMESTAMP (Jan 10): descent 0 (Jan 5–12) is active, descent 1 (Jan 12) is first future
		const allBtns = document.querySelectorAll('#descendia-tabs .nav-link');
		expect(allBtns[0]?.classList.contains('active')).toBe(false);
		expect(allBtns[1]?.classList.contains('active')).toBe(true);
	});
});

describe('renderDescentTabs — all descents in the past', () => {
	// Last descent expires Feb 16; freeze 7 weeks after MOCK_TIMESTAMP so all are in the past
	const week = 7 * 24 * 60 * 60 * 1000;

	beforeEach(async () => {
		await setup({Descents: worldState.Descents}, MOCK_TIMESTAMP + (7 * week), {dict: loadMock('dicts/en.json')});
	});

	test('first tab is active when no future descent exists', () => {
		const firstBtn = document.querySelector('#descendia-tabs .nav-link');
		expect(firstBtn?.classList.contains('active')).toBe(true);
	});
});

describe('renderCalendarSeasonTabs', () => {
	beforeEach(async () => {
		await setup({KnownCalendarSeasons: worldState.KnownCalendarSeasons}, MOCK_TIMESTAMP, {setImageSource: true});
	});

	test('renders one tab per season', () => {
		const tabs = document.querySelectorAll('#calendar-season-tabs .nav-item');
		expect(tabs.length).toBe(worldState.KnownCalendarSeasons.length);
	});

	test('renders one pane per season', () => {
		const panes = document.querySelectorAll('#calendar-season-content .tab-pane');
		expect(panes.length).toBe(worldState.KnownCalendarSeasons.length);
	});

	test('exactly one tab is active', () => {
		const activeTabs = document.querySelectorAll('#calendar-season-tabs .nav-link.active');
		expect(activeTabs.length).toBe(1);
	});

	test('sets globalThis.ExportImages before rendering season panes', () => {
		expect((globalThis as any).ExportImages).toBeDefined();
	});

	test('does not render tabs when KnownCalendarSeasons is empty', async () => {
		mockFetchWorldState.mockResolvedValue({Conquests: [], Descents: [], KnownCalendarSeasons: []});
		clearDom();
		buildDom();
		await initWeeklyForecast();
		const tabs = document.querySelectorAll('#calendar-season-tabs .nav-item');
		expect(tabs.length).toBe(0);
	});

	test('renders season columns in #calendar-season-columns', () => {
		const columns = document.querySelector('#calendar-season-columns');
		expect(columns).not.toBeNull();
		expect(columns!.children.length).toBeGreaterThan(0);
	});

	test('each season gets a column in the two-column layout', () => {
		const cols = document.querySelectorAll('#calendar-season-columns .col-6');
		expect(cols.length).toBe(worldState.KnownCalendarSeasons.length);
	});
});

describe('initWeeklyForecast — refresh scheduling', () => {
	beforeEach(async () => {
		await setup({});
	});

	test('schedules a refresh via setTimeout after initial load', () => {
		expect(vi.getTimerCount()).toBeGreaterThan(0);
	});
});
