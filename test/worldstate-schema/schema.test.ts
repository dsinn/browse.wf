import * as fs from 'node:fs';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, test, expect} from 'vitest';
import {formatReport, validate} from './rules';
import {worldStateSchema} from './schema';

const mockPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '__mocks__', 'worldState.json');
const loadMock = (): any => JSON.parse(fs.readFileSync(mockPath, 'utf8'));
const check = (worldState: any) => validate(worldState, worldStateSchema, {now: worldState.Time * 1000});
const messages = (worldState: any) => check(worldState).map(issue => `${issue.severity} ${issue.path} ${issue.message}`);

describe('worldState schema', () => {
	test('the worldState mock matches the schema', () => {
		const worldState = loadMock();
		expect(formatReport(check(worldState))).toBe('worldState: matches the schema (no errors or warnings)');
	});

	test('a new top-level key is an error', () => {
		const worldState = loadMock();
		worldState.ShinyNewThing = [1, 2];
		expect(messages(worldState)).toEqual(['error ShinyNewThing is new (not in the schema): array(2)']);
	});

	test('a missing key the site reads is an error, but a missing unused key is a warning', () => {
		const worldState = loadMock();
		delete worldState.Invasions;
		delete worldState.FeaturedGuilds;
		expect(messages(worldState)).toEqual(['error Invasions is missing', 'warning FeaturedGuilds is missing']);
	});

	test('a new field inside a collection the site reads is an error, but a known unused field is not', () => {
		const worldState = loadMock();
		const sortie = worldState.Sorties[0];
		worldState.Alerts = [{
			_id: sortie._id,
			Activation: sortie.Activation,
			Expiry: sortie.Expiry,
			Tag: 'SomeEvent',
			MissionInfo: {
				missionType: 'MT_EXTERMINATION',
				faction: 'FC_GRINEER',
				location: 'SolNode1',
				minEnemyLevel: 1,
				maxEnemyLevel: 5,
				missionReward: {credits: 1000},
				seed: 1234,
				brandNewField: true,
			},
		}];
		expect(messages(worldState)).toEqual(['error Alerts[*].MissionInfo.brandNewField is new (not in the schema): boolean']);
	});

	test('a changed fixed count is an error', () => {
		const worldState = loadMock();
		worldState.LiteSorties[0].Missions.pop();
		expect(messages(worldState)).toEqual(['error LiteSorties[*].Missions has 2 items, expected exactly 3']);
	});

	test('a value outside a set the site looks up is an error that shows the value', () => {
		const worldState = loadMock();
		worldState.Invasions[0].Faction = 'FC_MURMUR';
		expect(check(worldState)).toEqual([expect.objectContaining({
			severity: 'error',
			path: 'Invasions[*].Faction',
			message: 'has a value outside the known set (FC_INFESTATION, FC_CORPUS, FC_GRINEER)',
			examples: ['"FC_MURMUR"'],
		})]);
	});

	test('a broken invariant is an error', () => {
		const worldState = loadMock();
		worldState.Conquests[1].Type = 'CT_LAB';
		expect(messages(worldState)).toEqual([
			'error Conquests expected one or two CT_LAB (Deep Archimedea) and CT_HEX (Temporal Archimedea) entries each',
			'error Conquests expected a CT_LAB and a CT_HEX entry active at worldState.Time',
		]);
	});

	test('a malformed date the site parses is an error', () => {
		const worldState = loadMock();
		worldState.Sorties[0].Expiry = {$date: {$numberLong: 'soon'}};
		expect(messages(worldState)).toEqual([
			String.raw`error Sorties[*].Expiry.$date.$numberLong does not match /^\d{12,14}$/u`,
			'error Sorties expected an entry whose Activation–Expiry window contains worldState.Time',
		]);
	});
});
