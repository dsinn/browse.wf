/**
 * Unit tests for the formatter functions in scripts/post-weekly-forecast.js
 *
 * These test pure string formatting logic — no DOM, no network calls.
 * The formatters are imported directly from the script (which is an ES module
 * with a main-guard, so importing it does not trigger any side effects).
 */
import {describe, test, expect} from 'vitest';
import {
	ExportMissionTypes,
	ExportChallenges,
	ExportResources,
	ExportBundles,
	ExportBoosterPacks,
	ExportBoosters,
} from 'warframe-public-export-plus';
import {
	formatConquest,
	formatDescendia,
	formatCalendarSeason,
	chunkMessage,
} from '../../scripts/post-weekly-forecast.js';
import {loadMock} from '../helpers/api-mocks';
import {MOCK_TIMESTAMP} from '../helpers/test-constants';

const rawWorldState = loadMock('worldState.json');
const osdict: Record<string, string> = loadMock('dicts/en.json');

// Patch Activation/Expiry so entries pass the "within next week" filter in findWeekly().
// Use MOCK_TIMESTAMP (the frozen Date.now() value) as the reference point.
const DAY_MS = 24 * 60 * 60 * 1000;
const mongoDate = (ms: number) => ({$date: {$numberLong: String(ms)}});
const nextWeek = (object: any) => ({
	...object,
	Activation: mongoDate(MOCK_TIMESTAMP + DAY_MS),
	Expiry: mongoDate(MOCK_TIMESTAMP + (8 * DAY_MS)),
});
const worldState = {
	...rawWorldState,
	Descents: rawWorldState.Descents.map(x => nextWeek(x)),
	Conquests: rawWorldState.Conquests.map(x => nextWeek(x)),
	KnownCalendarSeasons: rawWorldState.KnownCalendarSeasons.map(x => nextWeek(x)),
};

// Minimal dict covering mission name keys used by the mock
const dict: Record<string, string> = {
	'/Lotus/Language/Missions/MissionName_Disruption': 'Disruption',
	'/Lotus/Language/Missions/MissionName_DualDefense': 'Dual Defense',
	'/Lotus/Language/Missions/MissionName_Survival': 'Survival',
};

