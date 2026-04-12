/**
 * Tests for src/live/red-text.ts
 */
import {
	describe, test, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {SECONDS_PER_DAY} from '../helpers/time-helpers';
import {updateRedText} from './red-text';

const NOW_S = 1_768_087_200; // 2026-01-10 12:00:00 UTC in seconds
const NOW_MS = NOW_S * 1000;

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(NOW_MS);

	// Minimal DOM — include toggle so click-delegation tests can fire
	document.body.innerHTML = `
		<span data-collapse-toggle="red-text"></span>
		<div id="red-text-body">Loading...</div>
	`;

	// Clear redtext and localStorage
	delete (globalThis as any).redtext;
	localStorage.clear();
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('updateRedText', () => {
	test('skips render when card is collapsed', () => {
		localStorage.setItem('live.collapse.red-text', '1');
		(globalThis as any).redtext = [{data: 'WALLOPS :hello', time: NOW_S - 100}];
		updateRedText();
		expect(document.querySelector('#red-text-body')!.innerHTML).toBe('Loading...');
	});

	test('initiates fetch when redtext is not loaded', () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
			json: async () => [],
		} as any);
		updateRedText();
		expect(fetchSpy).toHaveBeenCalledWith('https://oracle.browse.wf/redtext.json');
	});

	test('does not fetch when redtext sentinel (empty array) is set', () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		(globalThis as any).redtext = []; // Sentinel
		updateRedText();
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	test('shows empty message when no items within 30 days', () => {
		const oldTime = NOW_S - (31 * SECONDS_PER_DAY);
		(globalThis as any).redtext = [{data: 'WALLOPS :old message', time: oldTime}];
		updateRedText();
		expect(document.querySelector('#red-text-body')!.textContent).toBe('No red text in the past 30 days.');
	});

	test('renders items within the 30-day cutoff', () => {
		(globalThis as any).redtext = [
			{data: 'WALLOPS :first message', time: NOW_S - 100},
			{data: 'WALLOPS :second message', time: NOW_S - 200},
		];
		updateRedText();
		const items = document.querySelectorAll('#red-text-body p');
		expect(items).toHaveLength(2);
	});

	test('strips WALLOPS prefix from message text', () => {
		(globalThis as any).redtext = [{data: 'WALLOPS :hello warframe', time: NOW_S - 100}];
		updateRedText();
		const span = document.querySelector('#red-text-body .text-danger-emphasis');
		expect(span?.textContent).toBe('hello warframe');
	});

	test('renders items newest-first', () => {
		(globalThis as any).redtext = [
			{data: 'WALLOPS :older', time: NOW_S - 200},
			{data: 'WALLOPS :newer', time: NOW_S - 100},
		];
		updateRedText();
		const spans = document.querySelectorAll('#red-text-body .text-danger-emphasis');
		expect(spans[0].textContent).toBe('newer');
		expect(spans[1].textContent).toBe('older');
	});

	test('sets data-activation on badge', () => {
		(globalThis as any).redtext = [{data: 'WALLOPS :test', time: NOW_S - 100}];
		updateRedText();
		const badge = document.querySelector<HTMLElement>('#red-text-body .badge');
		expect(badge?.dataset.activation).toBe(String((NOW_S - 100) * 1000));
	});

	test('uses formatActivation when available', () => {
		(globalThis as any).formatActivation = vi.fn(() => 'just now');
		(globalThis as any).redtext = [{data: 'WALLOPS :test', time: NOW_S - 100}];
		updateRedText();
		expect((globalThis as any).formatActivation).toHaveBeenCalledWith((NOW_S - 100) * 1000);
		expect(document.querySelector('#red-text-body .badge')?.textContent).toBe('just now');
		delete (globalThis as any).formatActivation;
	});

	test('exposes updateRedText globally', () => {
		expect(typeof (globalThis as any).updateRedText).toBe('function');
	});

	test('resets redtext to undefined on fetch failure, allowing retry', async () => {
		vi.useRealTimers();
		vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'));
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
			// Swallow expected error output
		});
		updateRedText();
		// Wait for the microtask queue to drain
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();
		expect((globalThis as any).redtext).toBeUndefined();
		consoleSpy.mockRestore();
	});

	test('collapse toggle click calls updateRedText when card is expanded', () => {
		(globalThis as any).redtext = [{data: 'WALLOPS :click test', time: NOW_S - 100}];

		document.querySelector<HTMLElement>('[data-collapse-toggle="red-text"]')!.click();

		expect(document.querySelector('#red-text-body .text-danger-emphasis')?.textContent).toBe('click test');
	});

	test('collapse toggle click does nothing when card is collapsed', () => {
		localStorage.setItem('live.collapse.red-text', '1');
		(globalThis as any).redtext = [{data: 'WALLOPS :should not render', time: NOW_S - 100}];

		document.querySelector<HTMLElement>('[data-collapse-toggle="red-text"]')!.click();

		expect(document.querySelector('#red-text-body')!.innerHTML).toBe('Loading...');
	});
});
