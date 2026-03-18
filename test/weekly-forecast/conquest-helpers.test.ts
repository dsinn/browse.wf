/**
 * Unit tests for src/conquest-helpers.ts
 *
 * Loads the real compiled production code to avoid test drift.
 */
import {
	describe, test, expect, beforeEach, afterEach,
} from 'vitest';
import {mockBootstrapTooltip} from '../helpers/dom-helpers';
import {loadMock, loadExportJson} from '../helpers/api-mocks';
import {
	conquestRiskTagToLoc, conquestVariableTagToLoc, transformFrameVariable, createArchimedeaTooltipElement, transformConquestMissions, renderConquestMissions, renderConquestFrameVariables,
} from '../../src/conquest-helpers';

beforeEach(() => {
	mockBootstrapTooltip();

	// ToTitleCase is provided by common.js on real pages; stub it for unit tests
	(globalThis as any).toTitleCase = (s: string) =>
		s.replaceAll(/\b\w/gu, c => c.toUpperCase());
});

afterEach(() => {
	delete (globalThis as any).toTitleCase;
});

describe('conquestRiskTagToLoc', () => {
	test('remaps EMPBlackHole to MagneticHounds', () => {
		expect(conquestRiskTagToLoc('EMPBlackHole')).toBe('MagneticHounds');
	});

	test('passes unknown tags through unchanged', () => {
		expect(conquestRiskTagToLoc('AcceleratedEnemies')).toBe('AcceleratedEnemies');
		expect(conquestRiskTagToLoc('SomeNewTag')).toBe('SomeNewTag');
	});
});

describe('conquestVariableTagToLoc', () => {
	test('remaps DullBlades to ComboCountChance', () => {
		expect(conquestVariableTagToLoc('DullBlades')).toBe('ComboCountChance');
	});

	test('remaps Undersupplied to MaxAmmo', () => {
		expect(conquestVariableTagToLoc('Undersupplied')).toBe('MaxAmmo');
	});

	test('passes unknown tags through unchanged', () => {
		expect(conquestVariableTagToLoc('ShieldDelay')).toBe('ShieldDelay');
	});
});

describe('transformFrameVariable', () => {
	test('replaces |val| with 500 for ShieldDelay', () => {
		const result = transformFrameVariable('Delay is |val|ms', 'ShieldDelay');
		expect(result).toBe('Delay is 500ms');
	});

	test('replaces |val| with 50 for TimeDilation', () => {
		const result = transformFrameVariable('Speed at |val|%', 'TimeDilation');
		expect(result).toBe('Speed at 50%');
	});

	test('strips HTML tags from description', () => {
		const result = transformFrameVariable('<b>Bold</b> text', 'OtherVar');
		expect(result).toBe('Bold text');
	});

	test('returns description unchanged for unknown variable', () => {
		const result = transformFrameVariable('Some description', 'UnknownVar');
		expect(result).toBe('Some description');
	});
});

describe('createArchimedeaTooltipElement', () => {
	const osdict = {
		'/Lotus/Language/Conquest/Condition_AcceleratedEnemies': 'Bold Venture',
		'/Lotus/Language/Conquest/Condition_AcceleratedEnemies_Desc': 'Enemies deal less damage.',
	};

	test('returns <abbr> with tooltip when text and desc exist', () => {
		const element = createArchimedeaTooltipElement(
			'/Lotus/Language/Conquest/Condition_',
			'AcceleratedEnemies',
			osdict,
		) as HTMLElement;

		expect(element.nodeName).toBe('ABBR');
		expect(element.textContent).toBe('Bold Venture');
		expect(element.dataset.bsToggle).toBe('tooltip');
		expect(element.dataset.bsTitle).toBe('Enemies deal less damage.');
	});

	test('applies descTransform to tooltip description', () => {
		const transform = (desc: string) => desc.toUpperCase();
		const element = createArchimedeaTooltipElement(
			'/Lotus/Language/Conquest/Condition_',
			'AcceleratedEnemies',
			osdict,
			transform,
		) as HTMLElement;

		expect(element.dataset.bsTitle).toBe('ENEMIES DEAL LESS DAMAGE.');
	});

	test('returns text node when only text key exists (no _Desc)', () => {
		const partialOsdict = {
			'/Lotus/Language/Conquest/Condition_NoDesc': 'Has Name Only',
		};
		const element = createArchimedeaTooltipElement(
			'/Lotus/Language/Conquest/Condition_',
			'NoDesc',
			partialOsdict,
		);

		expect(element.nodeType).toBe(Node.TEXT_NODE);
		expect(element.textContent).toBe('Has Name Only');
	});

	test('returns raw value text node when key is missing entirely', () => {
		const element = createArchimedeaTooltipElement(
			'/Lotus/Language/Conquest/Condition_',
			'CompletelyUnknownTag',
			{},
		);

		expect(element.nodeType).toBe(Node.TEXT_NODE);
		expect(element.textContent).toBe('CompletelyUnknownTag');
	});
});

