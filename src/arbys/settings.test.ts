/**
 * Tests for src/arbys/settings.ts
 *
 * Covers save/load settings persistence and Load button enable/disable logic.
 * The module registers cloud-sync event listeners at import time; tests verify
 * they fire checkLoadButtonState correctly.
 */
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import process from 'node:process';
import {
	describe, test, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {JSDOM} from 'jsdom';

// Import the functions under test directly (no external module dependencies)
const {checkLoadButtonState, initializeSettingsButtons} = await import('./settings.js');

function makeDocument(): Document {
	let html = readFileSync(join(process.cwd(), 'public/arbys.html'), 'utf8');
	html = html.replaceAll(/<style>[\s\S]*?<\/style>/gu, '<style></style>');
	const dom = new JSDOM(html, {url: 'https://browse.wf/arbys'});
	return dom.window.document;
}

describe('checkLoadButtonState', () => {
	let document: Document;

	beforeEach(() => {
		document = makeDocument();
		(globalThis as any).document = document;
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	test('disables Load button when no settings in localStorage', () => {
		checkLoadButtonState();
		const btn = document.querySelector<HTMLButtonElement>('#btn-load-settings');
		expect(btn!.disabled).toBe(true);
	});

	test('enables Load button when valid settings JSON exists', () => {
		localStorage.setItem('arbys.settings', JSON.stringify({select_days: '7', filters: {}}));
		checkLoadButtonState();
		const btn = document.querySelector<HTMLButtonElement>('#btn-load-settings');
		expect(btn!.disabled).toBe(false);
	});

	test('disables Load button when settings is invalid JSON', () => {
		localStorage.setItem('arbys.settings', 'not-valid-json{');
		checkLoadButtonState();
		const btn = document.querySelector<HTMLButtonElement>('#btn-load-settings');
		expect(btn!.disabled).toBe(true);
	});

	test('returns early without throwing if button is absent', () => {
		const emptyDoc = new JSDOM('<html><body></body></html>', {url: 'https://browse.wf/arbys'}).window.document;
		(globalThis as any).document = emptyDoc;
		expect(() => {
			checkLoadButtonState();
		}).not.toThrow();
	});
});

describe('saveToLocalStorage / loadFromLocalStorage (via button handlers)', () => {
	let document: Document;

	beforeEach(() => {
		document = makeDocument();
		(globalThis as any).document = document;
		localStorage.clear();
		initializeSettingsButtons();
	});

	afterEach(() => {
		localStorage.clear();
	});

	test('Save button writes select values and filter states to localStorage', () => {
		document.querySelector<HTMLSelectElement>('#select-days')!.value = '7';
		document.querySelector<HTMLSelectElement>('#select-tz')!.value = 'zulu';
		document.querySelector<HTMLSelectElement>('#select-hourfmt')!.value = '12';

		// Uncheck one filter
		const checkbox = document.querySelector<HTMLInputElement>('#filter-MT_SURVIVAL');
		checkbox!.checked = false;

		document.querySelector('#btn-save-settings')!.dispatchEvent(new Event('click'));

		const stored = JSON.parse(localStorage.getItem('arbys.settings')!) as Record<string, unknown>;
		expect(stored.select_days).toBe('7');
		expect(stored.select_tz).toBe('zulu');
		expect(stored.select_hourfmt).toBe('12');
		expect((stored.filters as Record<string, boolean>).MT_SURVIVAL).toBe(false);
	});

	test('Save button enables Load button after saving', () => {
		document.querySelector('#btn-save-settings')!.dispatchEvent(new Event('click'));
		const btnLoad = document.querySelector<HTMLButtonElement>('#btn-load-settings');
		expect(btnLoad!.disabled).toBe(false);
	});

	test('Load button restores settings from localStorage', () => {
		const settings = {
			select_days: '30',
			select_tz: 'zulu',
			select_hourfmt: '24',
			filters: {MT_SURVIVAL: false, FC_GRINEER: false},
		};
		localStorage.setItem('arbys.settings', JSON.stringify(settings));

		// Enable the Load button first (mimics checkLoadButtonState())
		document.querySelector<HTMLButtonElement>('#btn-load-settings')!.disabled = false;

		document.querySelector('#btn-load-settings')!.dispatchEvent(new Event('click'));

		expect(document.querySelector<HTMLSelectElement>('#select-days')!.value).toBe('30');
		expect(document.querySelector<HTMLSelectElement>('#select-tz')!.value).toBe('zulu');
		expect(document.querySelector<HTMLSelectElement>('#select-hourfmt')!.value).toBe('24');
		expect(document.querySelector<HTMLInputElement>('#filter-MT_SURVIVAL')!.checked).toBe(false);
		expect(document.querySelector<HTMLInputElement>('#filter-FC_GRINEER')!.checked).toBe(false);
	});

	test('Load button calls updateLog and saveSettings if available', () => {
		const mockUpdateLog = vi.fn();
		const mockSaveSettings = vi.fn();
		(globalThis as any).arbys = [[0, 'node']];
		(globalThis as any).updateLog = mockUpdateLog;
		(globalThis as any).saveSettings = mockSaveSettings;

		localStorage.setItem('arbys.settings', JSON.stringify({select_days: '7', filters: {}}));
		document.querySelector<HTMLButtonElement>('#btn-load-settings')!.disabled = false;
		document.querySelector('#btn-load-settings')!.dispatchEvent(new Event('click'));

		expect(mockUpdateLog).toHaveBeenCalled();
		expect(mockSaveSettings).toHaveBeenCalled();

		// Cleanup
		delete (globalThis as any).arbys;
		delete (globalThis as any).updateLog;
		delete (globalThis as any).saveSettings;
	});
});

describe('cloud-sync event listeners', () => {
	let document: Document;

	beforeEach(() => {
		document = makeDocument();
		(globalThis as any).document = document;
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	test('cloud-sync-pulled re-checks Load button state', () => {
		localStorage.setItem('arbys.settings', JSON.stringify({select_days: '7', filters: {}}));
		globalThis.dispatchEvent(new CustomEvent('cloud-sync-pulled'));
		const btn = document.querySelector<HTMLButtonElement>('#btn-load-settings');
		expect(btn!.disabled).toBe(false);
	});
});
