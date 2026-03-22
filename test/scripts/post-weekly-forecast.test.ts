/**
 * Unit tests for the formatter functions in scripts/post-weekly-forecast.js
 *
 * These test pure string formatting logic — no DOM, no network calls.
 * The formatters are imported directly from the script (which is an ES module
 * with a main-guard, so importing it does not trigger any side effects).
 */
import {describe, test, expect} from 'vitest';
import {
	formatConquest,
	formatDescendia,
	formatCalendarSeason,
	chunkMessage,
	escapeMarkdown,
} from '../../scripts/post-weekly-forecast.js';
import {loadMock} from '../helpers/api-mocks';
import {MOCK_TIMESTAMP} from '../helpers/test-constants';

const rawWorldState = loadMock('worldState.json');

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
	Descents: rawWorldState.Descents.map((x: any) => nextWeek(x)),
	Conquests: rawWorldState.Conquests.map((x: any) => nextWeek(x)),
	KnownCalendarSeasons: rawWorldState.KnownCalendarSeasons.map((x: any) => nextWeek(x)),
};

describe('formatConquest', () => {
	test('returns null when no conquests of the given type exist', async () => {
		const result = await formatConquest({Conquests: []}, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_', 'Deep Archimedea');
		expect(result).toBeNull();
	});

	test('returns null when Conquests is absent', async () => {
		const result = await formatConquest({}, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_', 'Deep Archimedea');
		expect(result).toBeNull();
	});

	test('formats Deep Archimedea header with section title only', async () => {
		const result = await formatConquest(worldState, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_', 'Deep Archimedea');
		expect(result).toMatch(/^## Deep Archimedea$/mu);
	});

	test('formats Temporal Archimedea header', async () => {
		const result = await formatConquest(worldState, 'CT_HEX', '/Lotus/Language/Conquest/MissionVariant_HexConquest_', 'Temporal Archimedea');
		expect(result).toMatch(/^## Temporal Archimedea$/mu);
	});

	test('each mission renders with bold type name, then bullet lines for deviation and conditions', async () => {
		const result = await formatConquest(worldState, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_', 'Deep Archimedea');
		const lines = result!.split('\n');
		// Should have at least one bold mission type line
		expect(lines.some((l: string) => /^\*\*.+\*\*$/u.test(l))).toBe(true);
		// Deviation and conditions are bullet lines (not blockquoted)
		expect(lines.some((l: string) => l.startsWith('- **'))).toBe(true);
	});

	test('mission type name is Title Case', async () => {
		const result = await formatConquest(worldState, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_', 'Deep Archimedea');
		// Dict_en returns ALLCAPS — should be converted to Title Case
		expect(result).not.toMatch(/\*\*[A-Z]{3,}\*\*/u);
	});

	test('uses CD_HARD difficulty when present', async () => {
		const result = await formatConquest(worldState, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_', 'Deep Archimedea');
		// CD_HARD for first mission has deviation FragileNodes → "Unified Purpose" in dicts/en.json
		expect(result).toContain('Unified Purpose');
	});

	test('remaps EMPBlackHole condition to MagneticHounds', async () => {
		const conquest = {
			...worldState.Conquests[0],
			Missions: [{
				missionType: 'MT_SURVIVAL',
				difficulties: [{
					type: 'CD_HARD',
					deviation: 'FragileNodes',
					risks: ['EMPBlackHole', 'PointBlank'],
				}],
			}],
			Variables: [],
		};
		const result = await formatConquest({Conquests: [conquest]}, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_', 'Deep Archimedea');
		// EMPBlackHole remaps to MagneticHounds, which displays as "Alluring Arcocanids" in en.json
		expect(result).toContain('Alluring Arcocanids');
		expect(result).not.toContain('EMPBlackHole');
	});

	test('Defense mission type becomes DualDefense (Mirror Defense) for CT_LAB', async () => {
		const defenseMission = {
			missionType: 'MT_DEFENSE',
			difficulties: [{type: 'CD_HARD', deviation: 'FragileNodes', risks: ['PointBlank', 'ExplosiveCrawlers']}],
		};
		const conquest = {...worldState.Conquests[0], Missions: [defenseMission], Variables: []};
		const result = await formatConquest({Conquests: [conquest]}, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_', 'Deep Archimedea');
		// DualDefense maps to "Mirror Defense" in the real dict
		expect(result).toContain('Mirror Defense');
		expect(result).not.toContain('**Defense**');
	});

	test('Defense mission type stays Defense for CT_HEX', async () => {
		const defenseMission = {
			missionType: 'MT_DEFENSE',
			difficulties: [{type: 'CD_HARD', deviation: 'FragileNodes', risks: ['PointBlank', 'ExplosiveCrawlers']}],
		};
		const conquest = {...worldState.Conquests[1], Missions: [defenseMission], Variables: []};
		const result = await formatConquest({Conquests: [conquest]}, 'CT_HEX', '/Lotus/Language/Conquest/MissionVariant_HexConquest_', 'Temporal Archimedea');
		expect(result).toContain('Defense');
		expect(result).not.toContain('Mirror Defense');
	});

	test('renders Frame Variables heading when Variables are present', async () => {
		const result = await formatConquest(worldState, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_', 'Deep Archimedea');
		expect(result).toContain('> **Frame Variables**');
	});

	test('each frame variable renders as a bullet with bold name: description', async () => {
		const result = await formatConquest(worldState, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_', 'Deep Archimedea');
		// ShieldDelay → "> - **Lethargic Shields**: Shield recharge delay increased 500%."
		expect(result).toMatch(/^> - \*\*Lethargic Shields\*\*: .+500/mu);
	});

	test('frame variable falls back to raw tag when missing from osdict', async () => {
		const conquest = {...worldState.Conquests[0], Variables: ['UnknownModTag']};
		const result = await formatConquest({Conquests: [conquest]}, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_', 'Deep Archimedea');
		expect(result).toContain('UnknownModTag');
	});

	test('omits frame variables line when Variables is empty', async () => {
		const conquest = {...worldState.Conquests[0], Variables: []};
		const result = await formatConquest({Conquests: [conquest]}, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_', 'Deep Archimedea');
		expect(result).not.toContain('Frame Variables');
	});

	test('falls back to raw variant tag when missing from osdict', async () => {
		const conquest = {
			...worldState.Conquests[0],
			Missions: [{
				missionType: '/Lotus/Types/Missions/ArtefactCapture',
				difficulties: [{type: 'CD_HARD', deviation: 'UnknownVariant', risks: ['PointBlank', 'ExplosiveCrawlers']}],
			}],
			Variables: [],
		};
		const result = await formatConquest({Conquests: [conquest]}, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_', 'Deep Archimedea');
		expect(result).toContain('UnknownVariant');
	});

	test('includes Discord timestamp in heading when showTimestamp is true', async () => {
		const result = await formatConquest(worldState, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_', 'Deep Archimedea', undefined, true);
		expect(result).toMatch(/^## Deep Archimedea <t:\d+:D>$/mu);
	});

	test('omits timestamp from heading by default', async () => {
		const result = await formatConquest(worldState, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_', 'Deep Archimedea');
		expect(result).toMatch(/^## Deep Archimedea$/mu);
	});

	test('uses provided find function (findClosest fallback)', async () => {
		const staleConquest = {...worldState.Conquests[0], Activation: mongoDate(MOCK_TIMESTAMP - (14 * DAY_MS)), Expiry: mongoDate(MOCK_TIMESTAMP - (7 * DAY_MS))};
		const findClosestStub = (items: any[]) => items[0] ?? null;
		const result = await formatConquest(
			{Conquests: [staleConquest]},
			'CT_LAB',
			'/Lotus/Language/Conquest/MissionVariant_LabConquest_',
			'Deep Archimedea',
			findClosestStub,
			true,
		);
		expect(result).not.toBeNull();
		expect(result).toMatch(/^## Deep Archimedea <t:\d+:D>$/mu);
	});
});

describe('formatDescendia', () => {
	test('returns null when Descents is empty', async () => {
		expect(await formatDescendia({Descents: []})).toBeNull();
	});

	test('returns null when Descents is absent', async () => {
		expect(await formatDescendia({})).toBeNull();
	});

	test('formats header as ## Descendia with no timestamp', async () => {
		const result = await formatDescendia(worldState);
		expect(result).toMatch(/^## Descendia$/mu);
	});

	test('renders one line per challenge', async () => {
		const result = await formatDescendia(worldState);
		const challengeLines = result!.split('\n').slice(1); // Skip header
		expect(challengeLines).toHaveLength(worldState.Descents[0].Challenges.length);
	});

	test('each challenge line has index · bold type · challenge text', async () => {
		const result = await formatDescendia(worldState);
		const lines = result!.split('\n').slice(1);
		for (const line of lines) {
			// Index. arena [__]**Type** · challenge[__]
			expect(line).toMatch(/^\d+\. .+ (?:__|)\*\*.+\*\* · /u);
		}
	});

	test('DT_PROTOFRAME challenge lines are underlined', async () => {
		const result = await formatDescendia(worldState);
		const lines = result!.split('\n').slice(1);
		// Indices 7, 14, 21 are DT_PROTOFRAME in the mock (0-based: 6, 13, 20)
		const protoLines = lines.filter((_: string, i: number) => [6, 13, 20].includes(i));
		for (const line of protoLines) {
			expect(line).toMatch(/^\d+\. .+ __\*\*.+\*\* · .*__$/u);
		}
	});

	test('non-protoframe lines are not underlined', async () => {
		const result = await formatDescendia(worldState);
		const lines = result!.split('\n').slice(1);
		const nonProtoLines = lines.filter((_: string, i: number) => ![6, 13, 20].includes(i));
		for (const line of nonProtoLines) {
			expect(line).not.toContain('__');
		}
	});

	test('type label is Title Case with DT_ prefix and underscores removed', async () => {
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
		const result = await formatDescendia({Descents: [descent]});
		expect(result).toContain('**Some Type**');
		expect(result).not.toContain('DT_');
	});

	test('falls back to camelToWords of last path segment when challenge not in dict', async () => {
		const result = await formatDescendia(worldState);
		// The fallback converts the last path segment to words — verify no raw paths appear
		const lines = result!.split('\n').slice(1);
		for (const line of lines) {
			expect(line).not.toMatch(/\/Lotus\//u);
		}
	});

	test('maps known arena keys to emoji', async () => {
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
		const result = await formatDescendia({Descents: [descentWithKnownArena]});
		expect(result).toContain('🥑');
	});

	test('falls back to arena key when not in emoji map', async () => {
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
		const result = await formatDescendia({Descents: [descentWithUnknownArena]});
		expect(result).toContain('ArenaUnknownFruit');
	});

	test('omits extra separators when specs and auras are empty', async () => {
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
		const result = await formatDescendia({Descents: [descentWithEmpty]});
		const challengeLine = result!.split('\n')[1];
		// Only one · between type and challenge name; no trailing ·
		expect((challengeLine.match(/ · /gu) ?? []).length).toBe(1);
		expect(challengeLine).not.toContain('-');
	});

	test('includes Discord timestamp in heading when showTimestamp is true', async () => {
		const result = await formatDescendia(worldState, undefined, true);
		expect(result).toMatch(/^## Descendia <t:\d+:D>$/mu);
	});

	test('omits timestamp from heading by default', async () => {
		const result = await formatDescendia(worldState);
		expect(result).toMatch(/^## Descendia$/mu);
	});
});

describe('formatCalendarSeason', () => {
	test('returns null when KnownCalendarSeasons is empty', async () => {
		expect(await formatCalendarSeason({KnownCalendarSeasons: []})).toBeNull();
	});

	test('returns null when KnownCalendarSeasons is absent', async () => {
		expect(await formatCalendarSeason({})).toBeNull();
	});

	test('formats header with season label, no timestamp', async () => {
		const result = await formatCalendarSeason(worldState);
		// WorldState mock has CST_FALL
		expect(result).toMatch(/^## 1999 Calendar: 🍁 Autumn$/mu);
	});

	test('uses raw season key as fallback when not in SEASON_LABELS', async () => {
		const season = {...worldState.KnownCalendarSeasons[0], Season: 'CST_UNKNOWN'};
		const result = await formatCalendarSeason({KnownCalendarSeasons: [season]});
		expect(result).toContain('CST_UNKNOWN');
	});

	test('renders CET_CHALLENGE lines with 📋 prefix and bold date', async () => {
		const result = await formatCalendarSeason(worldState);
		const challengeLines = result!.split('\n').filter((l: string) => l.includes('📋'));
		expect(challengeLines.length).toBeGreaterThan(0);
		for (const line of challengeLines) {
			expect(line).toMatch(/^📋 \*\*.+\*\* .+/u);
		}
	});

	test('renders CET_REWARD lines with 🎁 prefix and bold date', async () => {
		const result = await formatCalendarSeason(worldState);
		const rewardLines = result!.split('\n').filter((l: string) => l.startsWith('🎁'));
		expect(rewardLines.length).toBeGreaterThan(0);
		for (const line of rewardLines) {
			expect(line).toMatch(/^🎁 \*\*.+\*\* .+/u);
		}
	});

	test('renders CET_UPGRADE lines with 🔧 prefix and bold date', async () => {
		const season = {
			...worldState.KnownCalendarSeasons[0],
			Days: [{
				day: 5,
				events: [{type: 'CET_UPGRADE', upgrade: '/Lotus/Upgrades/SomeUpgrade/SpeedBoost'}],
			}],
		};
		const result = await formatCalendarSeason({KnownCalendarSeasons: [season]});
		expect(result).toMatch(/^🔧 \*\*.+\*\* .+/mu);
		expect(result).toContain('Speed Boost');
	});

	test('groups consecutive CET_REWARD events on the same day into a single middot-separated line', async () => {
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
		const result = await formatCalendarSeason({KnownCalendarSeasons: [season]});
		const rewardLines = result!.split('\n').filter((l: string) => l.startsWith('🎁'));
		expect(rewardLines).toHaveLength(1);
		expect(rewardLines[0]).toContain(' · ');
	});

	test('groups consecutive CET_UPGRADE events on the same day into a single middot-separated line', async () => {
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
		const result = await formatCalendarSeason({KnownCalendarSeasons: [season]});
		const upgradeLines = result!.split('\n').filter((l: string) => l.startsWith('🔧'));
		expect(upgradeLines).toHaveLength(1);
		expect(upgradeLines[0]).toContain(' · ');
	});

	test('does not group CET_REWARD and CET_UPGRADE events together', async () => {
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
		const result = await formatCalendarSeason({KnownCalendarSeasons: [season]});
		const eventLines = result!.split('\n').slice(1);
		expect(eventLines).toHaveLength(2);
	});

	test('challenge not in ExportChallenges falls back to camelToWords of path segment', async () => {
		const season = {
			...worldState.KnownCalendarSeasons[0],
			Days: [{day: 3, events: [{type: 'CET_CHALLENGE', challenge: '/Lotus/Types/Challenges/SomeUnknownChallenge'}]}],
		};
		const result = await formatCalendarSeason({KnownCalendarSeasons: [season]});
		expect(result).toContain('Some Unknown Challenge');
	});

	test('reward falls back to camelToWords of path segment when not in item maps', async () => {
		const season = {
			...worldState.KnownCalendarSeasons[0],
			Days: [{day: 7, events: [{type: 'CET_REWARD', reward: '/Lotus/Types/Items/SomeWeirdReward'}]}],
		};
		const result = await formatCalendarSeason({KnownCalendarSeasons: [season]});
		expect(result).toContain('Some Weird Reward');
	});

	test('skips days with no events', async () => {
		const season = {
			...worldState.KnownCalendarSeasons[0],
			Days: [
				{day: 1, events: []},
				{day: 2, events: [{type: 'CET_UPGRADE', upgrade: '/Lotus/Upgrades/SpeedBoost'}]},
			],
		};
		const result = await formatCalendarSeason({KnownCalendarSeasons: [season]});
		const lines = result!.split('\n');
		// Only one event line (header + 1 event = 2 lines total)
		expect(lines).toHaveLength(2);
	});

	test('includes Discord timestamp in heading when showTimestamp is true', async () => {
		const result = await formatCalendarSeason(worldState, undefined, true);
		expect(result).toMatch(/^## 1999 Calendar: .+ <t:\d+:D>$/mu);
	});

	test('omits timestamp from heading by default', async () => {
		const result = await formatCalendarSeason(worldState);
		expect(result).toMatch(/^## 1999 Calendar: .+$/mu);
		expect(result).not.toMatch(/<t:\d+:D>/u);
	});
});

describe('escapeMarkdown', () => {
	test('escapes asterisk', () => {
		expect(escapeMarkdown('hello *world*')).toBe(String.raw`hello \*world\*`);
	});

	test('escapes underscore', () => {
		expect(escapeMarkdown('_italic_')).toBe(String.raw`\_italic\_`);
	});

	test('escapes tilde', () => {
		expect(escapeMarkdown('~~strike~~')).toBe(String.raw`\~\~strike\~\~`);
	});

	test('escapes backtick', () => {
		expect(escapeMarkdown('`code`')).toBe(String.raw`\`code\``);
	});

	test('escapes pipe', () => {
		expect(escapeMarkdown('a|b')).toBe(String.raw`a\|b`);
	});

	test('escapes greater-than', () => {
		expect(escapeMarkdown('> quote')).toBe(String.raw`\> quote`);
	});

	test('escapes brackets', () => {
		expect(escapeMarkdown('[link]')).toBe(String.raw`\[link\]`);
	});

	test('escapes backslash', () => {
		expect(escapeMarkdown(String.raw`back\slash`)).toBe(String.raw`back\\slash`);
	});

	test('leaves plain text unchanged', () => {
		expect(escapeMarkdown('Hello, world!')).toBe('Hello, world!');
	});

	test('escapes multiple specials in one string', () => {
		expect(escapeMarkdown('*bold* and _italic_')).toBe(String.raw`\*bold\* and \_italic\_`);
	});
});

describe('chunkMessage', () => {
	test('returns single chunk when first fits within limit', async () => {
		const chunks = chunkMessage('hello', [], 2000);
		expect(chunks).toEqual(['hello']);
	});

	test('includes rest sections as separate chunks', async () => {
		const chunks = chunkMessage('first', ['second', 'third'], 2000);
		expect(chunks).toEqual(['first', 'second', 'third']);
	});

	test('splits a message that exceeds the limit at line boundaries', async () => {
		const longLine = 'x'.repeat(100);
		const lines = Array.from({length: 25}, (_: any, i: number) => `line${i}: ${longLine}`);
		const first = lines.join('\n'); // ~2600 chars
		const chunks = chunkMessage(first, [], 200);
		expect(chunks.length).toBeGreaterThan(1);
		for (const chunk of chunks) {
			expect(chunk.length).toBeLessThanOrEqual(200);
		}

		// All content preserved
		expect(chunks.join('\n')).toBe(first);
	});

	test('splits oversized rest sections too', async () => {
		const longSection = Array.from({length: 30}, (_: any, i: number) => `> line ${i}: ${'y'.repeat(80)}`).join('\n');
		const chunks = chunkMessage('short first', [longSection], 200);
		expect(chunks[0]).toBe('short first');
		for (const chunk of chunks) {
			expect(chunk.length).toBeLessThanOrEqual(200);
		}
	});

	test('uses default limit of 2000', async () => {
		const short = 'hello';
		expect(chunkMessage(short, [])).toEqual([short]);
	});
});
