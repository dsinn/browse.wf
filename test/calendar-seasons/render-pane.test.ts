/**
 * Unit tests for renderCalendarSeasonPane() exported from src/calendar-seasons.ts
 *
 * Imports the real production code directly to avoid test drift.
 */
import {
	describe, test, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {loadMock, loadExportJson} from '../helpers/api-mocks';
import {renderCalendarSeasonPane} from '../../src/calendar-seasons/index';
import {getSeasonLabel} from '../../src/calendar-seasons/data';
import {updateCalendarSeason} from '../../src/live/calendar-seasons';

const worldState = loadMock('worldState.json');
const ExportChallenges = loadExportJson('ExportChallenges.json');
const ExportImages = loadExportJson('ExportImages.json');

beforeEach(() => {
	(globalThis as any).ExportImages = ExportImages;

	// Minimal stub for setImageSource (defined in common.js but not on window)
	// We don't test its implementation here - just that calendar-seasons can call it
	(globalThis as any).setImageSource = () => {
		// Stub — no-op
	};
});

describe('renderCalendarSeasonPane', () => {
	const season = worldState.KnownCalendarSeasons[0]; // CST_FALL

	const renderPane = async (s: any) => renderCalendarSeasonPane(s);

	// Helpers to navigate the DOM structure semantically (without relying on CSS classes)
	const getFirstDayRow = (pane: HTMLDivElement) => pane.children[0] as HTMLElement;
	const getEventsColumn = (row: HTMLElement) => row.children[1] as HTMLElement;

	beforeEach(() => {
		(globalThis as any).ExportChallenges = ExportChallenges;
	});

	describe('Return value', () => {
		test('returns a <div> element', async () => {
			const pane = await renderPane(season);
			expect(pane.nodeName).toBe('DIV');
		});

		test('returned div contains day rows', async () => {
			const pane = await renderPane(season);
			expect(pane.children.length).toBeGreaterThan(0);
		});
	});

	describe('Day filtering', () => {
		test('days with no events are not rendered', async () => {
			// Mock data has days 306 and 307 with empty events arrays
			const pane = await renderPane(season);
			const dateTexts = [...pane.querySelectorAll('.calendar-season-date')].map(element => element.textContent);

			// Nov 2 = day 306, Nov 3 = day 307 (1999 calendar)
			expect(dateTexts).not.toContain(expect.stringContaining('Nov 2'));
			expect(dateTexts).not.toContain(expect.stringContaining('Nov 3'));
		});

		test('days with at least one event produce a row element', async () => {
			const pane = await renderPane(season);
			// Season has 15 days with events
			expect(pane.children.length).toBe(15);
		});

		test('number of row elements matches number of days with events', async () => {
			const daysWithEvents = season.Days.filter((d: any) => d.events.length > 0);
			const pane = await renderPane(season);
			expect(pane.children.length).toBe(daysWithEvents.length);
		});
	});

	describe('Day row structure', () => {
		test('each day row has two columns (date and events)', async () => {
			const pane = await renderPane(season);
			const firstRow = pane.children[0];
			expect(firstRow.children.length).toBe(2);
		});

		test('date column is first child and has calendar-season-date class', async () => {
			const pane = await renderPane(season);
			const firstRow = pane.children[0];
			const dateCol = firstRow.children[0];
			expect(dateCol.classList.contains('calendar-season-date')).toBe(true);
		});

		test('events column is second child', async () => {
			const pane = await renderPane(season);
			const firstRow = pane.children[0];
			const eventsCol = firstRow.children[1];
			expect(eventsCol).toBeTruthy();
			expect(eventsCol.children.length).toBeGreaterThan(0); // Has event rows
		});
	});

	describe('Date formatting', () => {
		test('day 279 formats to "Oct 6" (1999 calendar)', async () => {
			const pane = await renderPane(season);
			const firstDate = pane.querySelector('.calendar-season-date');
			// First day in mock data is day 279
			expect(firstDate?.textContent).toMatch(/Oct 6$/u);
		});

		test('day 1 formats to "Jan 1"', async () => {
			const testSeason = {
				...season,
				Days: [{day: 1, events: [{type: 'CET_UPGRADE', upgrade: '/Lotus/Upgrades/Test'}]}],
			};
			const pane = await renderPane(testSeason);
			const dateCol = pane.querySelector('.calendar-season-date');
			expect(dateCol?.textContent).toMatch(/Jan 1$/u);
		});

		test('day 365 formats to "Dec 31"', async () => {
			const testSeason = {
				...season,
				Days: [{day: 365, events: [{type: 'CET_UPGRADE', upgrade: '/Lotus/Upgrades/Test'}]}],
			};
			const pane = await renderPane(testSeason);
			const dateCol = pane.querySelector('.calendar-season-date');
			expect(dateCol?.textContent).toMatch(/Dec 31$/u);
		});

		test('formatted date matches toLocaleDateString format', async () => {
			const testDay = 279;
			const expectedDate = new Date(1999, 0, testDay).toLocaleDateString('en', {month: 'short', day: 'numeric'});

			const pane = await renderPane(season);
			const firstDate = pane.querySelector('.calendar-season-date');
			expect(firstDate?.textContent).toContain(expectedDate);
		});
	});

	describe('Date column emoji prefix', () => {
		test('CET_CHALLENGE day shows a prefix in date column', async () => {
			const pane = await renderPane(season);
			const firstDate = pane.querySelector('.calendar-season-date');
			// First day (279) has CET_CHALLENGE
			expect(firstDate?.textContent).toMatch(/^📋\s/u);
		});

		test('CET_REWARD day shows a prefix in date column', async () => {
			const testSeason = {
				...season,
				Days: [{day: 1, events: [{type: 'CET_REWARD', reward: '/Lotus/StoreItems/Test'}]}],
			};
			const pane = await renderPane(testSeason);
			const dateCol = pane.querySelector('.calendar-season-date');
			expect(dateCol?.textContent).toMatch(/^🎁\s/u);
		});

		test('CET_UPGRADE day shows a prefix in date column', async () => {
			const testSeason = {
				...season,
				Days: [{day: 1, events: [{type: 'CET_UPGRADE', upgrade: '/Lotus/Upgrades/Test'}]}],
			};
			const pane = await renderPane(testSeason);
			const dateCol = pane.querySelector('.calendar-season-date');
			expect(dateCol?.textContent).toMatch(/^🔧\s/u);
		});

		test('emoji is followed by a space and then the formatted date', async () => {
			const pane = await renderPane(season);
			const firstDate = pane.querySelector('.calendar-season-date');
			// Should be "📋 Oct 6"
			expect(firstDate?.textContent).toMatch(/^📋 [A-Z][a-z]{2} \d{1,2}$/u);
		});
	});

	describe('Challenge events (CET_CHALLENGE)', () => {
		test('renders an icon image', async () => {
			const pane = await renderPane(season);
			const firstRow = getFirstDayRow(pane);
			const eventsCol = getEventsColumn(firstRow);
			const img = eventsCol.querySelector('img');

			expect(img).toBeTruthy();
		});

		test('description text uses dict lookup and replaces |COUNT| with requiredCount', async () => {
			const pane = await renderPane(season);
			const firstRow = getFirstDayRow(pane);
			const eventsCol = getEventsColumn(firstRow);
			const span = eventsCol.querySelector('span');

			// Description should be "Kill 250 Enemies" from real dict
			expect(span?.textContent).toContain('250');
			expect(span?.textContent).toContain('Kill');
			expect(span?.textContent).toContain('Enemies');
		});

		test('resolves challenge with description and count from ExportChallenges', async () => {
			const testChallenge = '/Lotus/Types/Challenges/Calendar1999/CalendarKillEnemiesEasy';
			const testSeason = {
				...season,
				Days: [{day: 1, events: [{type: 'CET_CHALLENGE', challenge: testChallenge}]}],
			};

			const pane = await renderPane(testSeason);
			const span = getEventsColumn(getFirstDayRow(pane)).querySelector('span');

			expect(span?.textContent).toContain('Kill 250 Enemies');
		});

		test('does NOT render challengeData.name', async () => {
			const pane = await renderPane(season);
			const firstRow = getFirstDayRow(pane);
			const eventsCol = getEventsColumn(firstRow);
			const text = eventsCol.textContent;

			// ExportChallenges has name "Kill Enemies" but it should NOT be rendered
			expect(text).not.toContain('Kill Enemies:');
		});

		test('renders fallback span when challenge path is not in ExportChallenges', async () => {
			const testSeason = {
				...season,
				Days: [{day: 1, events: [{type: 'CET_CHALLENGE', challenge: '/Lotus/Types/Challenges/MissingChallenge'}]}],
			};

			const pane = await renderPane(testSeason);
			const span = getEventsColumn(getFirstDayRow(pane)).querySelector('span');

			// Should show camelToWords("MissingChallenge")
			expect(span?.textContent).toContain('Missing Challenge');
		});
	});

	describe('Reward events (CET_REWARD)', () => {
		test('renders an <img> when itemIconMap has an entry for the reward', async () => {
			const testSeason = {
				...season,
				Days: [{day: 1, events: [{type: 'CET_REWARD', reward: '/Lotus/StoreItems/Types/Items/MiscItems/WeaponUtilityUnlocker'}]}],
			};

			const pane = await renderPane(testSeason);
			const img = getEventsColumn(getFirstDayRow(pane)).querySelector('img');

			expect(img).toBeTruthy();
		});

		test('does not render an img when iconPath is missing from itemIconMap', async () => {
			const testSeason = {
				...season,
				Days: [{day: 1, events: [{type: 'CET_REWARD', reward: '/Lotus/StoreItems/Unknown'}]}],
			};

			const pane = await renderPane(testSeason);
			const img = getEventsColumn(getFirstDayRow(pane)).querySelector('img');

			expect(img).toBeFalsy();
		});

		test('reward name uses dict lookup via itemNameMap key', async () => {
			const testSeason = {
				...season,
				Days: [{day: 1, events: [{type: 'CET_REWARD', reward: '/Lotus/StoreItems/Types/Items/MiscItems/WeaponUtilityUnlocker'}]}],
			};

			const pane = await renderPane(testSeason);
			const span = getEventsColumn(getFirstDayRow(pane)).querySelector('span');

			// Real name from dict.en.json
			expect(span?.textContent).toBe('Exilus Weapon Adapter');
		});

		test('falls back to camelToWords(path tail) when name is not in dict', async () => {
			const testSeason = {
				...season,
				Days: [{day: 1, events: [{type: 'CET_REWARD', reward: '/Lotus/StoreItems/SomeRewardItem'}]}],
			};

			const pane = await renderPane(testSeason);
			const span = getEventsColumn(getFirstDayRow(pane)).querySelector('span');

			expect(span?.textContent).toContain('Some Reward Item');
		});

		test('normalizes /Lotus/StoreItems/ to /Lotus/ before looking up in itemIconMap/itemNameMap', async () => {
			// Mock data has day 281 with reward "/Lotus/StoreItems/Types/Items/MiscItems/WeaponUtilityUnlocker"
			// This should normalize to "/Lotus/Types/Items/MiscItems/WeaponUtilityUnlocker" for lookup
			const normalizedItemIconMap = {
				'/Lotus/Types/Items/MiscItems/WeaponUtilityUnlocker': '/Lotus/Interface/Icons/Test.png',
			};
			const normalizedItemNameMap = {
				'/Lotus/Types/Items/MiscItems/WeaponUtilityUnlocker': '/Lotus/Language/Items/TestName',
			};

			const testSeason = {
				...season,
				Days: season.Days.filter((d: any) => d.day === 281),
			};

			const pane = await renderPane(testSeason);
			const img = getEventsColumn(getFirstDayRow(pane)).querySelector('img');

			// Should find the icon using normalized path
			expect(img).toBeTruthy();
		});
	});

	describe('Upgrade events (CET_UPGRADE)', () => {
		test('renders a span with textContent containing sparkles', async () => {
			const testSeason = {
				...season,
				Days: season.Days.filter((d: any) => d.day === 297), // Has CET_UPGRADE events
			};

			const pane = await renderPane(testSeason);
			const eventRows = getEventsColumn(getFirstDayRow(pane)).children;

			// First upgrade event should have sparkles
			expect(eventRows[0].textContent).toContain('\u2728');
		});

		test('renders upgrade name as camelToWords of the path tail', async () => {
			const testSeason = {
				...season,
				Days: season.Days.filter((d: any) => d.day === 297), // Has upgrade "GasChanceToPrimaryAndSecondary"
			};

			const pane = await renderPane(testSeason);
			const eventRows = getEventsColumn(getFirstDayRow(pane)).children;

			expect(eventRows[0].textContent).toContain('Gas Chance To Primary And Secondary');
		});

		test('does not render any <img> for upgrades', async () => {
			const testSeason = {
				...season,
				Days: season.Days.filter((d: any) => d.day === 297),
			};

			const pane = await renderPane(testSeason);
			const eventRows = getEventsColumn(getFirstDayRow(pane)).children;
			const img = eventRows[0].querySelector('img');

			expect(img).toBeFalsy();
		});
	});
});

describe('updateCalendarSeason', () => {
	const activeSeason = worldState.KnownCalendarSeasons[0];
	const activeSeasonExpiry = Number.parseInt(activeSeason.Expiry.$date.$numberLong, 10);

	beforeEach(() => {
		(globalThis as any).ExportChallenges = ExportChallenges;
		(globalThis as any).worldState = worldState;
		(globalThis as any).createCompletionToggle = vi.fn(() => document.createTextNode(''));
		(globalThis as any).createExpiryBadge = vi.fn(() => document.createTextNode(''));
	});

	afterEach(() => {
		delete (globalThis as any).ExportChallenges;
		delete (globalThis as any).worldState;
		delete (globalThis as any).createCompletionToggle;
		delete (globalThis as any).createExpiryBadge;
	});

	test('calls createExpiryBadge with the active season expiry', async () => {
		await updateCalendarSeason();
		expect((globalThis as any).createExpiryBadge).toHaveBeenCalledWith(activeSeasonExpiry);
	});
});

describe('getSeasonLabel', () => {
	describe('Known seasons', () => {
		test('CST_SPRING returns "🌸 Spring"', () => {
			const label = getSeasonLabel('CST_SPRING');
			expect(label).toBe('🌸 Spring');
		});

		test('CST_SUMMER returns "🌻 Summer"', () => {
			const label = getSeasonLabel('CST_SUMMER');
			expect(label).toBe('🌻 Summer');
		});

		test('CST_FALL returns "🍁 Autumn"', () => {
			const label = getSeasonLabel('CST_FALL');
			expect(label).toBe('🍁 Autumn');
		});

		test('CST_WINTER returns "❄️ Winter"', () => {
			const label = getSeasonLabel('CST_WINTER');
			expect(label).toBe('❄️ Winter');
		});
	});

	describe('Unknown season', () => {
		test('unknown key returns the raw value unchanged', () => {
			const label = getSeasonLabel('CST_UNKNOWN');
			expect(label).toBe('CST_UNKNOWN');
		});
	});
});