describe('formatConquest', () => {
	test('returns null when no conquests of the given type exist', () => {
		const result = formatConquest({Conquests: []}, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_', 'Deep Archimedea', osdict, dict, ExportMissionTypes);
		expect(result).toBeNull();
	});

	test('returns null when Conquests is absent', () => {
		const result = formatConquest({}, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_', 'Deep Archimedea', osdict, dict, ExportMissionTypes);
		expect(result).toBeNull();
	});

	test('formats Deep Archimedea header with section title only', () => {
		const result = formatConquest(worldState, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_', 'Deep Archimedea', osdict, dict, ExportMissionTypes);
		expect(result).toMatch(/^## Deep Archimedea$/mu);
	});

	test('formats Temporal Archimedea header', () => {
		const result = formatConquest(worldState, 'CT_HEX', '/Lotus/Language/Conquest/MissionVariant_HexConquest_', 'Temporal Archimedea', osdict, dict, ExportMissionTypes);
		expect(result).toMatch(/^## Temporal Archimedea$/mu);
	});

	test('each mission renders with bold type name, then bullet lines for deviation and conditions', () => {
		const result = formatConquest(worldState, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_', 'Deep Archimedea', osdict, dict, ExportMissionTypes);
		const lines = result.split('\n');
		// Should have at least one bold mission type line
		expect(lines.some(l => /^\*\*.+\*\*$/u.test(l))).toBe(true);
		// Deviation and conditions are bullet lines (not blockquoted)
		expect(lines.some(l => l.startsWith('- **'))).toBe(true);
	});

	test('mission type name is Title Case', () => {
		const result = formatConquest(worldState, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_', 'Deep Archimedea', osdict, dict, ExportMissionTypes);
		// Dict_en returns ALLCAPS — should be converted to Title Case
		expect(result).toContain('**Dual Defense**');
		expect(result).not.toMatch(/\*\*[A-Z]{3,}\*\*/u);
	});

	test('uses CD_HARD difficulty when present', () => {
		const result = formatConquest(worldState, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_', 'Deep Archimedea', osdict, dict, ExportMissionTypes);
		// CD_HARD for first mission has deviation FragileNodes → "Unified Purpose" in dicts/en.json
		expect(result).toContain('Unified Purpose');
	});

	test('remaps EMPBlackHole condition to MagneticHounds', () => {
		const conquest = {
			...worldState.Conquests[0],
			Missions: [{
				missionType: '/Lotus/Types/Missions/ArtefactCapture',
				difficulties: [{
					type: 'CD_HARD',
					deviation: 'FragileNodes',
					risks: ['EMPBlackHole', 'PointBlank'],
				}],
			}],
			Variables: [],
		};
		const osWithRemap = {
			...osdict,
			'/Lotus/Language/Conquest/Condition_MagneticHounds': 'Magnetic Hounds',
		};
		const result = formatConquest({Conquests: [conquest]}, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_', 'Deep Archimedea', osWithRemap, dict, ExportMissionTypes);
		expect(result).toContain('Magnetic Hounds');
		expect(result).not.toContain('EMPBlackHole');
	});

	test('Defense mission type becomes DualDefense for CT_LAB', () => {
		const defenseMission = {
			missionType: 'MT_DEFENSE',
			difficulties: [{type: 'CD_HARD', deviation: 'FragileNodes', risks: ['PointBlank', 'ExplosiveCrawlers']}],
		};
		const conquest = {...worldState.Conquests[0], Missions: [defenseMission], Variables: []};
		const dictWithDefense = {
			'/Lotus/Language/Missions/MissionName_Defense': 'Defense',
			'/Lotus/Language/Missions/MissionName_DualDefense': 'Dual Defense',
		};
		const result = formatConquest({Conquests: [conquest]}, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_', 'Deep Archimedea', osdict, dictWithDefense, ExportMissionTypes);
		expect(result).toContain('Dual Defense');
		expect(result).not.toContain('> Defense ');
	});

	test('Defense mission type stays Defense for CT_HEX', () => {
		const defenseMission = {
			missionType: 'MT_DEFENSE',
			difficulties: [{type: 'CD_HARD', deviation: 'FragileNodes', risks: ['PointBlank', 'ExplosiveCrawlers']}],
		};
		const conquest = {...worldState.Conquests[1], Missions: [defenseMission], Variables: []};
		const dictWithDefense = {'/Lotus/Language/Missions/MissionName_Defense': 'Defense'};
		const result = formatConquest({Conquests: [conquest]}, 'CT_HEX', '/Lotus/Language/Conquest/MissionVariant_HexConquest_', 'Temporal Archimedea', osdict, dictWithDefense, ExportMissionTypes);
		expect(result).toContain('Defense');
		expect(result).not.toContain('Dual Defense');
	});

	test('renders Frame Variables heading when Variables are present', () => {
		const result = formatConquest(worldState, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_', 'Deep Archimedea', osdict, dict, ExportMissionTypes);
		expect(result).toContain('> **Frame Variables**');
	});

	test('each frame variable renders as a bullet with bold name: description', () => {
		const result = formatConquest(worldState, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_', 'Deep Archimedea', osdict, dict, ExportMissionTypes);
		// ShieldDelay → "> - **Lethargic Shields**: Shield recharge delay increased 500%."
		expect(result).toMatch(/^> - \*\*Lethargic Shields\*\*: .+500/mu);
	});

	test('frame variable falls back to raw tag when missing from osdict', () => {
		const conquest = {...worldState.Conquests[0], Variables: ['UnknownModTag']};
		const result = formatConquest({Conquests: [conquest]}, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_', 'Deep Archimedea', osdict, dict, ExportMissionTypes);
		expect(result).toContain('UnknownModTag');
	});

	test('omits frame variables line when Variables is empty', () => {
		const conquest = {...worldState.Conquests[0], Variables: []};
		const result = formatConquest({Conquests: [conquest]}, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_', 'Deep Archimedea', osdict, dict, ExportMissionTypes);
		expect(result).not.toContain('Frame Variables');
	});

	test('falls back to raw variant tag when missing from osdict', () => {
		const conquest = {
			...worldState.Conquests[0],
			Missions: [{
				missionType: '/Lotus/Types/Missions/ArtefactCapture',
				difficulties: [{type: 'CD_HARD', deviation: 'UnknownVariant', risks: ['PointBlank', 'ExplosiveCrawlers']}],
			}],
			Variables: [],
		};
		const result = formatConquest({Conquests: [conquest]}, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_', 'Deep Archimedea', osdict, dict, ExportMissionTypes);
		expect(result).toContain('UnknownVariant');
	});

	test('includes Discord timestamp in heading when showTimestamp is true', () => {
		const result = formatConquest(worldState, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_', 'Deep Archimedea', osdict, dict, ExportMissionTypes, undefined, true);
		expect(result).toMatch(/^## Deep Archimedea <t:\d+:D>$/mu);
	});

	test('omits timestamp from heading by default', () => {
		const result = formatConquest(worldState, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_', 'Deep Archimedea', osdict, dict, ExportMissionTypes);
		expect(result).toMatch(/^## Deep Archimedea$/mu);
	});

	test('uses provided find function (findClosest fallback)', () => {
		const staleConquest = {...worldState.Conquests[0], Activation: mongoDate(MOCK_TIMESTAMP - (14 * DAY_MS)), Expiry: mongoDate(MOCK_TIMESTAMP - (7 * DAY_MS))};
		const findClosestStub = (items: any[]) => items[0] ?? null;
		const result = formatConquest(
			{Conquests: [staleConquest]},
			'CT_LAB',
			'/Lotus/Language/Conquest/MissionVariant_LabConquest_',
			'Deep Archimedea',
			osdict,
			dict,
			ExportMissionTypes,
			findClosestStub,
			true,
		);
		expect(result).not.toBeNull();
		expect(result).toMatch(/^## Deep Archimedea <t:\d+:D>$/mu);
	});
});

describe('formatDescendia', () => {
	test('returns null when Descents is empty', () => {
		expect(formatDescendia({Descents: []}, {})).toBeNull();
	});

	test('returns null when Descents is absent', () => {
		expect(formatDescendia({}, {})).toBeNull();
	});

	test('formats header as ## Descendia with no timestamp', () => {
		const result = formatDescendia(worldState, {});
		expect(result).toMatch(/^## Descendia$/mu);
	});

	test('renders one line per challenge', () => {
		const result = formatDescendia(worldState, {});
		const challengeLines = result.split('\n').slice(1); // Skip header
		expect(challengeLines).toHaveLength(worldState.Descents[0].Challenges.length);
	});

	test('each challenge line has index · bold type · challenge text', () => {
		const result = formatDescendia(worldState, {});
		const lines = result.split('\n').slice(1);
		for (const line of lines) {
			// Index. arena [__]**Type** · challenge[__]
			expect(line).toMatch(/^\d+\. .+ (?:__|)\*\*.+\*\* · /u);
		}
	});

	test('DT_PROTOFRAME challenge lines are underlined', () => {
		const result = formatDescendia(worldState, {});
		const lines = result.split('\n').slice(1);
		// Indices 7, 14, 21 are DT_PROTOFRAME in the mock (0-based: 6, 13, 20)
		const protoLines = lines.filter((_, i) => [6, 13, 20].includes(i));
		for (const line of protoLines) {
			expect(line).toMatch(/^\d+\. .+ __\*\*.+\*\* · .*__$/u);
		}
	});

	test('non-protoframe lines are not underlined', () => {
		const result = formatDescendia(worldState, {});
		const lines = result.split('\n').slice(1);
		const nonProtoLines = lines.filter((_, i) => ![6, 13, 20].includes(i));
		for (const line of nonProtoLines) {
			expect(line).not.toContain('__');
		}
	});

	test('type label is Title Case with DT_ prefix and underscores removed', () => {
		const descent = {
			...worldState.Descents[0],
			Challenges: [{
				Index: 1,
				Type: 'DT_SOME_TYPE',
				Challenge: '/Lotus/Types/Challenge/Generic',
				Level: '/path/ArenaAvocado.level',
				Specs: [],
				Auras: [],
			}],
		};
		const result = formatDescendia({Descents: [descent]}, {});
		expect(result).toContain('**Some Type**');
		expect(result).not.toContain('DT_');
	});

	test('uses dict translation for challenge name when available', () => {
		const descent = {
			...worldState.Descents[0],
			Challenges: [{
				Index: 1,
				Type: 'DT_EXTERMINATE',
				Challenge: 'MySpecialChallenge',
				Level: '/path/ArenaAvocado.level',
				Specs: [],
				Auras: [],
			}],
		};
		const result = formatDescendia(
			{Descents: [descent]},
			{MySpecialChallenge: 'Translated Challenge'},
		);
		expect(result).toContain('Translated Challenge');
	});

	test('falls back to camelToWords of last path segment when challenge not in dict', () => {
		const result = formatDescendia(worldState, {});
		// The fallback converts the last path segment to words — verify no raw paths appear
		const lines = result.split('\n').slice(1);
		for (const line of lines) {
			expect(line).not.toMatch(/\/Lotus\//u);
		}
	});

	test('maps known arena keys to emoji', () => {
		const descentWithKnownArena = {
			...worldState.Descents[0],
			Challenges: [{
				Index: 1,
				Type: 'Normal',
				Challenge: '/Lotus/Types/Challenge/Generic',
				Level: '/Lotus/Levels/Arena/ArenaAvocado.level',
				Specs: [],
				Auras: [],
			}],
		};
		const result = formatDescendia({Descents: [descentWithKnownArena]}, {});
		expect(result).toContain('🥑');
	});

	test('falls back to arena key when not in emoji map', () => {
		const descentWithUnknownArena = {
			...worldState.Descents[0],
			Challenges: [{
				Index: 1,
				Type: 'Normal',
				Challenge: '/Lotus/Types/Challenge/Generic',
				Level: '/Lotus/Levels/Arena/ArenaUnknownFruit.level',
				Specs: [],
				Auras: [],
			}],
		};
		const result = formatDescendia({Descents: [descentWithUnknownArena]}, {});
		expect(result).toContain('ArenaUnknownFruit');
	});

	test('omits extra separators when specs and auras are empty', () => {
		const descentWithEmpty = {
			...worldState.Descents[0],
			Challenges: [{
				Index: 1,
				Type: 'DT_NORMAL',
				Challenge: '/Lotus/Types/Challenge/Generic',
				Level: '/Lotus/Levels/Arena/ArenaAvocado.level',
				Specs: [],
				Auras: [],
			}],
		};
		const result = formatDescendia({Descents: [descentWithEmpty]}, {});
		const challengeLine = result.split('\n')[1];
		// Only one · between type and challenge name; no trailing ·
		expect((challengeLine.match(/ · /gu) ?? []).length).toBe(1);
		expect(challengeLine).not.toContain('-');
	});

	test('joins multiple specs with comma', () => {
		const descent = {
			...worldState.Descents[0],
			Challenges: [{
				Index: 1,
				Type: 'Normal',
				Challenge: '/Lotus/Types/Challenge/Generic',
				Level: '/path/ArenaAvocado.level',
				Specs: ['/Lotus/Spec/Alpha', '/Lotus/Spec/Beta'],
				Auras: [],
			}],
		};
		const dictWithSpecs = {
			'/Lotus/Spec/Alpha': 'Alpha',
			'/Lotus/Spec/Beta': 'Beta',
		};
		const result = formatDescendia({Descents: [descent]}, dictWithSpecs);
		expect(result).toContain('Alpha, Beta');
	});

	test('includes Discord timestamp in heading when showTimestamp is true', () => {
		const result = formatDescendia(worldState, {}, undefined, true);
		expect(result).toMatch(/^## Descendia <t:\d+:D>$/mu);
	});

	test('omits timestamp from heading by default', () => {
		const result = formatDescendia(worldState, {});
		expect(result).toMatch(/^## Descendia$/mu);
	});
});

describe('formatCalendarSeason', () => {
	test('returns null when KnownCalendarSeasons is empty', () => {
		const result = formatCalendarSeason({KnownCalendarSeasons: []}, {}, {}, {}, {}, {}, {});
		expect(result).toBeNull();
	});

	test('returns null when KnownCalendarSeasons is absent', () => {
		const result = formatCalendarSeason({}, {}, {}, {}, {}, {}, {});
		expect(result).toBeNull();
	});

	test('formats header with season label, no timestamp', () => {
		const result = formatCalendarSeason(worldState, {}, ExportChallenges, ExportResources, ExportBundles, ExportBoosterPacks, ExportBoosters);
		// WorldState mock has CST_FALL
		expect(result).toMatch(/^## 1999 Calendar: 🍁 Autumn$/mu);
	});

	test('uses raw season key as fallback when not in SEASON_LABELS', () => {
		const season = {...worldState.KnownCalendarSeasons[0], Season: 'CST_UNKNOWN'};
		const result = formatCalendarSeason({KnownCalendarSeasons: [season]}, {}, {}, {}, {}, {}, {});
		expect(result).toContain('CST_UNKNOWN');
	});

	test('renders CET_CHALLENGE lines with 📋 prefix and bold date', () => {
		const result = formatCalendarSeason(worldState, {}, ExportChallenges, ExportResources, ExportBundles, ExportBoosterPacks, ExportBoosters);
		const challengeLines = result.split('\n').filter(l => l.includes('📋'));
		expect(challengeLines.length).toBeGreaterThan(0);
		for (const line of challengeLines) {
			expect(line).toMatch(/^📋 \*\*.+\*\* .+/u);
		}
	});

	test('renders CET_REWARD lines with 🎁 prefix and bold date', () => {
		const result = formatCalendarSeason(worldState, {}, ExportChallenges, ExportResources, ExportBundles, ExportBoosterPacks, ExportBoosters);
		const rewardLines = result.split('\n').filter(l => l.startsWith('🎁'));
		expect(rewardLines.length).toBeGreaterThan(0);
		for (const line of rewardLines) {
			expect(line).toMatch(/^🎁 \*\*.+\*\* .+/u);
		}
	});

	test('renders CET_UPGRADE lines with 🔧 prefix and bold date', () => {
		const season = {
			...worldState.KnownCalendarSeasons[0],
			Days: [{
				day: 5,
				events: [{type: 'CET_UPGRADE', upgrade: '/Lotus/Upgrades/SomeUpgrade/SpeedBoost'}],
			}],
		};
		const result = formatCalendarSeason({KnownCalendarSeasons: [season]}, {}, {}, {}, {}, {}, {});
		expect(result).toMatch(/^🔧 \*\*.+\*\* .+/mu);
		expect(result).toContain('Speed Boost');
	});

	test('groups consecutive CET_REWARD events on the same day into a single middot-separated line', () => {
		const season = {
			...worldState.KnownCalendarSeasons[0],
			Days: [{
				day: 7,
				events: [
					{type: 'CET_REWARD', reward: '/Lotus/Types/Items/Alpha'},
					{type: 'CET_REWARD', reward: '/Lotus/Types/Items/Beta'},
				],
			}],
		};
		const result = formatCalendarSeason({KnownCalendarSeasons: [season]}, {}, {}, {}, {}, {}, {});
		const rewardLines = result.split('\n').filter(l => l.startsWith('🎁'));
		expect(rewardLines).toHaveLength(1);
		expect(rewardLines[0]).toContain(' · ');
	});

	test('groups consecutive CET_UPGRADE events on the same day into a single middot-separated line', () => {
		const season = {
			...worldState.KnownCalendarSeasons[0],
			Days: [{
				day: 7,
				events: [
					{type: 'CET_UPGRADE', upgrade: '/Lotus/Upgrades/SpeedBoost'},
					{type: 'CET_UPGRADE', upgrade: '/Lotus/Upgrades/DamageBoost'},
				],
			}],
		};
		const result = formatCalendarSeason({KnownCalendarSeasons: [season]}, {}, {}, {}, {}, {}, {});
		const upgradeLines = result.split('\n').filter(l => l.startsWith('🔧'));
		expect(upgradeLines).toHaveLength(1);
		expect(upgradeLines[0]).toContain(' · ');
	});

	test('does not group CET_REWARD and CET_UPGRADE events together', () => {
		const season = {
			...worldState.KnownCalendarSeasons[0],
			Days: [{
				day: 7,
				events: [
					{type: 'CET_REWARD', reward: '/Lotus/Types/Items/Alpha'},
					{type: 'CET_UPGRADE', upgrade: '/Lotus/Upgrades/SpeedBoost'},
				],
			}],
		};
		const result = formatCalendarSeason({KnownCalendarSeasons: [season]}, {}, {}, {}, {}, {}, {});
		const eventLines = result.split('\n').slice(1);
		expect(eventLines).toHaveLength(2);
	});

	test('challenge with desc+count substitutes |COUNT|', () => {
		const challengeKey = '/Lotus/Types/Challenges/Weekly/SomeChallenge';
		const customChallenges = {
			[challengeKey]: {description: '/desc/key', requiredCount: 5, icon: ''},
		};
		const customDict = {'/desc/key': 'Kill |COUNT| Enemies'};
		const season = {
			...worldState.KnownCalendarSeasons[0],
			Days: [{day: 3, events: [{type: 'CET_CHALLENGE', challenge: challengeKey}]}],
		};
		const result = formatCalendarSeason({KnownCalendarSeasons: [season]}, customDict, customChallenges, {}, {}, {}, {});
		expect(result).toContain('Kill 5 Enemies');
	});

	test('challenge with count but no desc falls back to camelToWords + count', () => {
		const challengeKey = '/Lotus/Types/Challenges/WeeklyKillEnemies';
		const customChallenges = {[challengeKey]: {requiredCount: 10, icon: ''}};
		const season = {
			...worldState.KnownCalendarSeasons[0],
			Days: [{day: 3, events: [{type: 'CET_CHALLENGE', challenge: challengeKey}]}],
		};
		const result = formatCalendarSeason({KnownCalendarSeasons: [season]}, {}, customChallenges, {}, {}, {}, {});
		expect(result).toContain('Weekly Kill Enemies ×10');
	});

	test('challenge not in ExportChallenges falls back to camelToWords of path segment', () => {
		const season = {
			...worldState.KnownCalendarSeasons[0],
			Days: [{day: 3, events: [{type: 'CET_CHALLENGE', challenge: '/Lotus/Types/Challenges/SomeUnknownChallenge'}]}],
		};
		const result = formatCalendarSeason({KnownCalendarSeasons: [season]}, {}, {}, {}, {}, {}, {});
		expect(result).toContain('Some Unknown Challenge');
	});

	test('reward name resolved via item name map and dict', () => {
		const rewardPath = '/Lotus/StoreItems/Types/Items/MiscItems/FieldronSample';
		const customResources = {[rewardPath]: {name: '/name/fieldron', icon: ''}};
		const customDict = {'/name/fieldron': 'Fieldron Sample'};
		const season = {
			...worldState.KnownCalendarSeasons[0],
			Days: [{day: 7, events: [{type: 'CET_REWARD', reward: rewardPath}]}],
		};
		const result = formatCalendarSeason({KnownCalendarSeasons: [season]}, customDict, {}, customResources, {}, {}, {});
		expect(result).toContain('Fieldron Sample');
	});

	test('reward name strips markup tags like <SHARD_GREEN_SIMPLE>', () => {
		const rewardPath = '/Lotus/StoreItems/Types/Items/Shard';
		const customResources = {[rewardPath]: {name: '/name/shard', icon: ''}};
		const customDict = {'/name/shard': '<SHARD_GREEN_SIMPLE> Emerald Archon Shard'};
		const season = {
			...worldState.KnownCalendarSeasons[0],
			Days: [{day: 7, events: [{type: 'CET_REWARD', reward: rewardPath}]}],
		};
		const result = formatCalendarSeason({KnownCalendarSeasons: [season]}, customDict, {}, customResources, {}, {}, {});
		expect(result).not.toContain('<SHARD_GREEN_SIMPLE>');
		expect(result).toContain('Emerald Archon Shard');
	});

	test('reward falls back to camelToWords of path segment when not in item maps', () => {
		const season = {
			...worldState.KnownCalendarSeasons[0],
			Days: [{day: 7, events: [{type: 'CET_REWARD', reward: '/Lotus/Types/Items/SomeWeirdReward'}]}],
		};
		const result = formatCalendarSeason({KnownCalendarSeasons: [season]}, {}, {}, {}, {}, {}, {});
		expect(result).toContain('Some Weird Reward');
	});

	test('skips days with no events', () => {
		const season = {
			...worldState.KnownCalendarSeasons[0],
			Days: [
				{day: 1, events: []},
				{day: 2, events: [{type: 'CET_UPGRADE', upgrade: '/Lotus/Upgrades/SpeedBoost'}]},
			],
		};
		const result = formatCalendarSeason({KnownCalendarSeasons: [season]}, {}, {}, {}, {}, {}, {});
		const lines = result.split('\n');
		// Only one event line (header + 1 event = 2 lines total)
		expect(lines).toHaveLength(2);
	});

	test('includes Discord timestamp in heading when showTimestamp is true', () => {
		const result = formatCalendarSeason(worldState, {}, ExportChallenges, ExportResources, ExportBundles, ExportBoosterPacks, ExportBoosters, undefined, true);
		expect(result).toMatch(/^## 1999 Calendar: .+ <t:\d+:D>$/mu);
	});

	test('omits timestamp from heading by default', () => {
		const result = formatCalendarSeason(worldState, {}, ExportChallenges, ExportResources, ExportBundles, ExportBoosterPacks, ExportBoosters);
		expect(result).toMatch(/^## 1999 Calendar: .+$/mu);
		expect(result).not.toMatch(/<t:\d+:D>/u);
	});
});

describe('chunkMessage', () => {
	test('returns single chunk when first fits within limit', () => {
		const chunks = chunkMessage('hello', [], 2000);
		expect(chunks).toEqual(['hello']);
	});

	test('includes rest sections as separate chunks', () => {
		const chunks = chunkMessage('first', ['second', 'third'], 2000);
		expect(chunks).toEqual(['first', 'second', 'third']);
	});

	test('splits a message that exceeds the limit at line boundaries', () => {
		const longLine = 'x'.repeat(100);
		const lines = Array.from({length: 25}, (_, i) => `line${i}: ${longLine}`);
		const first = lines.join('\n'); // ~2600 chars
		const chunks = chunkMessage(first, [], 200);
		expect(chunks.length).toBeGreaterThan(1);
		for (const chunk of chunks) {
			expect(chunk.length).toBeLessThanOrEqual(200);
		}

		// All content preserved
		expect(chunks.join('\n')).toBe(first);
	});

	test('splits oversized rest sections too', () => {
		const longSection = Array.from({length: 30}, (_, i) => `> line ${i}: ${'y'.repeat(80)}`).join('\n');
		const chunks = chunkMessage('short first', [longSection], 200);
		expect(chunks[0]).toBe('short first');
		for (const chunk of chunks) {
			expect(chunk.length).toBeLessThanOrEqual(200);
		}
	});

	test('uses default limit of 2000', () => {
		const short = 'hello';
		expect(chunkMessage(short, [])).toEqual([short]);
	});
});
