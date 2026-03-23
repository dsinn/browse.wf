/**
 * Unit tests for src/conquest-helpers.ts
 *
 * Data resolution logic (tag remapping, difficulty selection, |val| substitution) is
 * tested via src/archimedea-data.ts. These tests cover the DOM rendering layer only.
 */
import {
	describe, test, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {mockBootstrapTooltip} from '../helpers/dom-helpers';
import {loadMock} from '../helpers/api-mocks';
import {
	renderConquestMissions, renderConquestFrameVariables, renderConquestTable,
} from '../../src/conquest-helpers';
import type {IResolvedConquestMission, IResolvedFrameVariable} from '../../src/archimedea-data';

beforeEach(() => {
	mockBootstrapTooltip();
});

describe('renderConquestMissions', () => {
	const missions: IResolvedConquestMission[] = [
		{
			type: 'Dual Defense',
			variant: 'Unity Of Purpose',
			variantDesc: 'Enemies can target and destroy Conduits.',
			conditions: [
				{name: 'Shielded Foes', desc: 'Enemies have shields.'},
				{name: 'Draining Residuals', desc: undefined},
			],
		},
		{
			type: 'Survival',
			variant: 'Fragile Nodes',
			variantDesc: undefined,
			conditions: [
				{name: 'Point Blank', desc: 'Close range.'},
				{name: 'Explosive Crawlers', desc: 'Watch out.'},
			],
		},
	];

	test('returns a <tbody> with one row per mission', () => {
		const tbody = renderConquestMissions(missions);
		expect(tbody.nodeName).toBe('TBODY');
		expect(tbody.querySelectorAll('tr').length).toBe(2);
	});

	test('each row has th (type) + td (variant) + td per condition', () => {
		const tbody = renderConquestMissions(missions);
		for (const tr of tbody.querySelectorAll('tr')) {
			expect(tr.querySelectorAll('th').length).toBe(1);
			expect(tr.querySelectorAll('td').length).toBe(3);
		}
	});

	test('variant with desc renders as <abbr> with tooltip', () => {
		const tbody = renderConquestMissions(missions);
		const variantTd = tbody.querySelector('tr td');
		const abbr = variantTd?.querySelector<HTMLElement>('abbr');
		expect(abbr?.textContent).toBe('Unity Of Purpose');
		expect(abbr?.dataset.bsTitle).toBe('Enemies can target and destroy Conduits.');
	});

	test('variant without desc renders as plain text node', () => {
		const tbody = renderConquestMissions(missions);
		const secondRow = tbody.querySelectorAll('tr')[1];
		const variantTd = secondRow.querySelector('td');
		expect(variantTd?.querySelector('abbr')).toBeNull();
		expect(variantTd?.textContent).toBe('Fragile Nodes');
	});

	test('condition without desc renders as plain text node', () => {
		const tbody = renderConquestMissions(missions);
		// Second condition of first row has no desc
		const cond2Td = tbody.querySelector('tr td:nth-child(4)');
		expect(cond2Td?.querySelector('abbr')).toBeNull();
		expect(cond2Td?.textContent).toBe('Draining Residuals');
	});
});

describe('renderConquestFrameVariables', () => {
	const frameVariables: IResolvedFrameVariable[] = [
		{name: 'Shield Delay', desc: 'Shields take 500ms to recharge.'},
		{name: 'Starvation', desc: undefined},
	];

	test('returns a <tr> with one <td> per frame variable', () => {
		const tr = renderConquestFrameVariables(frameVariables);
		expect(tr.nodeName).toBe('TR');
		expect(tr.querySelectorAll('td').length).toBe(2);
	});

	test('frame variable with desc renders as <abbr> with tooltip', () => {
		const tr = renderConquestFrameVariables(frameVariables);
		const abbr = tr.querySelector<HTMLElement>('td abbr');
		expect(abbr?.textContent).toBe('Shield Delay');
		expect(abbr?.dataset.bsTitle).toBe('Shields take 500ms to recharge.');
	});

	test('frame variable without desc renders as plain text node', () => {
		const tr = renderConquestFrameVariables(frameVariables);
		const secondTd = tr.querySelectorAll('td')[1];
		expect(secondTd.querySelector('abbr')).toBeNull();
		expect(secondTd.textContent).toBe('Starvation');
	});

	test('handles empty array', () => {
		const tr = renderConquestFrameVariables([]);
		expect(tr.querySelectorAll('td').length).toBe(0);
	});
});

describe('renderConquestTable', () => {
	async function render(conquest: any, type: string, prefix: string) {
		const container = document.createElement('div');
		return renderConquestTable(container, conquest, type, prefix).then(() => container);
	}

	async function labRender(worldState: any) {
		const conquest = worldState.Conquests.find((c: any) => c.Type === 'CT_LAB');
		return render(conquest, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_');
	}

	async function hexRender(worldState: any) {
		const conquest = worldState.Conquests.find((c: any) => c.Type === 'CT_HEX');
		return render(conquest, 'CT_HEX', '/Lotus/Language/Conquest/MissionVariant_HexConquest_');
	}

	test('creates missions and fv tables inside the container', async () => {
		const worldState = loadMock('worldState.json');
		const container = await labRender(worldState);

		const [missionsTable, fvTable] = container.querySelectorAll('table');
		expect(missionsTable.querySelectorAll('tr').length).toBe(3);
		expect(fvTable.querySelector('tr')).not.toBeNull();
	});

	test('clears existing content and disposes tooltips before re-rendering', async () => {
		const worldState = loadMock('worldState.json');
		const conquest = worldState.Conquests.find((c: any) => c.Type === 'CT_LAB');
		const container = document.createElement('div');

		await renderConquestTable(container, conquest, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_');
		const firstAbbrs = [...container.querySelectorAll('[data-bs-toggle=tooltip]')];
		expect(firstAbbrs.length).toBeGreaterThan(0);
		for (const abbr of firstAbbrs) {
			expect((globalThis as any).bootstrap.Tooltip.getInstance(abbr)).not.toBeNull();
		}

		await renderConquestTable(container, conquest, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_');
		for (const abbr of firstAbbrs) {
			expect((globalThis as any).bootstrap.Tooltip.getInstance(abbr)).toBeUndefined();
		}

		expect(container.querySelectorAll('table').length).toBe(2);
	});

	test('CT_LAB Defense mission is rendered as Dual Defense', async () => {
		const worldState = loadMock('worldState-conquest-ct-lab-defense.json');
		const container = await labRender(worldState);

		const types = [...container.querySelectorAll('tbody tr th')].map(th => th.textContent);
		expect(types.some(t => t?.includes('Defense'))).toBe(true);
		expect(types).not.toContain('Defense');
	});

	test('CT_HEX Defense mission is NOT renamed to Dual Defense', async () => {
		const worldState = loadMock('worldState-conquest-ct-lab-defense.json');
		const container = await hexRender(worldState);

		const types = [...container.querySelectorAll('tbody tr th')].map(th => th.textContent);
		expect(types).not.toContain('Dual Defense');
	});

	test('ShieldDelay frame variable tooltip replaces |val| with 500', async () => {
		const worldState = loadMock('worldState-conquest-shield-delay.json');
		const container = await labRender(worldState);

		const firstFvAbbr = container.querySelector<HTMLElement>('table:last-child abbr');
		expect(firstFvAbbr?.dataset.bsTitle).toContain('500');
		expect(firstFvAbbr?.dataset.bsTitle).not.toContain('|val|');
	});

	test('TimeDilation frame variable tooltip replaces |val| with 50', async () => {
		const worldState = loadMock('worldState-conquest-time-dilation.json');
		const container = await hexRender(worldState);

		const firstFvAbbr = container.querySelector<HTMLElement>('table:last-child abbr');
		expect(firstFvAbbr?.dataset.bsTitle).toContain('50');
		expect(firstFvAbbr?.dataset.bsTitle).not.toContain('|val|');
	});

	test('unknown frame variable renders as plain text', async () => {
		const worldState = loadMock('worldState-conquest-unknown-frame-variable.json');
		const container = await labRender(worldState);

		const firstFvTd = container.querySelector('table:last-child td');
		expect(firstFvTd?.querySelector('abbr')).toBeNull();
		expect(firstFvTd?.textContent).toBe('UnknownFrameVariable');
	});

	test('unknown risk renders as plain text', async () => {
		const worldState = loadMock('worldState-conquest-unknown-risk.json');
		const container = await labRender(worldState);

		// Row structure: th (type), td (variant), td (condition 1), td (condition 2)
		const firstConditionTd = container.querySelector('tbody tr td:nth-child(3)');
		expect(firstConditionTd?.querySelector('abbr')).toBeNull();
		expect(firstConditionTd?.textContent).toBe('UnknownRiskFromFuture');
	});

	test('unknown deviation renders as plain text', async () => {
		const worldState = loadMock('worldState-conquest-unknown-deviation.json');
		const container = await labRender(worldState);

		// Row structure: th (type), td (variant), td (condition 1), td (condition 2)
		const variantTd = container.querySelector('tbody tr td:nth-child(2)');
		expect(variantTd?.querySelector('abbr')).toBeNull();
		expect(variantTd?.textContent).toBe('UnknownDeviationFromFuture');
	});

	test('falls back to difficulty with most risks when CD_HARD is absent', async () => {
		const conquest = {
			Missions: [{
				missionType: 'MT_EXTERMINATION',
				difficulties: [
					{type: 'CD_NORMAL', deviation: 'VariantA', risks: ['PointBlank']},
					{type: 'NON_EXISTENT_TYPE', deviation: 'FragileNodes', risks: ['PointBlank', 'ExplosiveCrawlers']},
				],
			}],
			Variables: [],
		};
		const container = document.createElement('div');
		await renderConquestTable(container, conquest, 'CT_HEX', '/Lotus/Language/Conquest/MissionVariant_HexConquest_');

		// The variant from the difficulty with more risks should be shown
		const variantTd = container.querySelector('tbody tr td');
		// FragileNodes has a known osdict entry
		expect(variantTd?.textContent).not.toBe('VariantA');
	});
});
