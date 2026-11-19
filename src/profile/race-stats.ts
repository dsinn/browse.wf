/**
 Renders the Races sub-tab of the Stats tab: the player's high score in each K-Drive race (Stats.Races).

 Venus races are the Orb Vallis ones, whose names come from profile.ts (exposed as window.vallisRaceNames).
 Names for the Cambion Drift races aren't known to this page, so they are numbered.

 Called via (window as any).renderRaceStats() from the profile extras hook in profile.ts.
 */

import {lastPathSegment} from '../helpers/path-helpers.js';
import {createInternalName, enableInternalNameTooltips} from './internal-name.js';

const RACE_PATTERN = /^(?<place>Venus|Deimos)Race(?<number>\d+)$/u;
const LOCATIONS: Record<string, string> = {
	Venus: 'Orb Vallis',
	Deimos: 'Cambion Drift',
};
const LOCATION_ORDER = ['Orb Vallis', 'Cambion Drift'];

type RaceRow = {
	location: string;
	number: number;
	name: string;
	highScore: number;
	internalName?: string;
};

export function describeRace(key: string, highScore: number, vallisRaceNames: Array<string | number> = []): RaceRow {
	const groups = RACE_PATTERN.exec(key)?.groups;
	if (!groups) {
		return {
			location: 'Other', number: 0, name: lastPathSegment(key), highScore, internalName: key,
		};
	}

	const number = Number(groups.number);
	const knownName = groups.place === 'Venus' ? vallisRaceNames[number] : undefined;
	return {
		location: LOCATIONS[groups.place] ?? groups.place,
		number,
		name: typeof knownName === 'string' ? knownName : `Race ${number}`,
		highScore,
	};
}

function locationRank(location: string): number {
	const index = LOCATION_ORDER.indexOf(location);
	return index === -1 ? LOCATION_ORDER.length : index;
}

export function renderRaceStats(profile: any): void {
	const tbody = document.querySelector<HTMLElement>('#race-stats');
	if (!tbody) {
		return;
	}

	enableInternalNameTooltips(tbody);

	const {vallisRaceNames} = (globalThis as any);
	const races = Object.entries<any>(profile?.Stats?.Races ?? {})
		.map(([key, race]) => describeRace(key, Number(race?.highScore) || 0, vallisRaceNames))
		.sort((a, b) => locationRank(a.location) - locationRank(b.location) || a.number - b.number);

	if (races.length === 0) {
		const cell = document.createElement('td');
		cell.colSpan = 3;
		cell.className = 'text-body-secondary';
		cell.textContent = 'No race records.';
		const row = document.createElement('tr');
		row.append(cell);
		tbody.replaceChildren(row);
		return;
	}

	const rows = races.map(race => {
		const locationCell = document.createElement('td');
		locationCell.textContent = race.location;

		const nameCell = document.createElement('td');
		if (race.internalName) {
			nameCell.append(createInternalName(race.internalName));
		} else {
			nameCell.textContent = race.name;
		}

		const scoreCell = document.createElement('td');
		scoreCell.textContent = race.highScore.toLocaleString();

		const row = document.createElement('tr');
		row.append(locationCell, nameCell, scoreCell);
		return row;
	});
	tbody.replaceChildren(...rows);
}

window.renderRaceStats = renderRaceStats;