describe('transformConquestMissions', () => {
	const worldState = loadMock('worldState.json');
	const ExportMissionTypes = loadExportJson('ExportMissionTypes.json');

	test('transforms CT_LAB conquest missions correctly', () => {
		const conquest = worldState.Conquests.find((c: any) => c.Type === 'CT_LAB');
		const missions = transformConquestMissions(conquest, 'CT_LAB', ExportMissionTypes);

		expect(Array.isArray(missions)).toBe(true);
		expect(missions.length).toBe(3);

		for (const m of missions as any[]) {
			expect(m).toHaveProperty('type');
			expect(m).toHaveProperty('variant');
			expect(m).toHaveProperty('conditions');
			expect(Array.isArray(m.conditions)).toBe(true);
			expect(m.conditions.length).toBeGreaterThanOrEqual(2);
		}
	});

	test('transforms CT_HEX conquest missions correctly', () => {
		const conquest = worldState.Conquests.find((c: any) => c.Type === 'CT_HEX');
		const missions = transformConquestMissions(conquest, 'CT_HEX', ExportMissionTypes);

		expect(missions.length).toBe(3);
	});

	test('transforms Defense to DualDefense for CT_LAB', () => {
		const conquest = worldState.Conquests.find((c: any) => c.Type === 'CT_LAB');
		const missions = transformConquestMissions(conquest, 'CT_LAB', ExportMissionTypes);

		// Mock data has a Defense mission (MT_DEFENSE); CT_LAB must rename it to DualDefense
		expect(missions.some((m: any) => m.type === 'Defense')).toBe(false);
		expect(missions.some((m: any) => m.type === 'DualDefense')).toBe(true);
	});

	test('does NOT transform Defense to DualDefense for CT_HEX', () => {
		const conquest = worldState.Conquests.find((c: any) => c.Type === 'CT_HEX');
		const missions = transformConquestMissions(conquest, 'CT_HEX', ExportMissionTypes);

		const hasDualDefense = missions.some((m: any) => m.type === 'DualDefense');
		expect(hasDualDefense).toBe(false);
	});

	test('selects CD_HARD difficulty when available', () => {
		const conquest = worldState.Conquests.find((c: any) => c.Type === 'CT_LAB');
		const missions = transformConquestMissions(conquest, 'CT_LAB', ExportMissionTypes);

		// Verify each mission's conditions match CD_HARD's risks (not CD_NORMAL's)
		for (const [i, m] of (missions as any[]).entries()) {
			const hardDiff = conquest.Missions[i].difficulties.find((d: any) => d.type === 'CD_HARD');
			expect(m.conditions).toEqual(hardDiff.risks);
			expect(m.variant).toBe(hardDiff.deviation);
		}
	});
});

describe('renderConquestMissions', () => {
	const worldState = loadMock('worldState.json');
	const ExportMissionTypes = loadExportJson('ExportMissionTypes.json');
	const osdict = loadMock('dicts/en.json');

	test('returns a <tbody> with one row per mission', () => {
		const conquest = worldState.Conquests.find((c: any) => c.Type === 'CT_LAB');
		const missions = transformConquestMissions(conquest, 'CT_LAB', ExportMissionTypes);
		const tbody = renderConquestMissions(
			missions,
			'/Lotus/Language/Conquest/MissionVariant_LabConquest_',
			osdict,
			{},
		);

		expect(tbody.nodeName).toBe('TBODY');
		expect(tbody.querySelectorAll('tr').length).toBe(3);
	});

	test('each row has th (type) + 3 td (variant + 2 conditions)', () => {
		const conquest = worldState.Conquests.find((c: any) => c.Type === 'CT_LAB');
		const missions = transformConquestMissions(conquest, 'CT_LAB', ExportMissionTypes);
		const tbody = renderConquestMissions(
			missions,
			'/Lotus/Language/Conquest/MissionVariant_LabConquest_',
			osdict,
			{},
		);

		for (const tr of tbody.querySelectorAll('tr')) {
			expect(tr.querySelectorAll('th').length).toBe(1);
			expect(tr.querySelectorAll('td').length).toBe(3);
		}
	});
});

describe('renderConquestFrameVariables', () => {
	const worldState = loadMock('worldState.json');
	const osdict = loadMock('dicts/en.json');

	test('returns a <tr> with one <td> per frame variable', () => {
		const conquest = worldState.Conquests.find((c: any) => c.Type === 'CT_LAB');
		const tr = renderConquestFrameVariables(
			conquest.Variables,
			osdict,
		);

		expect(tr.nodeName).toBe('TR');
		expect(tr.querySelectorAll('td').length).toBe(conquest.Variables.length);
	});

	test('handles empty frame variables array', () => {
		const tr = renderConquestFrameVariables([], osdict);
		expect(tr.querySelectorAll('td').length).toBe(0);
	});
});
