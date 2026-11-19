import {
	describe,
	it,
	expect,
	beforeEach,
	afterEach,
} from 'vitest';
import {augmentMissionRow} from './mission-extras';

function makeRow(name: string): HTMLTableRowElement {
	const row = document.createElement('tr');
	// Upstream renders: location | completions | steel path | note
	row.innerHTML = `<td>${name}</td><td>5</td><td>✓</td><td>a note</td>`;
	return row;
}

describe('augmentMissionRow', () => {
	beforeEach(() => {
		(window as any).ExportRegions = {SolNode23: {name: 'Cytherean'}, SolNode24: {name: 'Unvisited'}};
		window.profile = {
			Stats: {
				Missions: [
					{type: 'SolNode23', highScore: 1_773_000},
					{type: 'SolNode24', highScore: 0},
					{type: '/Lotus/Types/Keys/RaidKeys/Raid01Stage03KeyItem', highScore: 12},
				],
			},
		};
	});

	afterEach(() => {
		delete (window as any).ExportRegions;
		delete window.profile;
	});

	it('inserts the high score before the note cell', () => {
		const row = makeRow('Cytherean');
		augmentMissionRow(row, {Tag: 'SolNode23'});

		expect([...row.cells].map(cell => cell.textContent)).toEqual(['Cytherean', '5', '✓', (1_773_000).toLocaleString(), 'a note']);
	});

	it('leaves the high score blank when there is none, or it is 0', () => {
		const unplayed = makeRow('Unvisited');
		augmentMissionRow(unplayed, {Tag: 'SolNode24'});
		const unknown = makeRow('Elsewhere');
		augmentMissionRow(unknown, {Tag: 'SolNode99'});

		expect(unplayed.cells[3].textContent).toBe('');
		expect(unknown.cells[3].textContent).toBe('');
	});

	it('keeps the node name for a tag with a known region', () => {
		const row = makeRow('Cytherean');
		augmentMissionRow(row, {Tag: 'SolNode23'});

		expect(row.cells[0].querySelector('code')).toBeNull();
	});

	it('shows a tag without a known region in teletype, with the full tag as a tooltip', () => {
		const tag = '/Lotus/Types/Keys/RaidKeys/Raid01Stage03KeyItem';
		const row = makeRow(tag);
		augmentMissionRow(row, {Tag: tag});

		const code = row.cells[0].querySelector<HTMLElement>('code.internal-name');
		expect(code?.textContent).toBe('Raid01Stage03KeyItem');
		expect(code?.dataset.bsTitle).toBe(tag);
		expect(row.cells[3].textContent).toBe('12');
	});
});
