/**
 * Augments the upstream equipment stats table with rank column, category
 * filter bar, Used% column, and Archwing icon handling.
 *
 * Called via (window as any).augmentEquipmentStats() immediately after the
 * upstream rendering block in profile.ts populates #equipment-stats.
 */

import {logger} from '../logger.js';
import {fetchExport} from '../public-export-fetcher.js';
import {addTooltip} from '../tooltip.js';
import {EQUIPMENT_CATEGORIES, initStatsFilterBar, makeRenumber} from './stats-filters.js';

const ARCHWING_PREFIX = '<ARCHWING> ';
const ARCHWING_ICON = '/Lotus/Interface/Icons/StoreIcons/Gear/GenericArchwingSystems.png';

let equipmentRankObserver: MutationObserver | undefined;

function computeCategoryTotals(weapons: any[], exportWarframes: Record<string, any>, exportWeapons: Record<string, any>, exportSentinels: Record<string, any>): Record<string, number> {
	const totals: Record<string, number> = {};
	for (const item of weapons) {
		const type = exportWarframes[item.type] ?? exportWeapons[item.type] ?? exportSentinels[item.type];
		if (!type) {
			continue;
		}

		const category = type.productCategory ?? 'SpecialItems';
		if (category !== 'SpecialItems') {
			totals[category] = (totals[category] ?? 0) + (Number(item.equipTime) || 0);
		}
	}

	return totals;
}

function augmentArchwingName(nameCell: HTMLTableCellElement): void {
	const name = nameCell.innerHTML;
	if (!name.startsWith(ARCHWING_PREFIX)) {
		return;
	}

	nameCell.innerHTML = '';
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
	const [ExportWarframes, ExportWeapons, ExportSentinels] = await Promise.all([
		fetchExport('ExportWarframes'),
		fetchExport('ExportWeapons'),
		fetchExport('ExportSentinels'),
	]);

	const equipmentFilterBar = document.querySelector<HTMLElement>('#equipment-filter-bar')!;
	const equipmentTbody = document.querySelector<HTMLElement>('#equipment-stats')!;

	const rows = equipmentTbody.querySelectorAll<HTMLTableRowElement>('tr');
	if (rows.length === 0) {
		logger.warn('augmentEquipmentStats: #equipment-stats is empty');
		return;
	}

	const weapons: any[] = (profile?.Stats?.Weapons ?? []) as any[];
	const categoryTotals = computeCategoryTotals(weapons, ExportWarframes, ExportWeapons, ExportSentinels);
	const presentCategories = new Set<string>();

	let rowIndex = 0;
	for (const item of weapons) {
		const type = ExportWarframes[item.type] ?? ExportWeapons[item.type] ?? ExportSentinels[item.type];
		if (!type) {
			continue;
		}

		const tr = rows[rowIndex++];
		const category = type.productCategory ?? 'SpecialItems';
		tr.dataset.category = category;
		presentCategories.add(category);

		// Capture cell references before mutating the row
		const nameCell = tr.cells[0];
		const hoursCell = tr.cells[1];

		// Prepend rank cell
		const rankCell = document.createElement('td');
		tr.insertBefore(rankCell, tr.firstChild);

		augmentArchwingName(nameCell);

		// Insert Used% cell before hours cell, then reformat hours
		const equipTime = item.equipTime ?? 0;
		const total = categoryTotals[category] ?? 0;
		const usedCell = document.createElement('td');
		usedCell.textContent = `${(total ? equipTime / total * 100 : 0).toFixed(2)}%`;
		hoursCell.before(usedCell);

		// Reformat hours cell (now index 3) to locale string
		hoursCell.textContent = (equipTime / 3600).toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1});
	}

	const equipmentEntries = Object.entries(EQUIPMENT_CATEGORIES).map(([key, {tooltip, icon, displayText}]) => ({
		key, tooltip, icon, displayText,
	}));
	const {renumber, observer} = makeRenumber(equipmentTbody, equipmentRankObserver);
	equipmentRankObserver = observer;
	initStatsFilterBar(equipmentFilterBar, equipmentTbody, equipmentEntries, presentCategories, renumber);
	renumber();
}

window.augmentEquipmentStats = augmentEquipmentStats;
