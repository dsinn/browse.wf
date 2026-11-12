/**
 Tests for src/arbys/title.ts
 */
import {
	describe, test, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {BASE_TITLE, updateArbyTitle} from './title.js';

const NOW_MS = 1_768_087_200_000;
const NOW_SECONDS = NOW_MS / 1000;

describe('updateArbyTitle', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW_MS);
		document.title = BASE_TITLE;
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	test('shows the live indicator when the first matching arbitration has started', () => {
		updateArbyTitle(NOW_SECONDS - 1200);
		expect(document.title).toBe(`🔴 ${BASE_TITLE}`);
	});

	test('shows the live indicator at the exact start time', () => {
		updateArbyTitle(NOW_SECONDS);
		expect(document.title).toBe(`🔴 ${BASE_TITLE}`);
	});

	test('shows the upcoming indicator when the first matching arbitration starts within the hour', () => {
		updateArbyTitle(NOW_SECONDS + 1200);
		expect(document.title).toBe(`⏳ ${BASE_TITLE}`);
	});

	test('shows the upcoming indicator exactly one hour before the start time', () => {
		updateArbyTitle(NOW_SECONDS + 3600);
		expect(document.title).toBe(`⏳ ${BASE_TITLE}`);
	});

	test('shows no indicator when the first matching arbitration is more than an hour away', () => {
		updateArbyTitle(NOW_SECONDS + 3601);
		expect(document.title).toBe(BASE_TITLE);
	});

	test('removes the indicator when no arbitration matches', () => {
		document.title = `🔴 ${BASE_TITLE}`;
		updateArbyTitle(undefined);
		expect(document.title).toBe(BASE_TITLE);
	});
});
