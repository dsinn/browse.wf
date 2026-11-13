/**
 Augments the upstream equipment stats table with rank column, category
 filter bar, Used% column, Fired and Hit% columns, and Archwing icon handling.
 Items without an entry in the export data are shown by internal name under
 the "Unnamed" category.

 Called via (window as any).augmentEquipmentStats() immediately after the
 upstream rendering block in profile.ts populates #equipment-stats.
 */

import {logger} from '../logger.js';
import {fetchExport} from '../public-export-fetcher.js';
import {addTooltip} from '../tooltip.js';
import {renderEquipmentAggregates} from './aggregate-stats.js';
import {enableInternalNameTooltips, renderInternalName} from './internal-name.js';
import {NO_VALUE_SORT, NO_VALUE_TEXT} from './no-value.js';
import {
	appendUnnamedToggle,
	EQUIPMENT_CATEGORIES,
	initStatsFilterBar,
	makeRenumber,
	UNNAMED_CATEGORY,
} from './stats-filters.js';

// Cells in the Used, Fired and Hit% columns that have no value show a placeholder that sorts last
function createNoValueCell(): HTMLTableCellElement {
	const cell = document.createElement('td');
	cell.textContent = NO_VALUE_TEXT;
	cell.className = 'text-body-secondary';
	cell.dataset.sort = String(NO_VALUE_SORT);
	return cell;
}

function setCellValue(cell: HTMLTableCellElement, text: string, sortValue: number): void {
	cell.textContent = text;
	cell.classList.remove('text-body-secondary');
	cell.dataset.sort = String(sortValue);
}

const ARCHWING_PREFIX = '<ARCHWING> ';
const ARCHWING_ICON = '/Lotus/Interface/Icons/StoreIcons/Gear/GenericArchwingSystems.png';

// Sentinels, Kubrow/Kavat companions, and MOA companions all occupy the same
// equipment slot in-game, so they share one Used% denominator even though
// they remain separate categories for filtering/display purposes.
const SHARED_DENOMINATOR_KEY = 'Sentinels+Companions';
const SHARED_DENOMINATOR_CATEGORIES = new Set(['Sentinels', 'KubrowPets', 'MoaPets']);

function denominatorKeyFor(category: string): string {
	return SHARED_DENOMINATOR_CATEGORIES.has(category) ? SHARED_DENOMINATOR_KEY : category;
}

let equipmentRankObserver: MutationObserver | undefined;

function computeCategoryTotals(weapons: any[], exportWarframes: Record<string, any>, exportWeapons: Record<string, any>, exportSentinels: Record<string, any>): Record<string, number> {
	const totals: Record<string, number> = {};
	for (const item of weapons) {
		const type = exportWarframes[item.type] ?? exportWeapons[item.type] ?? exportSentinels[item.type];
		if (!type) {
			continue;
		}

		const category = type.productCategory ?? 'SpecialItems';
		if (category === 'SpecialItems') {
			continue;
		}

		const key = denominatorKeyFor(category);
		totals[key] = (totals[key] ?? 0) + (Number(item.equipTime) || 0);
	}

	return totals;
}

function augmentArchwingName(nameCell: HTMLTableCellElement): void {
	const name = nameCell.getHTML();
	if (!name.startsWith(ARCHWING_PREFIX)) {
		return;
	}

	nameCell.replaceChildren();
	const wrap = document.createElement('div');
	wrap.className = 'item-name-wrap';
	const img = document.createElement('img');
	img.className = 'item-name-icon';
	window.setImageSource(img, ARCHWING_ICON);
	const iconWrap = document.createElement('span');
	iconWrap.className = 'item-name-icon-wrap';
	addTooltip(iconWrap, 'Archwing');
	iconWrap.append(img);
	wrap.append(iconWrap);
	wrap.append(document.createTextNode(name.slice(ARCHWING_PREFIX.length)));
	nameCell.append(wrap);
}

