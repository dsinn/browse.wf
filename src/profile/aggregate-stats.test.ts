import {
	describe,
	it,
	expect,
	beforeEach,
} from 'vitest';
import {
	buildEnemyAggregateRows,
	buildEquipmentAggregateRows,
	renderEnemyAggregates,
	renderEquipmentAggregates,
	type AggregateRow,
} from './aggregate-stats';

const texts = (rows: AggregateRow[]) => rows.map(row => row.map(cell => cell.text));
const column = (rows: AggregateRow[], index: number) => rows.map(row => row[index].text);

const weapons = [
	{
		equipTime: 7200, kills: 100, headshots: 10, assists: 5, fired: 1000, hits: 250, xp: 30_000,
	},
	{
		equipTime: 3600, kills: 50, fired: 500,
	},
	{
		equipTime: 3600, kills: 20, xp: 100,
	},
	{kills: 7},
];
const categories = ['LongGuns', 'LongGuns', 'Suits', 'Unnamed'];

describe('buildEquipmentAggregateRows', () => {
	const rows = buildEquipmentAggregateRows(weapons, categories);

	it('has a row per category present, most hours first, then a total', () => {
		expect(column(rows, 1)).toEqual(['Primary', 'Warframes', 'Unnamed', 'Total']);
	});

	it('ranks the categories by hours, and leaves the total unranked', () => {
		expect(column(rows, 0)).toEqual(['1', '2', '3', '']);
	});

	it('keeps the order of the filter buttons for categories with the same hours', () => {
		const tied = buildEquipmentAggregateRows([{equipTime: 3600}, {equipTime: 3600}], ['LongGuns', 'Suits']);

		expect(column(tied, 1)).toEqual(['Warframes', 'Primary', 'Total']);
	});

	it('totals each figure for the category', () => {
		expect(texts(rows)[0]).toEqual([
			'1', 'Primary', '3.0', '150', '5', '10', (1500).toLocaleString(), '25.0%', (30_000).toLocaleString(),
		]);
	});

	it('works the hit rate out only from weapons that recorded both shots and hits', () => {
		// The second weapon fired 500 shots but has no hits key, so it isn't counted against the 25%
		expect(rows[0][7]).toEqual({text: '25.0%', sortValue: 25});
	});

	it('gives each figure a numeric sort value', () => {
		expect(rows[0].slice(2).map(cell => cell.sortValue)).toEqual([3, 150, 5, 10, 1500, 25, 30_000]);
	});

	it('shows a placeholder for figures that have no value, which sorts below every real one', () => {
		const warframes = rows[1];

		expect(warframes[6]).toEqual({sortValue: -1});
		expect(warframes[7]).toEqual({sortValue: -1});
		expect(rows[2][2]).toEqual({text: '0.0', sortValue: 0});
	});

	it('totals every weapon in the total row, but not the hours, which overlap', () => {
		const total = rows.at(-1)!;

		expect(total[1].text).toBe('Total');
		expect(total[2]).toEqual({sortValue: -1});
		expect(total.slice(3, 6).map(cell => cell.text)).toEqual(['177', '5', '10']);
		expect(total[8].text).toBe((30_100).toLocaleString());
	});

	it('keeps a category it has no label for, after the known ones', () => {
		expect(column(buildEquipmentAggregateRows([{kills: 1}, {kills: 2}], ['Suits', 'FutureThing']), 1)).toEqual([
			'Warframes', 'FutureThing', 'Total',
		]);
	});
});

describe('buildEquipmentAggregateRows without the unnamed items', () => {
	const itemsWithUnnamed = [
		{equipTime: 3600, kills: 10},
		{equipTime: 1800, kills: 5},
		{equipTime: 7200, kills: 100},
	];
	const itemCategories = ['Suits', 'Suits', 'Unnamed'];

	it('has no row for the Unnamed category, and leaves them out of the total', () => {
		const rows = buildEquipmentAggregateRows(itemsWithUnnamed, itemCategories, false);

		expect(column(rows, 1)).toEqual(['Warframes', 'Total']);
		expect(rows.at(-1)![3].text).toBe('15');
	});

	it('includes them, ranked with the rest, unless told otherwise', () => {
		const rows = buildEquipmentAggregateRows(itemsWithUnnamed, itemCategories);

		expect(column(rows, 1)).toEqual(['Unnamed', 'Warframes', 'Total']);
		expect(rows.at(-1)![3].text).toBe('115');
	});
});

