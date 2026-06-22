import {
	describe, test, expect, beforeEach,
} from 'vitest';
import {loadMock, setupMockFetch, loadExportJson} from '@test/helpers/api-mocks';
import {
	resolveBonusRegion, findClanWeeklyEntry, weekCountToActivationMs, resolveClanWeeklyRewards,
} from './data';

const worldState = loadMock('worldState.json');
const dictEn = loadExportJson('dict.en.json');

beforeEach(() => {
	setupMockFetch();
});

describe('resolveClanWeeklyRewards', () => {
	const entry = worldState.WeeklyVaultBonusRewards[0];

	test('sorts rewards ascending by PointThreshold regardless of API order', async () => {
		// Deliberately reverse the order to verify sort is applied
		const shuffled = {
			...entry,
			Rewards: (entry.Rewards as unknown[]).toReversed(),
		};

		const result = await resolveClanWeeklyRewards(shuffled, dictEn);

		// Percentages must be strictly ascending
		const pcts = result.map(r => r.pct);
		expect(pcts).toEqual([...pcts].sort((a, b) => a - b));
	});

	test('renders each reward as a percentage of the maximum PointThreshold', async () => {
		const result = await resolveClanWeeklyRewards(entry, dictEn);

		const maxThreshold = Math.max(...(entry.Rewards as any[]).map((r: any) => r.PointThreshold as number));
		for (const [i, resolved] of result.entries()) {
			const sorted = [...(entry.Rewards as any[])].sort((a: any, b: any) => a.PointThreshold - b.PointThreshold);
			const expectedPct = Math.round((sorted[i].PointThreshold / maxThreshold) * 100);
			expect(resolved.pct).toBe(expectedPct);
		}
	});

	test('display includes the resolved item name', async () => {
		const result = await resolveClanWeeklyRewards(entry, dictEn);
		// Kuva is in ExportResources (normalized key)
		const kuva = result.find(r => r.display.includes('Kuva'));
		expect(kuva).toBeDefined();
	});

	test('display includes the item count for non-credit rewards', async () => {
		const result = await resolveClanWeeklyRewards(entry, dictEn);
		const sorted = [...(entry.Rewards as any[])].sort((a: any, b: any) => a.PointThreshold - b.PointThreshold);
		for (const [i, resolved] of result.entries()) {
			const reward = sorted[i];
			if (!(reward.Reward as string).includes('/PickUps/Credits/')) {
				expect(resolved.display).toContain((reward.ItemCount as number).toLocaleString('en'));
			}
		}
	});

	test('folds credits itemCount × denomination into a single formatted total', async () => {
		const result = await resolveClanWeeklyRewards(entry, dictEn);
		// Mock entry has ItemCount: 2, Reward: .../50000Credits → total = 100,000
		const credits = result.find(r => r.display.includes('Credits'));
		expect(credits).toBeDefined();
		expect(credits!.display).toBe('100,000 Credits');
	});
});

describe('resolveBonusRegion', () => {
	test('returns the direct dict value when the key is present', () => {
		const dict = {'/Lotus/Language/Locations/DeepSpace': 'Deep Space'};
		expect(resolveBonusRegion('/Lotus/Language/Locations/DeepSpace', dict)).toBe('Deep Space');
	});

	test('falls back to the _SPACE-suffixed key when the direct key is absent', () => {
		const dict = {'/Lotus/Language/Locations/DeepSpace_SPACE': 'Veil Proxima'};
		expect(resolveBonusRegion('/Lotus/Language/Locations/DeepSpace', dict)).toBe('Veil Proxima');
	});

	test('falls back to camelToWords of the last path segment when neither key exists', () => {
		expect(resolveBonusRegion('/Lotus/Language/Locations/VoidStorm', {})).toBe('Void Storm');
	});
});

describe('weekCountToActivationMs', () => {
	test('returns the epoch timestamp for week 0', () => {
		expect(weekCountToActivationMs(0)).toBe(1_391_990_400_000);
	});

	test('returns the correct timestamp for the mock entry WeekCount', () => {
		const MILLIS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
		expect(weekCountToActivationMs(621)).toBe(1_391_990_400_000 + (621 * MILLIS_PER_WEEK));
	});
});

// Time is frozen to MOCK_TIMESTAMP (week index 621) by the global test setup
describe('findClanWeeklyEntry', () => {
	test('returns the current week entry', () => {
		const entries = [{WeekCount: 621, Rewards: []}];
		expect(findClanWeeklyEntry(entries)).toBe(entries[0]);
	});

	test('falls back to the upcoming entry when the current week is absent', () => {
		const entries = [{WeekCount: 622, Rewards: []}];
		expect(findClanWeeklyEntry(entries)).toBe(entries[0]);
	});

	test('prefers the current week entry over the upcoming one', () => {
		const current = {WeekCount: 621, Rewards: []};
		const upcoming = {WeekCount: 622, Rewards: []};
		expect(findClanWeeklyEntry([upcoming, current])).toBe(current);
	});

	test('returns undefined when neither the current nor upcoming week is present', () => {
		const entries = [{WeekCount: 619, Rewards: []}, {WeekCount: 620, Rewards: []}];
		expect(findClanWeeklyEntry(entries)).toBeUndefined();
	});
});
