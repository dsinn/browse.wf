/**
 * Tests for the Steel Path Incursion Schedule page (incursions.ts)
 *
 * Tests cover:
 * - HTML structure from the rendered fixture
 * - Pure helper functions that can be tested in isolation
 */
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import process from 'node:process';
import {
	describe, test, expect, beforeEach, vi,
} from 'vitest';
import {JSDOM} from 'jsdom';
import {loadFixture} from '@test/helpers/fixture-loader';
import {setupMockFetch, mockEndpoint} from '@test/helpers/api-mocks';
import {mockBootstrapTooltip} from '@test/helpers/dom-helpers';
import {SECONDS_PER_DAY} from './helpers/time-helpers';

describe('Steel Path Incursion Schedule (/incursions) - HTML structure', () => {
	let dom: JSDOM;
	let document: Document;

	beforeEach(() => {
		let html = readFileSync(join(process.cwd(), 'public/incursions.html'), 'utf8');
		html = html.replaceAll(/<style>[\s\S]*?<\/style>/gu, '<style></style>');

		dom = new JSDOM(html, {
			url: 'http://localhost/incursions',
		});
		document = dom.window.document;
	});

	describe('Controls bar', () => {
		test('Today button exists', () => {
			expect(document.querySelector('#btn-today')).toBeTruthy();
		});

		test('Previous button exists', () => {
			expect(document.querySelector('#btn-prev')).toBeTruthy();
		});

		test('Next button exists', () => {
			expect(document.querySelector('#btn-next')).toBeTruthy();
		});

		test('Month selector has 12 options', () => {
			const select = document.querySelector<HTMLSelectElement>('#select-month');
			expect(select).toBeTruthy();
			expect(select!.options.length).toBe(12);
		});

		test('Month selector first option is January (value "0")', () => {
			const select = document.querySelector<HTMLSelectElement>('#select-month');
			expect(select!.options[0].value).toBe('0');
			expect(select!.options[0].textContent).toBe('January');
		});

		test('Month selector last option is December (value "11")', () => {
			const select = document.querySelector<HTMLSelectElement>('#select-month');
			const last = select!.options[select!.options.length - 1];
			expect(last.value).toBe('11');
			expect(last.textContent).toBe('December');
		});

		test('Year selector exists (populated dynamically)', () => {
			expect(document.querySelector('#select-year')).toBeTruthy();
		});

		test('List view button exists', () => {
			expect(document.querySelector('#btn-view-list')).toBeTruthy();
		});

		test('Table view button exists', () => {
			expect(document.querySelector('#btn-view-table')).toBeTruthy();
		});

		test('Calendar view button exists', () => {
			expect(document.querySelector('#btn-view-calendar')).toBeTruthy();
		});

		test('view button order: List, Table, Calendar', () => {
			const buttons = document.querySelectorAll('#btn-view-list, #btn-view-table, #btn-view-calendar');
			const ids = [...buttons].map(b => b.id);
			expect(ids).toEqual(['btn-view-list', 'btn-view-table', 'btn-view-calendar']);
		});
	});

	describe('Schedule container', () => {
		test('schedule element exists with loading message', () => {
			const schedule = document.querySelector('#schedule');
			expect(schedule).toBeTruthy();
			expect(schedule!.textContent).toContain('Loading, please wait...');
		});
	});
});

// ========== Pure function tests ==========

// `getIncursionsForDay` uses module-level state (epochDay, incursions),
// so a standalone pure version is used to allow controlled input in unit tests.
function getIncursionsForDay(
	utcDayTimestamp: number,
	epochDay: number,
	incursions: Array<[number, string]>,
): string[] | undefined {
	if (epochDay === -1) {
		return undefined;
	}

	const index = (utcDayTimestamp - epochDay) / SECONDS_PER_DAY;
	if (index < 0 || index >= incursions.length) {
		return undefined;
	}

	return incursions[index][1].split(',');
}

