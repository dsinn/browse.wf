/**
 * Tests for src/arbys/tilesets.ts
 */
import {
	describe, test, expect, beforeEach, afterEach,
} from 'vitest';
import type {IRegion} from 'warframe-public-export-plus';
import {appendTilesetText, isTilesetChecked, updateTilesetNextOccurrence} from './tilesets.js';

const BASE_NODE: Partial<IRegion> = {
	tileset: 'GrineerAsteroidTileset',
	name: '/Lotus/Language/Locations/SolNode1',
	systemName: '/Lotus/Language/Systems/SolSystem1',
	missionName: '/Lotus/Language/Missions/MissionName_Survival',
	missionType: 'MT_SURVIVAL',
	faction: 'FC_GRINEER',
	systemIndex: 0,
	nodeType: 0,
	masteryReq: 0,
	missionIndex: 0,
	minEnemyLevel: 1,
	maxEnemyLevel: 3,
	masteryExp: 0,
};

function makeNode(overrides: Partial<IRegion> = {}): IRegion {
	return {...BASE_NODE, ...overrides} as unknown as IRegion;
}

beforeEach(() => {
	(globalThis as any).getTileset = (node: IRegion) => node.tileset;
	(globalThis as any).formatTileset = (tileset: string | undefined) =>
		tileset ? tileset.replace('Tileset', '').replaceAll(/(?<=[a-z])(?=[A-Z])/gu, ' ') : '';
});

afterEach(() => {
	delete (globalThis as any).getTileset;
	delete (globalThis as any).formatTileset;
	document.body.innerHTML = '';
});

describe('appendTilesetText', () => {
	test('appends formatted tileset to span text', () => {
		const span = document.createElement('span');
		span.textContent = 'foo (S tier';
		appendTilesetText(span, makeNode());
		expect(span.textContent).toBe('foo (S tier, Grineer Asteroid');
	});

	test('does nothing when node has no tileset', () => {
		const span = document.createElement('span');
		span.textContent = 'foo (S tier';
		appendTilesetText(span, makeNode({tileset: undefined}));
		expect(span.textContent).toBe('foo (S tier');
	});
});

describe('isTilesetChecked', () => {
	test('returns true when node has no tileset', () => {
		expect(isTilesetChecked(makeNode({tileset: undefined}))).toBe(true);
	});

	test('returns true when checkbox is absent', () => {
		expect(isTilesetChecked(makeNode())).toBe(true);
	});

	test('returns true when checkbox is checked', () => {
		document.body.innerHTML = '<input type="checkbox" id="filter-GrineerAsteroidTileset" checked>';
		expect(isTilesetChecked(makeNode())).toBe(true);
	});

	test('returns false when checkbox is unchecked', () => {
		document.body.innerHTML = '<input type="checkbox" id="filter-GrineerAsteroidTileset">';
		expect(isTilesetChecked(makeNode())).toBe(false);
	});
});

describe('updateTilesetNextOccurrence', () => {
	function makeTable(innerHTML = 'N/A'): void {
		document.body.innerHTML = `
			<table><tbody>
				<tr id="next-GrineerAsteroidTileset" data-starved="true">
					<td></td>
					<td>${innerHTML}</td>
					<td></td>
				</tr>
			</tbody></table>`;
	}

	test('does nothing when node has no tileset', () => {
		makeTable();
		updateTilesetNextOccurrence(makeNode({tileset: undefined}), 0, 'date', 'detail');
		expect(document.querySelector('#next-GrineerAsteroidTileset')).toBeTruthy(); // Untouched
	});

	test('does nothing when row is absent', () => {
		document.body.innerHTML = '';
		// Should not throw
		expect(() => {
			updateTilesetNextOccurrence(makeNode(), 0, 'date', 'detail');
		}).not.toThrow();
	});

	test('does nothing when row is already filled', () => {
		makeTable('Mon, April 1');
		updateTilesetNextOccurrence(makeNode(), 12_345, 'new date', 'new detail');
		expect(document.querySelector('#next-GrineerAsteroidTileset')!.children[1].textContent).toBe('Mon, April 1');
	});

	test('populates row when unfilled', () => {
		makeTable();
		updateTilesetNextOccurrence(makeNode(), 12_345, 'Mon, April 1', 'Survival @ Node');
		const tr = document.querySelector('#next-GrineerAsteroidTileset')!;
		expect((tr as HTMLElement).dataset.starved).toBeUndefined();
		expect((tr.children[1] as HTMLElement).dataset.timestamp).toBe('12345');
		expect(tr.children[1].textContent).toBe('Mon, April 1');
		expect(tr.children[2].textContent).toBe('Survival @ Node');
	});

	test('appends dark sector bonus when present', () => {
		makeTable();
		const node = makeNode({
			darkSectorData: {
				rewardType: '', resourceBonus: 0.25, creditBonus: 0, xpBonus: 0,
			},
		} as any);
		updateTilesetNextOccurrence(node, 12_345, 'Mon, April 1', 'Survival @ Node');
		expect(document.querySelector('#next-GrineerAsteroidTileset')!.children[2].textContent)
			.toBe('Survival @ Node (25% resource bonus)');
	});
});
