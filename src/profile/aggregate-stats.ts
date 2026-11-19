/**
 Aggregate tables for the top of the Stats > Equipment and Stats > Enemies sub-tabs: the same figures as the tables
 of individual entries below them, totalled by category (equipment) or faction (enemies), with a total row. The
 groups are ranked in the same default order as the entries: by hours for equipment, and by kills for enemies.

 The equipment table has no "Used" column, since that is a share within a category and so has no total. It also
 shows no total for hours, since items are equipped at the same time and the hours don't add up.

 The tables themselves (with their headings and sort classes) are in profile.php, like the entry tables, so that
 table-sort-js picks them up when the page loads; this module fills in the rows. The total row is in the table's
 footer, so sorting leaves it at the bottom.

 Called from augmentEquipmentStats() and augmentEnemyStats(), which already work out each entry's category.
 */

import {NO_VALUE_SORT, NO_VALUE_TEXT} from './no-value.js';
import {
	makeRenumber,
	ENEMY_FACTIONS,
	EQUIPMENT_CATEGORIES,
	UNNAMED_CATEGORY,
} from './stats-filters.js';

const OTHER_FACTION_LABEL = 'Other';

type EquipmentTotals = {
	equipTime: number;
	kills: number;
	headshots: number;
	assists: number;
	fired: number;
	// Shots fired, and hits, over the weapons that recorded both; a weapon with shots but no hits key usually just
	// doesn't track hits, so it shouldn't count against the hit rate.
	trackedFired: number;
	trackedHits: number;
	xp: number;
};

type EnemyTotals = {
	kills: number;
	assists: number;
	headshots: number;
	finishers: number;
	deaths: number;
	scans: number;
};

const toNumber = (value: unknown): number => Number(value) || 0;

function emptyEquipmentTotals(): EquipmentTotals {
	return {
		equipTime: 0, kills: 0, headshots: 0, assists: 0, fired: 0, trackedFired: 0, trackedHits: 0, xp: 0,
	};
}

function addEquipment(totals: EquipmentTotals, weapon: any): void {
	totals.equipTime += toNumber(weapon.equipTime);
	totals.kills += toNumber(weapon.kills);
	totals.headshots += toNumber(weapon.headshots);
	totals.assists += toNumber(weapon.assists);
	totals.xp += toNumber(weapon.xp);

	const fired = toNumber(weapon.fired);
	totals.fired += fired;
	if (!(fired > 0 && typeof weapon.hits === 'number')) {
		return;
	}

	totals.trackedFired += fired;
	totals.trackedHits += Number(weapon.hits);
}

/**
 Totals the equipment stats by category. The categories array holds the category of each weapon, in order.
 */
export function totalEquipmentByCategory(weapons: any[], categories: string[]): Map<string, EquipmentTotals> {
	const totals = new Map<string, EquipmentTotals>();
	for (const [index, weapon] of weapons.entries()) {
		const category = categories[index];
		if (category === undefined) {
			continue;
		}

		if (!totals.has(category)) {
			totals.set(category, emptyEquipmentTotals());
		}

		addEquipment(totals.get(category)!, weapon);
	}

	return totals;
}

/**
 A cell of an aggregate table: its text, and the value to sort it by. A cell with no value shows a placeholder and
 sorts below every real value.
 */
export type AggregateCell = {text?: string; sortValue?: number};
export type AggregateRow = AggregateCell[];

// A cell holding a number, which is also its sort value. The text is the number as shown, e.g. with separators.
const numberCell = (value: number, text: string): AggregateCell => ({text, sortValue: value});
const noValueCell = (): AggregateCell => ({sortValue: NO_VALUE_SORT});
// The rank, and the total row's blank one
const rankCell = (rank: number | undefined): AggregateCell => ({text: rank === undefined ? '' : String(rank)});

function equipmentRow(rank: number | undefined, label: string, totals: EquipmentTotals, hasHours: boolean): AggregateRow {
	const hours = totals.equipTime / 3600;
	return [
		rankCell(rank),
		{text: label},
		hasHours ? numberCell(hours, hours.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})) : noValueCell(),
		numberCell(totals.kills, totals.kills.toLocaleString()),
		numberCell(totals.assists, totals.assists.toLocaleString()),
		numberCell(totals.headshots, totals.headshots.toLocaleString()),
		totals.fired > 0 ? numberCell(totals.fired, totals.fired.toLocaleString()) : noValueCell(),
		totals.trackedFired > 0 ? numberCell(totals.trackedHits / totals.trackedFired * 100, `${(totals.trackedHits / totals.trackedFired * 100).toFixed(1)}%`) : noValueCell(),
		numberCell(totals.xp, totals.xp.toLocaleString()),
	];
}

/**
 The rows of the equipment aggregate table: one per category present, ranked by hours (the order of the entries
 below), then a total row (which has no rank, and no hours, which overlap). The unnamed items are left out of both
 unless shouldIncludeUnnamed is set, so the rows add up to what the table of entries shows.
 */
export function buildEquipmentAggregateRows(weapons: any[], categories: string[], shouldIncludeUnnamed = true): AggregateRow[] {
	const totals = totalEquipmentByCategory(weapons, categories);
	if (!shouldIncludeUnnamed) {
		totals.delete(UNNAMED_CATEGORY);
	}

	const known = Object.keys(EQUIPMENT_CATEGORIES).filter(category => totals.has(category));
	const unknown = totals.keys().filter(category => !known.includes(category)).toArray();

	// Array#sort is stable, so categories with equal hours keep the order of the filter buttons
	const ranked = [...known, ...unknown].sort((a, b) => totals.get(b)!.equipTime - totals.get(a)!.equipTime);
	const rows = ranked.map((category, index) => equipmentRow(index + 1, EQUIPMENT_CATEGORIES[category]?.tooltip ?? category, totals.get(category)!, true));

	const overall = emptyEquipmentTotals();
	for (const [index, weapon] of weapons.entries()) {
		if (shouldIncludeUnnamed || categories[index] !== UNNAMED_CATEGORY) {
			addEquipment(overall, weapon);
		}
	}

	rows.push(equipmentRow(undefined, 'Total', overall, false));
	return rows;
}

