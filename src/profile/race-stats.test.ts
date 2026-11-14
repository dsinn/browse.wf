import {
	describe,
	it,
	expect,
	beforeEach,
} from 'vitest';
import {mockBootstrapTooltip} from '@test/helpers/dom-helpers';
import {describeRace, renderRaceStats} from './race-stats';

const vallisRaceNames = [0, 'Puffin’ Pastures', 'Bomb the Spaceport'];

describe('describeRace', () => {
	it('names Orb Vallis races from the list passed in', () => {
		expect(describeRace('VenusRace2', 4026, vallisRaceNames)).toEqual({
			location: 'Orb Vallis', number: 2, name: 'Bomb the Spaceport', highScore: 4026,
		});
	});

	it('numbers Orb Vallis races that have no known name', () => {
		expect(describeRace('VenusRace9', 1, vallisRaceNames).name).toBe('Race 9');
	});

	it('numbers Cambion Drift races, since their names are not known', () => {
		expect(describeRace('DeimosRace1', 3410, vallisRaceNames)).toEqual({
			location: 'Cambion Drift', number: 1, name: 'Race 1', highScore: 3410,
		});
	});

	it('keeps unrecognized keys as internal names', () => {
		expect(describeRace('MarsRace4', 5)).toMatchObject({location: 'Other', name: 'MarsRace4', internalName: 'MarsRace4'});
	});
});

describe('renderRaceStats', () => {
	beforeEach(() => {
		mockBootstrapTooltip();
		(globalThis as any).vallisRaceNames = vallisRaceNames;
		document.body.innerHTML = '<table><tbody id="race-stats"></tbody></table>';
	});

	function cellText() {
		return [...document.querySelectorAll<HTMLTableRowElement>('#race-stats tr')]
			.map(row => [...row.cells].map(cell => cell.textContent));
	}

	it('lists Orb Vallis races before Cambion Drift ones, in race order', () => {
		renderRaceStats({
			Stats: {
				Races: {
					DeimosRace2: {highScore: 1834},
					VenusRace2: {highScore: 4026},
					DeimosRace1: {highScore: 3410},
					VenusRace1: {highScore: 4574},
				},
			},
		});

		expect(cellText()).toEqual([
			['Orb Vallis', 'Puffin’ Pastures', (4574).toLocaleString()],
			['Orb Vallis', 'Bomb the Spaceport', (4026).toLocaleString()],
			['Cambion Drift', 'Race 1', (3410).toLocaleString()],
			['Cambion Drift', 'Race 2', (1834).toLocaleString()],
		]);
	});

	it('says so when there are no race records', () => {
		renderRaceStats({Stats: {}});

		expect(cellText()).toEqual([['No race records.']]);
	});

	it('replaces the previous rows when rendered again', () => {
		const profile = {Stats: {Races: {VenusRace1: {highScore: 1}}}};
		renderRaceStats(profile);
		renderRaceStats(profile);

		expect(cellText()).toHaveLength(1);
	});
});