export async function augmentEquipmentStats(profile: any): Promise<void> {
	// Disconnect early so queued MutationObserver callbacks from the previous
	// render can't fire after the await and clobber the new rows' name cells.
	equipmentRankObserver?.disconnect();
	equipmentRankObserver = undefined;
	renderEquipmentAggregates([], []);

	const unnamedToggle = document.querySelector<HTMLElement>('#equipment-unnamed-toggle')!;
	unnamedToggle.replaceChildren();
	const equipmentFilterBar = document.querySelector<HTMLElement>('#equipment-filter-bar')!;
	const equipmentTbody = document.querySelector<HTMLElement>('#equipment-stats')!;

	const rows = equipmentTbody.querySelectorAll<HTMLTableRowElement>('tr');
	if (rows.length === 0) {
		logger.warn('augmentEquipmentStats: #equipment-stats is empty');
		return;
	}

	const [ExportWarframes, ExportWeapons, ExportSentinels] = await Promise.all([
		fetchExport('ExportWarframes'),
		fetchExport('ExportWeapons'),
		fetchExport('ExportSentinels'),
	]);

	const weapons: any[] = (profile?.Stats?.Weapons ?? []) as any[];
	if (rows.length !== weapons.length) {
		// E.g. a cached profile.js that still skips items without an export entry; the rows can't be matched up
		logger.warn(`augmentEquipmentStats: ${rows.length} rows for ${weapons.length} items`);
		return;
	}

	const categoryTotals = computeCategoryTotals(weapons, ExportWarframes, ExportWeapons, ExportSentinels);
	const presentCategories = new Set<string>();
	const categories: string[] = [];

	for (const [rowIndex, item] of weapons.entries()) {
		const type = ExportWarframes[item.type] ?? ExportWeapons[item.type] ?? ExportSentinels[item.type];
		const tr = rows[rowIndex];
		const category = type ? (type.productCategory ?? 'SpecialItems') : UNNAMED_CATEGORY;
		tr.dataset.category = category;
		presentCategories.add(category);
		categories.push(category);

		// Capture cell references before mutating the row
		const nameCell = tr.cells[0];
		const hoursCell = tr.cells[1];
		const affinityCell = tr.cells[5];

		// Prepend rank cell
		const rankCell = document.createElement('td');
		tr.insertBefore(rankCell, tr.firstChild);

		if (type) {
			augmentArchwingName(nameCell);
		} else {
			renderInternalName(nameCell, item.type);
		}

		// Insert Used% cell before hours cell, then reformat hours
		const equipTime = item.equipTime ?? 0;
		const total = categoryTotals[denominatorKeyFor(category)] ?? 0;
		const usedCell = createNoValueCell();
		if (type) {
			const usedPercent = total ? equipTime / total * 100 : 0;
			setCellValue(usedCell, `${usedPercent.toFixed(2)}%`, usedPercent);
		}

		hoursCell.before(usedCell);

		// Insert Fired and Hit% cells before the affinity cell. Hit% is blank unless both counters were recorded,
		// since a weapon with shots fired but no hits key usually just doesn't track hits.
		const fired = Number(item.fired) || 0;
		const firedCell = createNoValueCell();
		const hitRateCell = createNoValueCell();
		if (fired > 0) {
			setCellValue(firedCell, fired.toLocaleString(), fired);
		}

		if (fired > 0 && typeof item.hits === 'number') {
			const hitPercent = item.hits / fired * 100;
			setCellValue(hitRateCell, `${hitPercent.toFixed(1)}%`, hitPercent);
			hitRateCell.title = `${item.hits.toLocaleString()} hits / ${fired.toLocaleString()} fired`;
		}

		affinityCell.before(firedCell, hitRateCell);

		// Reformat hours cell (now index 3) to locale string
		hoursCell.textContent = (equipTime / 3600).toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1});
	}

	const equipmentEntries = Object.entries(EQUIPMENT_CATEGORIES).map(([key, {tooltip, icon, displayText}]) => ({
		key, tooltip, icon, displayText,
	}));
	const {renumber, observer} = makeRenumber(equipmentTbody, equipmentRankObserver);
	equipmentRankObserver = observer;
	renderEquipmentAggregates(weapons, categories, false);
	initStatsFilterBar(equipmentFilterBar, equipmentTbody, equipmentEntries, presentCategories, renumber);
	if (presentCategories.has(UNNAMED_CATEGORY)) {
		appendUnnamedToggle(unnamedToggle, equipmentTbody, 'Show unnamed items', () => {
			renumber();
			renderEquipmentAggregates(weapons, categories, equipmentTbody.dataset.showUnnamed === 'true');
		});
		enableInternalNameTooltips(equipmentTbody);
	}

	renumber();
}

window.augmentEquipmentStats = augmentEquipmentStats;
