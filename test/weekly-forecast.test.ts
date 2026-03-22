/**
 * Unit tests for pure utility functions in src/weekly-forecast.ts.
 *
 * Covers: mongoMs, formatTabDate, nextForecastPublishedSeconds,
 *         buildTab, getActiveTabActivation, restoreActiveTab.
 *
 * warframe-api-proxy-client is mocked to prevent the module's top-level await from firing.
 */
import {
	describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';
import {
	mongoMs,
	formatTabDate,
	buildTab,
	getActiveTabActivation,
	restoreActiveTab,
	nextForecastPublishedSeconds,
} from '../src/weekly-forecast.js';

vi.mock('../src/warframe-api-proxy-client', () => ({
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

describe('nextForecastPublishedSeconds', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	test('returns a future timestamp (seconds)', () => {
		vi.useFakeTimers();
		// Wednesday, so next Sunday is 4 days away
		vi.setSystemTime(new Date('2026-03-18T12:00:00Z'));
		const result = nextForecastPublishedSeconds();
		expect(result).toBeGreaterThan(Date.now() / 1000);
	});

	test('when it is Sunday before 23:02 UTC, returns today', () => {
		vi.useFakeTimers();
		// Sunday 2026-03-22 at 20:00 UTC — still before 23:02
		vi.setSystemTime(new Date('2026-03-22T20:00:00Z'));
		const result = nextForecastPublishedSeconds();
		const target = new Date('2026-03-22T23:02:00Z');
		expect(result).toBe(Math.floor(target.getTime() / 1000));
	});

	test('when it is Sunday after 23:02 UTC, returns next Sunday', () => {
		vi.useFakeTimers();
		// Sunday 2026-03-22 at 23:30 UTC — after 23:02
		vi.setSystemTime(new Date('2026-03-22T23:30:00Z'));
		const result = nextForecastPublishedSeconds();
		const nextSunday = new Date('2026-03-29T23:02:00Z');
		expect(result).toBe(Math.floor(nextSunday.getTime() / 1000));
	});

	test('result time is always 23:02 UTC', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-03-20T10:00:00Z')); // Friday
		const result = nextForecastPublishedSeconds();
		const date = new Date(result * 1000);
		expect(date.getUTCHours()).toBe(23);
		expect(date.getUTCMinutes()).toBe(2);
		expect(date.getUTCSeconds()).toBe(0);
	});

	test('result day is always Sunday', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-03-20T10:00:00Z')); // Friday
		const result = nextForecastPublishedSeconds();
		const date = new Date(result * 1000);
		expect(date.getUTCDay()).toBe(0); // Sunday
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

describe('getActiveTabActivation', () => {
	test('returns data-activation of the active nav-link', () => {
		const tabs = document.createElement('ul');
		tabs.innerHTML = `
			<li><button class="nav-link" data-activation="111"></button></li>
			<li><button class="nav-link active" data-activation="222"></button></li>
		`;
		expect(getActiveTabActivation(tabs)).toBe('222');
	});

	test('returns undefined when no tab is active', () => {
		const tabs = document.createElement('ul');
		tabs.innerHTML = '<li><button class="nav-link" data-activation="111"></button></li>';
		expect(getActiveTabActivation(tabs)).toBeUndefined();
	});

	test('returns undefined for empty tabs element', () => {
		const tabs = document.createElement('ul');
		expect(getActiveTabActivation(tabs)).toBeUndefined();
	});
});

describe('restoreActiveTab', () => {
	let tabsElement: HTMLElement;
	let contentElement: HTMLElement;

	beforeEach(() => {
		tabsElement = document.createElement('ul');
		tabsElement.id = 'restore-tabs';
		contentElement = document.createElement('div');
		contentElement.id = 'restore-content';
		document.body.append(tabsElement);
		document.body.append(contentElement);
	});

	afterEach(() => {
		tabsElement.remove();
		contentElement.remove();
	});

	function addTab(activation: string, id: string, active: boolean) {
		const li = document.createElement('li');
		const btn = document.createElement('button');
		btn.className = 'nav-link' + (active ? ' active' : '');
		btn.dataset.activation = activation;
		btn.dataset.bsTarget = `#${id}`;
		li.append(btn);
		tabsElement.append(li);

		const pane = document.createElement('div');
		pane.id = id;
		pane.className = 'tab-pane fade' + (active ? ' show active' : '');
		contentElement.append(pane);
	}

	test('switches active tab to the one matching activation', () => {
		addTab('100', 'pane-0', true);
		addTab('200', 'pane-1', false);

		restoreActiveTab(tabsElement, '200');

		const btns = tabsElement.querySelectorAll('.nav-link');
		expect(btns[0].classList.contains('active')).toBe(false);
		expect(btns[1].classList.contains('active')).toBe(true);
	});

	test('switches active pane to match the restored tab', () => {
		addTab('100', 'pane-0', true);
		addTab('200', 'pane-1', false);

		restoreActiveTab(tabsElement, '200');

		const panes = contentElement.querySelectorAll('.tab-pane');
		expect(panes[0].classList.contains('active')).toBe(false);
		expect(panes[1].classList.contains('active')).toBe(true);
		expect(panes[1].classList.contains('show')).toBe(true);
	});

	test('no-ops when activation timestamp is not found', () => {
		addTab('100', 'pane-0', true);

		restoreActiveTab(tabsElement, '999');

		// First tab should still be active
		const btn = tabsElement.querySelector('.nav-link')!;
		expect(btn.classList.contains('active')).toBe(true);
	});
});
