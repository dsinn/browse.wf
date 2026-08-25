/**
 * Tests for src/calendar-seasons/index.ts — renderCalendarSeasonPane()
 */
import {
	describe, test, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {renderCalendarSeasonPane} from '../calendar-seasons/index';

// Return empty exports so data.ts falls back to camelToWords(lastSegment(...)) for text
vi.mock('../../../src/public-export-fetcher', () => ({
	fetchExport: vi.fn(async () => ({})),
	exportCache: new Map(),
}));

const mockSeason = {
	Days: [
		{day: 5, events: [{type: 'CET_CHALLENGE', challenge: '/Lotus/Types/Challenges/Seasons/WeeklyChallenge'}]},
		{day: 10, events: [{type: 'CET_REWARD', reward: '/Lotus/StoreItems/Types/Items/MiscItems/Forma'}]},
		{day: 15, events: [{type: 'CET_UPGRADE', upgrade: '/Lotus/Upgrades/Mods/ExilusAdapter'}]},
	],
};

beforeEach(() => {
	(globalThis as any).getDictPromise = async () => ({});
	(globalThis as any).setImageSource = vi.fn();
});

afterEach(() => {
	delete (globalThis as any).getDictPromise;
	delete (globalThis as any).setImageSource;
});

describe('renderCalendarSeasonPane — event type attributes', () => {
	test('each day row has the calendar-season-event class', async () => {
		const pane = await renderCalendarSeasonPane(mockSeason);
		const rows = pane.querySelectorAll('.calendar-season-event');
		expect(rows.length).toBe(3);
	});

	test('challenge row has data-event-type="CET_CHALLENGE"', async () => {
		const pane = await renderCalendarSeasonPane(mockSeason);
		const row = pane.querySelector('.calendar-season-event[data-event-type="CET_CHALLENGE"]');
		expect(row).not.toBeNull();
	});

	test('reward row has data-event-type="CET_REWARD"', async () => {
		const pane = await renderCalendarSeasonPane(mockSeason);
		const row = pane.querySelector('.calendar-season-event[data-event-type="CET_REWARD"]');
		expect(row).not.toBeNull();
	});

	test('upgrade row has data-event-type="CET_UPGRADE"', async () => {
		const pane = await renderCalendarSeasonPane(mockSeason);
		const row = pane.querySelector('.calendar-season-event[data-event-type="CET_UPGRADE"]');
		expect(row).not.toBeNull();
	});
});