describe('getIncursionsForDay', () => {
	const epoch = 1_736_726_400; // 2025-01-13 UTC
	const incursions: Array<[number, string]> = [
		[epoch, 'SolNode1,SolNode2,SolNode3,SolNode4,SolNode5,SolNode6'],
		[epoch + SECONDS_PER_DAY, 'SolNode7,SolNode8,SolNode9,SolNode10,SolNode11,SolNode12'],
	];

	test('returns node list for epoch day', () => {
		const nodes = getIncursionsForDay(epoch, epoch, incursions);
		expect(nodes).toEqual(['SolNode1', 'SolNode2', 'SolNode3', 'SolNode4', 'SolNode5', 'SolNode6']);
	});

	test('returns node list for the next day', () => {
		const nodes = getIncursionsForDay(epoch + SECONDS_PER_DAY, epoch, incursions);
		expect(nodes).toEqual(['SolNode7', 'SolNode8', 'SolNode9', 'SolNode10', 'SolNode11', 'SolNode12']);
	});

	test('returns undefined for a day before epoch', () => {
		expect(getIncursionsForDay(epoch - SECONDS_PER_DAY, epoch, incursions)).toBeUndefined();
	});

	test('returns undefined for a day after the last entry', () => {
		expect(getIncursionsForDay(epoch + (2 * SECONDS_PER_DAY), epoch, incursions)).toBeUndefined();
	});

	test('returns undefined when epochDay is -1 (unset)', () => {
		expect(getIncursionsForDay(epoch, -1, incursions)).toBeUndefined();
	});
});

describe('sp-incursions.txt parsing', () => {
	test('file has lines in "timestamp;node1,node2,...,node6" format', () => {
		const text = readFileSync(join(process.cwd(), 'sp-incursions.txt'), 'utf8');
		const lines = text.split('\n').filter(Boolean);
		expect(lines.length).toBeGreaterThan(0);

		for (const line of lines.slice(0, 5)) {
			const parts = line.split(';');
			expect(parts.length).toBe(2);
			const timestamp = Number.parseInt(parts[0], 10);
			expect(Number.isNaN(timestamp)).toBe(false);
			expect(timestamp % SECONDS_PER_DAY).toBe(0); // Always a UTC day boundary
			const nodes = parts[1].split(',');
			expect(nodes.length).toBe(6);
		}
	});

	test('timestamps are strictly increasing by one day', () => {
		const text = readFileSync(join(process.cwd(), 'sp-incursions.txt'), 'utf8');
		const lines = text.split('\n').filter(Boolean);
		const timestamps = lines.map(l => Number.parseInt(l.split(';')[0], 10));

		for (let i = 1; i < Math.min(timestamps.length, 10); i++) {
			expect(timestamps[i] - timestamps[i - 1]).toBe(SECONDS_PER_DAY);
		}
	});
});

describe('loadIncursionData', () => {
	beforeEach(() => {
		document.body.innerHTML = loadFixture('incursions');

		(globalThis as any).ResizeObserver = class {
			observe = vi.fn();
		};

		setupMockFetch();
		mockEndpoint('sp-incursions.txt', readFileSync(join(process.cwd(), 'sp-incursions.txt'), 'utf8'));
		mockBootstrapTooltip();

		(globalThis as any).toTitleCase = (s: string) => s;
		(globalThis as any).setImageSource = vi.fn();
		(globalThis as any).addTooltip = vi.fn();

		(globalThis as any).getTileset = () => undefined;
		(globalThis as any).formatTileset = () => undefined;
		(globalThis as any).makeArchwingIcon = () => document.createElement('img');

		vi.resetModules();
	});

	test('populates the year selector with options derived from sp-incursions.txt', async () => {
		const {loadData} = await import('./incursions');
		await loadData();
		const options = document.querySelectorAll('#select-year option');
		expect(options.length).toBeGreaterThan(0);
	});
});
