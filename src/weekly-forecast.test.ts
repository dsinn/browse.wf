/**
 Unit tests for pure utility functions in src/weekly-forecast.ts.

 Covers: mongoMs, formatTabDate, nextForecastPublishedMs,
 buildTab.

 warframe-api-proxy-client is mocked to prevent the module's top-level await from firing.
 */
import {
	describe,
	test,
	expect,
	vi,
	beforeEach,
	afterEach,
} from 'vitest';
import {
	mongoMs,
	formatTabDate,
	buildTab,
	nextForecastPublishedMs,
} from './weekly-forecast.js';

vi.mock('./warframe-api-proxy-client', () => ({
	WarframeApiFrontProxyClient: {
		fetchWorldState: vi.fn().mockResolvedValue({Conquests: [], Descents: [], KnownCalendarSeasons: []}),
	},
}));

describe('mongoMs', () => {
	test('converts a MongoDB date object to milliseconds', () => {
		const d = {$date: {$numberLong: '1700000000000'}};
		expect(mongoMs(d)).toBe(1_700_000_000_000);
	});

	test('handles zero', () => {
		expect(mongoMs({$date: {$numberLong: '0'}})).toBe(0);
	});

	test('handles large timestamps', () => {
		const ts = 9_999_999_999_999;
		expect(mongoMs({$date: {$numberLong: String(ts)}})).toBe(ts);
	});
});

describe('formatTabDate', () => {
	test('formats milliseconds as a short month + day', () => {
		// 2024-01-15T00:00:00.000Z
		const ms = Date.UTC(2024, 0, 15);
		const result = formatTabDate(ms);
		expect(result).toMatch(/^Jan 1[45]$/u); // Locale may render 14 or 15 depending on timezone
	});

	test('returns a string containing a month abbreviation and a day number', () => {
		const ms = Date.UTC(2025, 5, 3); // June 3 UTC
		const result = formatTabDate(ms);
		expect(result).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/u);
	});
});

describe('nextForecastPublishedMs', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	test('returns a future timestamp (milliseconds)', () => {
		vi.useFakeTimers();
		// Wednesday, so next Sunday is 4 days away
		vi.setSystemTime(new Date('2026-03-18T12:00:00Z'));
		const result = nextForecastPublishedMs();
		expect(result).toBeGreaterThan(Date.now());
	});

	test('when it is Sunday before 23:02 UTC, returns today', () => {
		vi.useFakeTimers();
		// Sunday 2026-03-22 at 20:00 UTC — still before 23:02
		vi.setSystemTime(new Date('2026-03-22T20:00:00Z'));
		expect(nextForecastPublishedMs()).toBe(new Date('2026-03-22T23:02:00Z').getTime());
	});

	test('when it is Sunday after 23:02 UTC, returns next Sunday', () => {
		vi.useFakeTimers();
		// Sunday 2026-03-22 at 23:30 UTC — after 23:02
		vi.setSystemTime(new Date('2026-03-22T23:30:00Z'));
		expect(nextForecastPublishedMs()).toBe(new Date('2026-03-29T23:02:00Z').getTime());
	});

	test('result time is always 23:02 UTC', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-03-20T10:00:00Z')); // Friday
		const date = new Date(nextForecastPublishedMs());
		expect(date.getUTCHours()).toBe(23);
		expect(date.getUTCMinutes()).toBe(2);
		expect(date.getUTCSeconds()).toBe(0);
	});

	test('result day is always Sunday', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-03-20T10:00:00Z')); // Friday
		expect(new Date(nextForecastPublishedMs()).getUTCDay()).toBe(0);
	});

	test('when in the Sunday 23:02–Monday 00:00 window, returns next Sunday', () => {
		vi.useFakeTimers();
		// Sunday 2026-03-22 at 23:45 UTC — past 23:02, before Monday reset
		vi.setSystemTime(new Date('2026-03-22T23:45:00Z'));
		expect(nextForecastPublishedMs()).toBe(new Date('2026-03-29T23:02:00Z').getTime());
	});
});

function noop(_pane: HTMLElement): void {
	// No-op: buildTab callback not needed for these assertions
}

describe('buildTab', () => {
	let tabsElement: HTMLElement;
	let contentElement: HTMLElement;

	beforeEach(() => {
		tabsElement = document.createElement('ul');
		tabsElement.id = 'test-tabs';
		contentElement = document.createElement('div');
		contentElement.id = 'test-content';
		document.body.append(tabsElement);
		document.body.append(contentElement);
	});

	afterEach(() => {
		tabsElement.remove();
		contentElement.remove();
	});

	test('appends a nav-item to tabsElement', () => {
		buildTab(tabsElement, contentElement, 'tab-0', 'Jan 1', 1000, false, noop);
		expect(tabsElement.querySelectorAll('.nav-item')).toHaveLength(1);
	});

	test('appends a tab pane to contentElement', () => {
		buildTab(tabsElement, contentElement, 'tab-0', 'Jan 1', 1000, false, noop);
		expect(contentElement.querySelectorAll('.tab-pane')).toHaveLength(1);
	});

	test('button has correct id, data-bs-target, and data-activation', () => {
		buildTab(tabsElement, contentElement, 'tab-0', 'Jan 1', 1_234_567, false, noop);
		const btn = tabsElement.querySelector<HTMLElement>('#tab-0-tab')!;
		expect(btn).not.toBeNull();
		expect(btn.dataset.bsTarget).toBe('#tab-0');
		expect(btn.dataset.activation).toBe('1234567');
	});

	test('button label matches provided label', () => {
		buildTab(tabsElement, contentElement, 'tab-0', 'Mar 22', 1000, false, noop);
		const btn = tabsElement.querySelector('button')!;
		expect(btn.textContent).toBe('Mar 22');
	});

	test('active=true adds active class to button and pane', () => {
		buildTab(tabsElement, contentElement, 'tab-0', 'Jan 1', 1000, true, noop);
		const btn = tabsElement.querySelector('button')!;
		const pane = contentElement.querySelector('.tab-pane')!;
		expect(btn.classList.contains('active')).toBe(true);
		expect(pane.classList.contains('active')).toBe(true);
		expect(pane.classList.contains('show')).toBe(true);
	});

	test('active=false does not add active class', () => {
		buildTab(tabsElement, contentElement, 'tab-0', 'Jan 1', 1000, false, noop);
		const btn = tabsElement.querySelector('button')!;
		const pane = contentElement.querySelector('.tab-pane')!;
		expect(btn.classList.contains('active')).toBe(false);
		expect(pane.classList.contains('active')).toBe(false);
	});

	test('buildContent callback receives the pane element', () => {
		let receivedPane: HTMLElement | undefined;
		buildTab(tabsElement, contentElement, 'tab-0', 'Jan 1', 1000, false, pane => {
			receivedPane = pane;
		});
		const actualPane = contentElement.querySelector('.tab-pane')!;
		expect(receivedPane).toBe(actualPane);
	});

	test('content added in buildContent appears inside the pane', () => {
		buildTab(tabsElement, contentElement, 'tab-0', 'Jan 1', 1000, false, pane => {
			const span = document.createElement('span');
			span.textContent = 'hello';
			pane.append(span);
		});
		const pane = contentElement.querySelector('.tab-pane')!;
		expect(pane.querySelector('span')?.textContent).toBe('hello');
	});
});
