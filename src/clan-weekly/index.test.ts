/**
 * Tests for src/clan-weekly/index.ts — updateClanWeekly()
 */
import {
	describe, test, expect, beforeAll, beforeEach, afterEach, vi,
} from 'vitest';
import {freezeTime, MOCK_TIMESTAMP} from '@test/helpers/time-helpers';
import {updateClanWeekly} from './index';

const NEXT_WEEKLY_RESET_MS = 1_768_176_000_000; // 2026-01-12T00:00:00Z, the Monday after MOCK_TIMESTAMP

const {mockFindClanWeeklyEntry, mockResolveClanWeeklyRewards, mockResolveBonusRegion, mockFetchExport} = vi.hoisted(() => ({
	mockFindClanWeeklyEntry: vi.fn(),
	mockResolveClanWeeklyRewards: vi.fn(),
	mockResolveBonusRegion: vi.fn(),
	mockFetchExport: vi.fn(async () => ({})),
}));

vi.mock('./data.js', () => ({
	findClanWeeklyEntry: mockFindClanWeeklyEntry,
	resolveClanWeeklyRewards: mockResolveClanWeeklyRewards,
	resolveBonusRegion: mockResolveBonusRegion,
}));

vi.mock('../public-export-fetcher.js', () => ({
	fetchExport: mockFetchExport,
	exportCache: new Map(),
}));

const mockEntry = {
	WeekCount: 621,
	BonusRegion: '/Lotus/Language/Locations/DeepSpace',
	Rewards: [],
};

const mockResolvedRewards = [
	{pct: 25, display: '50x Squad Energy Restore (Large)', iconPath: undefined},
	{pct: 50, display: '7,000x Kuva', iconPath: undefined},
	{pct: 75, display: '100,000 Credits', iconPath: undefined},
	{pct: 100, display: '21,000x Kuva', iconPath: undefined},
];

beforeAll(() => {
	(globalThis as any).worldState = {WeeklyVaultBonusRewards: [mockEntry]};
});

beforeEach(() => {
	vi.clearAllMocks();
	vi.useFakeTimers();
	freezeTime(MOCK_TIMESTAMP);

	mockFindClanWeeklyEntry.mockReturnValue(mockEntry);
	mockResolveClanWeeklyRewards.mockResolvedValue(mockResolvedRewards);
	mockResolveBonusRegion.mockReturnValue('Veil Proxima');

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
	(globalThis as any).getDictPromise = vi.fn(async () => ({}));
	(globalThis as any).setImageSource = vi.fn();
});

afterEach(() => {
	vi.useRealTimers();
	(globalThis as any).worldState = {WeeklyVaultBonusRewards: [mockEntry]};
	delete (globalThis as any).createExpiryBadge;
	delete (globalThis as any).createCompletionToggle;
	delete (globalThis as any).getDictPromise;
	delete (globalThis as any).setImageSource;
	delete (globalThis as any).ExportImages;
});

describe('updateClanWeekly — empty worldState', () => {
	beforeEach(() => {
		mockFindClanWeeklyEntry.mockReturnValue(undefined);
	});

	test('schedules a retry when WeeklyVaultBonusRewards is empty', () => {
		(globalThis as any).worldState = {WeeklyVaultBonusRewards: []};

		void updateClanWeekly();

		expect(vi.getTimerCount()).toBeGreaterThan(0);
	});

	test('does not call fetchExport when no entry is found', async () => {
		void updateClanWeekly();
		await Promise.resolve();

		expect(mockFetchExport).not.toHaveBeenCalled();
	});

	test('does not modify #clan-weekly-body when no entry is found', () => {
		const body = document.querySelector('#clan-weekly-body')!;
		body.innerHTML = 'Loading...';

		void updateClanWeekly();

		expect(body.innerHTML).toBe('Loading...');
	});
});

describe('updateClanWeekly — active entry', () => {
	test('injects expiry badge into #clan-weekly-expiry', async () => {
		await updateClanWeekly();

		expect(document.querySelector('#clan-weekly-expiry .expiry-badge')).not.toBeNull();
	});

	test('calls createExpiryBadge with the next weekly reset timestamp', async () => {
		await updateClanWeekly();

		expect((globalThis as any).createExpiryBadge).toHaveBeenCalledWith(NEXT_WEEKLY_RESET_MS);
	});

	test('injects completion toggle into #clan-weekly-checks', async () => {
		await updateClanWeekly();

		expect(document.querySelector('#clan-weekly-checks .completion-toggle')).not.toBeNull();
	});

	test('completion toggle oid encodes the entry WeekCount', async () => {
		await updateClanWeekly();

		const toggle = document.querySelector<HTMLElement>('#clan-weekly-checks .completion-toggle')!;
		expect(toggle.dataset.oid).toContain(String(mockEntry.WeekCount));
	});

	test('injects rendered pane into #clan-weekly-body', async () => {
		await updateClanWeekly();

		const body = document.querySelector('#clan-weekly-body')!;
		expect(body.children.length).toBeGreaterThan(0);
	});

	test('clears previous body content before injecting new pane', async () => {
		const body = document.querySelector('#clan-weekly-body')!;
		body.innerHTML = '<div class="old-content"></div>';

		await updateClanWeekly();

		expect(body.querySelector('.old-content')).toBeNull();
		expect(body.children.length).toBeGreaterThan(0);
	});

	test('schedules a re-render timer for the next weekly reset', async () => {
		await updateClanWeekly();

		expect(vi.getTimerCount()).toBeGreaterThan(0);
	});
});

describe('updateClanWeekly — missing DOM elements', () => {
	test('runs without throwing when #clan-weekly-expiry is absent', async () => {
		document.querySelector('#clan-weekly-expiry')!.remove();

		await expect(updateClanWeekly()).resolves.not.toThrow();
	});

	test('runs without throwing when #clan-weekly-checks is absent', async () => {
		document.querySelector('#clan-weekly-checks')!.remove();

		await expect(updateClanWeekly()).resolves.not.toThrow();
	});

	test('runs without throwing when #clan-weekly-body is absent', async () => {
		document.querySelector('#clan-weekly-body')!.remove();

		await expect(updateClanWeekly()).resolves.not.toThrow();
	});
});