describe('buildEnemyAggregateRows', () => {
	const enemies = [
		{
			type: '/E/A', kills: 10, assists: 1, headshots: 4, executions: 2, deaths: 1,
		},
		{type: '/E/B', kills: 5, headshots: 1},
		{type: '/E/C', kills: 8, deaths: 3},
		{type: '/E/D', kills: 2},
		{type: '/E/E', kills: 1},
	];
	const factions = ['Grineer', 'Grineer', 'Corpus', '', 'Unnamed'];
	const scans = [{type: '/E/A', scans: 9}, {type: '/E/C', scans: 4}, {type: '/E/Z', scans: 100}];
	const rows = buildEnemyAggregateRows(enemies, factions, scans);

	it('has a row per faction present (including Other and Unnamed), most kills first, then a total', () => {
		expect(column(rows, 1)).toEqual(['Grineer', 'Corpus', 'Other', 'Unnamed', 'Total']);
	});

	it('has no row for the Unnamed enemies, and leaves them out of the total, when told to leave them out', () => {
		const withoutUnnamed = buildEnemyAggregateRows(enemies, factions, scans, false);

		expect(column(withoutUnnamed, 1)).toEqual(['Grineer', 'Corpus', 'Other', 'Total']);
		expect(withoutUnnamed.at(-1)![2].text).toBe('25');
		expect(rows.at(-1)![2].text).toBe('26');
	});

	it('ranks the factions by kills, and leaves the total unranked', () => {
		expect(column(rows, 0)).toEqual(['1', '2', '3', '4', '']);

		const reordered = buildEnemyAggregateRows([{type: '/E/A', kills: 1}, {type: '/E/B', kills: 9}], ['Grineer', 'Corpus'], []);
		expect(column(reordered, 1)).toEqual(['Corpus', 'Grineer', 'Total']);
	});

	it('totals each figure for the faction, including its scans', () => {
		expect(texts(rows)[0]).toEqual(['1', 'Grineer', '15', '1', '5', '2', '1', '9']);
		expect(texts(rows)[1]).toEqual(['2', 'Corpus', '8', '0', '0', '0', '3', '4']);
	});

	it('gives each figure a numeric sort value', () => {
		expect(rows[0].slice(2).map(cell => cell.sortValue)).toEqual([15, 1, 5, 2, 1, 9]);
	});

	it('counts enemies of no listed faction as Other', () => {
		expect(texts(rows)[2]).toEqual(['3', 'Other', '2', '0', '0', '0', '0', '0']);
	});

	it('totals everything in the total row, ignoring scans of enemies that are not in the table', () => {
		expect(texts(rows).at(-1)).toEqual(['', 'Total', '26', '1', '5', '2', '4', '13']);
	});
});

// The tables themselves are in profile.php; these are the parts of them that the module fills in
function setupDOM(prefix: string) {
	document.body.innerHTML = `
		<div id="${prefix}-aggregates" class="d-none">
			<table>
				<thead><tr><th>#</th><th>Name</th></tr></thead>
				<tbody id="${prefix}-aggregate-rows"></tbody>
				<tfoot id="${prefix}-aggregate-total"></tfoot>
			</table>
		</div>
	`;
}

const rowTexts = (selector: string) => [...document.querySelectorAll<HTMLTableRowElement>(selector)]
	.map(row => [...row.cells].map(cell => cell.textContent));

describe('renderEquipmentAggregates', () => {
	beforeEach(() => {
		setupDOM('equipment');
	});

	it('shows the block, with a row per category in the body and the total in the footer', () => {
		renderEquipmentAggregates(weapons, categories);

		expect(document.querySelector('#equipment-aggregates')?.classList.contains('d-none')).toBe(false);
		expect(rowTexts('#equipment-aggregate-rows tr').map(row => row[1])).toEqual(['Primary', 'Warframes', 'Unnamed']);
		expect(rowTexts('#equipment-aggregate-total tr')[0][1]).toBe('Total');
	});

	it('numbers the ranks, and renumbers them in the order the rows end up in', async () => {
		renderEquipmentAggregates(weapons, categories);
		const tbody = document.querySelector<HTMLElement>('#equipment-aggregate-rows')!;
		expect(rowTexts('#equipment-aggregate-rows tr').map(row => row[0])).toEqual(['1', '2', '3']);

		// What table-sort-js does when sorting: put the rows back in a different order
		tbody.append(tbody.firstElementChild!);
		await Promise.resolve();

		expect(rowTexts('#equipment-aggregate-rows tr').map(row => row[1])).toEqual(['Warframes', 'Unnamed', 'Primary']);
		expect(rowTexts('#equipment-aggregate-rows tr').map(row => row[0])).toEqual(['1', '2', '3']);
	});

	it('gives the cells their sort values, and shows a placeholder where there is no value', () => {
		renderEquipmentAggregates(weapons, categories);

		const warframes = document.querySelectorAll<HTMLTableRowElement>('#equipment-aggregate-rows tr')[1];
		expect(warframes.cells[3].dataset.sort).toBe('20');
		expect(warframes.cells[6].textContent).toBe('—');
		expect(warframes.cells[6].dataset.sort).toBe('-1');
	});

	it('replaces the previous rows when rendered again', () => {
		renderEquipmentAggregates(weapons, categories);
		renderEquipmentAggregates(weapons, categories);

		expect(document.querySelectorAll('#equipment-aggregate-rows tr')).toHaveLength(3);
		expect(document.querySelectorAll('#equipment-aggregate-total tr')).toHaveLength(1);
	});

	it('hides the block, and clears earlier rows, when there is no data', () => {
		renderEquipmentAggregates(weapons, categories);
		renderEquipmentAggregates([], []);

		expect(document.querySelector('#equipment-aggregates')?.classList.contains('d-none')).toBe(true);
		expect(document.querySelectorAll('#equipment-aggregate-rows tr')).toHaveLength(0);
		expect(document.querySelectorAll('#equipment-aggregate-total tr')).toHaveLength(0);
	});

	it('does nothing when the page has no such table', () => {
		document.body.replaceChildren();

		expect(() => {
			renderEquipmentAggregates(weapons, categories);
		}).not.toThrow();
	});
});

describe('renderEnemyAggregates', () => {
	beforeEach(() => {
		setupDOM('enemy');
	});

	it('fills the enemy table the same way', () => {
		renderEnemyAggregates([{type: '/E/A', kills: 3}, {type: '/E/B', kills: 9}], ['Grineer', 'Corpus'], []);

		expect(rowTexts('#enemy-aggregate-rows tr').map(row => row.slice(0, 3))).toEqual([['1', 'Corpus', '9'], ['2', 'Grineer', '3']]);
		expect(rowTexts('#enemy-aggregate-total tr')[0].slice(0, 3)).toEqual(['', 'Total', '12']);
		expect(document.querySelector('#enemy-aggregates')?.classList.contains('d-none')).toBe(false);
	});
});