/**
 Totals the enemy stats by category (the faction labels used by the filter buttons). The categories array holds the
 category of each enemy, in order; scans are added up from the scan stats for the same enemy types.
 */
export function totalEnemiesByCategory(enemies: any[], categories: string[], scans: any[] | undefined): Map<string, EnemyTotals> {
	const scansByType = new Map<string, number>();
	for (const scan of scans ?? []) {
		scansByType.set(scan.type, toNumber(scan.scans));
	}

	const totals = new Map<string, EnemyTotals>();
	for (const [index, enemy] of enemies.entries()) {
		const category = categories[index] || OTHER_FACTION_LABEL;
		if (!totals.has(category)) {
			totals.set(category, {
				kills: 0, assists: 0, headshots: 0, finishers: 0, deaths: 0, scans: 0,
			});
		}

		const entry = totals.get(category)!;
		entry.kills += toNumber(enemy.kills);
		entry.assists += toNumber(enemy.assists);
		entry.headshots += toNumber(enemy.headshots);
		entry.finishers += toNumber(enemy.executions);
		entry.deaths += toNumber(enemy.deaths);
		entry.scans += scansByType.get(enemy.type) ?? 0;
	}

	return totals;
}

function enemyRow(rank: number | undefined, label: string, totals: EnemyTotals): AggregateRow {
	return [
		rankCell(rank),
		{text: label},
		...([totals.kills, totals.assists, totals.headshots, totals.finishers, totals.deaths, totals.scans] as const).map(value => numberCell(value, value.toLocaleString())),
	];
}

/**
 The rows of the enemy aggregate table: one per faction present (including Other, for enemies of no listed faction,
 and the unnamed ones, if shouldIncludeUnnamed is set), ranked by kills (the order of the entries below), then a total
 row.
 */
export function buildEnemyAggregateRows(enemies: any[], categories: string[], scans: any[] | undefined, shouldIncludeUnnamed = true): AggregateRow[] {
	const totals = totalEnemiesByCategory(enemies, categories, scans);
	if (!shouldIncludeUnnamed) {
		totals.delete(UNNAMED_CATEGORY);
	}

	const order = [...ENEMY_FACTIONS.map(faction => faction.tooltip), OTHER_FACTION_LABEL];
	const known = order.filter(category => totals.has(category));
	const unknown = totals.keys().filter(category => !known.includes(category)).toArray();

	// Array#sort is stable, so factions with equal kills keep the order of the filter buttons
	const ranked = [...known, ...unknown].sort((a, b) => totals.get(b)!.kills - totals.get(a)!.kills);
	const rows = ranked.map((category, index) => enemyRow(index + 1, category, totals.get(category)!));

	const overall = {
		kills: 0, assists: 0, headshots: 0, finishers: 0, deaths: 0, scans: 0,
	};
	for (const entry of totals.values()) {
		for (const key of Object.keys(overall) as Array<keyof typeof overall>) {
			overall[key] += entry[key];
		}
	}

	rows.push(enemyRow(undefined, 'Total', overall));
	return rows;
}

function createRow(cells: AggregateRow): HTMLTableRowElement {
	const row = document.createElement('tr');
	for (const cell of cells) {
		const element = document.createElement('td');
		element.textContent = cell.text ?? NO_VALUE_TEXT;
		if (cell.text === undefined) {
			element.classList.add('text-body-secondary');
		}

		if (cell.sortValue !== undefined) {
			element.dataset.sort = String(cell.sortValue);
		}

		row.append(element);
	}

	return row;
}

const rankObservers = new Map<string, MutationObserver>();

/**
 Fills the rows of an aggregate table in profile.php: the group rows in its body, ranked from 1 (and renumbered
 when the table is sorted, as the entry tables are), and the total row in its footer. Hides the whole block when
 there is nothing to total.
 */
function renderAggregates(prefix: string, rows: AggregateRow[]): void {
	const container = document.querySelector<HTMLElement>(`#${prefix}-aggregates`);
	const tbody = document.querySelector<HTMLElement>(`#${prefix}-aggregate-rows`);
	const tfoot = document.querySelector<HTMLElement>(`#${prefix}-aggregate-total`);
	if (!container || !tbody || !tfoot) {
		return;
	}

	const hasRows = rows.length > 1;
	container.classList.toggle('d-none', !hasRows);
	tbody.replaceChildren(...(hasRows ? rows.slice(0, -1).map(row => createRow(row)) : []));
	tfoot.replaceChildren(...(hasRows ? [createRow(rows.at(-1)!)] : []));
	if (!hasRows) {
		return;
	}

	const {renumber, observer} = makeRenumber(tbody, rankObservers.get(prefix));
	rankObservers.set(prefix, observer);
	renumber();
}

export function renderEquipmentAggregates(weapons: any[], categories: string[], shouldIncludeUnnamed = true): void {
	renderAggregates('equipment', buildEquipmentAggregateRows(weapons, categories, shouldIncludeUnnamed));
}

export function renderEnemyAggregates(enemies: any[], categories: string[], scans: any[] | undefined, shouldIncludeUnnamed = true): void {
	renderAggregates('enemy', buildEnemyAggregateRows(enemies, categories, scans, shouldIncludeUnnamed));
}
