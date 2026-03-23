// Invasion helper functions for calculating progress, sorting, and creating UI elements

import {isFilterEnabled} from '../card-filters.js';
import {addTooltip} from '../tooltip.js';

type InvasionData = {
	_id: {$oid: string};
	Node: string;
	Count: number;
	Goal: number;
	Faction: string;
	DefenderFaction: string;
	Completed: boolean;
	Activation: {$date: {$numberLong: string}};
	AttackerReward: {countedItems: Array<{ItemType: string; ItemCount: number}>} | never[];
	DefenderReward: {countedItems: Array<{ItemType: string; ItemCount: number}>} | never[];
};

export function calculatePercentage(wsInvasion: InvasionData): number {
	let progress: number = 1 - Math.abs(wsInvasion.Count / wsInvasion.Goal);
	progress = Math.max(0, progress);
	progress = Math.min(1, progress);
	return progress * 100;
}

export function createInvasionProgressBar(wsInvasion: InvasionData, percentage: number): HTMLDivElement {
	const [attackerFactionClass, defenderFactionClass] = [
		wsInvasion.Faction,
		wsInvasion.DefenderFaction,
	].map(factionKey => factionKey.toLowerCase().replace('fc_', 'invasion-'));

	const container = document.createElement('div');
	container.className = `invasion-progress-container ${defenderFactionClass}`;

	const bar = document.createElement('div');
	bar.className = `invasion-progress-bar ${attackerFactionClass}`;

	const barPercentage = wsInvasion.Faction === 'FC_INFESTATION'
		? percentage
		: 100 * (wsInvasion.Count + wsInvasion.Goal) / (2 * wsInvasion.Goal);
	bar.style.width = `${barPercentage}%`;
	container.append(bar);

	return container;
}

function getDuplicateInvasionOids(invasions: InvasionData[]): Set<string> {
	const nodeFirstOid = new Map<string, {oid: string; t: number}>();
	const duplicates = new Set<string>();
	for (const inv of invasions) {
		const t = Number.parseInt(inv.Activation.$date.$numberLong, 10);
		const cur = nodeFirstOid.get(inv.Node);
		if (cur === undefined || t < cur.t) {
			if (cur !== undefined) {
				duplicates.add(cur.oid);
			}

			nodeFirstOid.set(inv.Node, {oid: inv._id.$oid, t});
		} else {
			duplicates.add(inv._id.$oid);
		}
	}

	return duplicates;
}

function sortInvasions(invasions: InvasionData[], duplicates: Set<string>, percentages: Map<string, number>): InvasionData[] {
	return invasions.sort((a, b) => {
		const aIsDuplicate = duplicates.has(a._id.$oid);
		const bIsDuplicate = duplicates.has(b._id.$oid);
		if (aIsDuplicate !== bIsDuplicate) {
			return aIsDuplicate ? 1 : -1;
		}

		return (percentages.get(a._id.$oid) ?? 0) - (percentages.get(b._id.$oid) ?? 0);
	});
}

// Derive the invasion reward filter key from an ItemType path.
// The key is the last path segment, with the part-name suffix stripped for weapons
// (so all parts and blueprints of the same weapon map to the same checkbox).
// The derived key matches the data-filter-type attribute on the filter checkboxes.
function invasionRewardFilterKey(itemType: string): string {
	const segment = itemType.replace(/^.+\//u, '');
	const isWeapon = /\/(?:Weapons|WeaponParts)\/[^/]+$/u.test(itemType);
	// Weapons: strip trailing part-name word (Barrel, Receiver, Blueprint, etc.) so all
	// parts and blueprints of the same weapon share one key. SortieBlueprint is two words
	// so strip it explicitly first.
	// Non-weapons: strip Blueprint suffix only.
	return isWeapon
		? segment.replace(/SortieBlueprint$|[A-Z][a-z]+$/u, '')
		: segment.replace(/Blueprint$/u, '');
}

export function isInvasionRewardShown(itemType: string): boolean {
	return isFilterEnabled('invasions', `reward-${invasionRewardFilterKey(itemType)}`);
}

function buildPercentageCell(percentage: number, isDuplicate: boolean, nodeLabel: string): HTMLTableCellElement {
	const td = document.createElement('td');
	td.className = 'text-end';
	const span = document.createElement('span');
	if (isDuplicate) {
		span.textContent = '⏳';
		addTooltip(span, `Will unlock after the first ${nodeLabel} invasion is completed.`);
	} else {
		span.className = 'invasion-percentage';
		span.textContent = `${percentage.toFixed(1)}%`;
	}

	td.append(span);
	return td;
}

async function buildRewardCell(item: {ItemType: string; ItemCount: number}): Promise<HTMLTableCellElement> {
	const td = document.createElement('td');
	td.textContent = `${item.ItemCount > 1 ? `${String(item.ItemCount)}x ` : ''}${String(await (globalThis as any).getItemNamePromise(item.ItemType))}`;
	return td;
}

function buildToggleCell(invasion: InvasionData, isDuplicate: boolean): HTMLTableCellElement {
	const td = document.createElement('td');
	if (!isDuplicate) {
		td.append((globalThis as any).createCompletionToggle(invasion._id.$oid));
	}

	return td;
}

function buildInvasionHeading(invasion: InvasionData, node: any, nodeLabel: string, percentage: number): HTMLTableCellElement {
	const th = document.createElement('th');
	th.textContent = nodeLabel;
	if (node.missionType === 'MT_ASSASSINATION') {
		const img = document.createElement('img');
		img.className = 'invasion-boss-icon ms-1';
		(globalThis as any).setImageSource(img, '/Lotus/Interface/Icons/Sigils/Phorid.png');
		addTooltip(img, 'Assassination (Phorid)');
		th.append(img);
	} else if (invasion.Node === 'SolNode65') {
		const span = document.createElement('span');
		span.textContent = ' 💥';
		addTooltip(span, 'Sabotage');
		th.append(span);
	}

	th.append(createInvasionProgressBar(invasion, percentage));
	return th;
}

type InvasionRowContext = {
	invasion: InvasionData;
	percentage: number;
	isDuplicate: boolean;
	node: any;
	nodeLabel: string;
	attackerItem: {ItemType: string; ItemCount: number} | undefined;
	defenderItem: {ItemType: string; ItemCount: number} | undefined;
	attackerVisible: boolean;
	defenderVisible: boolean;
};

async function buildInvasionRows(ctx: InvasionRowContext): Promise<HTMLTableRowElement[]> {
	const {invasion, percentage, isDuplicate, node, nodeLabel, attackerItem, defenderItem, attackerVisible, defenderVisible} = ctx;
	const rows: HTMLTableRowElement[] = [];

	// Both hidden → render a hidden placeholder row for pruneStaleOids
	if (!attackerVisible && !defenderVisible) {
		const tr = document.createElement('tr');
		tr.classList.add('d-none');
		const td = document.createElement('td');
		if (!isDuplicate) {
			td.append((globalThis as any).createCompletionToggle(invasion._id.$oid));
		}

		tr.append(td);
		rows.push(tr);
		return rows;
	}

	// Row 1: attacker row (or promoted defender row)
	const isAttackerPromoted = !attackerVisible && defenderVisible;
	const row1Item = isAttackerPromoted ? defenderItem : attackerItem;
	const row1Visible = isAttackerPromoted ? defenderVisible : attackerVisible;

	if (row1Visible && row1Item) {
		const tr = document.createElement('tr');
		if (isDuplicate) {
			tr.classList.add('opacity-50');
		}

		// Th: node name + special mission icon + progress bar
		tr.append(buildInvasionHeading(invasion, node, nodeLabel, percentage));
		tr.append(buildPercentageCell(percentage, isDuplicate, nodeLabel));
		tr.append(await buildRewardCell(row1Item));
		tr.append(buildToggleCell(invasion, isDuplicate));

		rows.push(tr);
	} else if (!row1Visible && row1Item) {
		// Hidden attacker row (still add for DOM completeness with completion toggle)
		const tr = document.createElement('tr');
		tr.classList.add('d-none');
		tr.append(document.createElement('td'));

		rows.push(tr);
	}

	// Row 2: defender row (only if attacker was also visible)
	if (attackerVisible && defenderVisible && defenderItem) {
		const tr = document.createElement('tr');
		tr.classList.add('invasion-defender-reward');
		if (isDuplicate) {
			tr.classList.add('opacity-50');
		}

		tr.append(document.createElement('th'));
		tr.append(document.createElement('td'));
		tr.append(await buildRewardCell(defenderItem));
		tr.append(document.createElement('td'));

		rows.push(tr);
	}

	return rows;
}

export async function updateInvasions(): Promise<void> {
	if (!(globalThis as any).worldState?.Invasions) {
		return;
	}

	const [[dict], ExportRegions, exportImages] = await Promise.all([
		Promise.all([(globalThis as any).getDictPromise(), (globalThis as any).getOSDictPromise()]),
		(globalThis as any).fetchExport('ExportRegions'),
		(globalThis as any).fetchExport('ExportImages'),
	]);
	(globalThis as any).ExportImages = exportImages;

	const activeInvasions = ((globalThis as any).worldState as IWorldState).Invasions!.filter((inv: InvasionData) => !inv.Completed);
	const duplicates = getDuplicateInvasionOids(activeInvasions);
	const percentages = new Map<string, number>(activeInvasions.map((inv: InvasionData) => [inv._id.$oid, calculatePercentage(inv)]));
	const sorted = sortInvasions(activeInvasions, duplicates, percentages);

	const tbody = document.createElement('tbody');
	let anyVisible = false;

	for (const invasion of sorted) {
		const percentage = percentages.get(invasion._id.$oid);
		const isDuplicate = duplicates.has(invasion._id.$oid);

		const attackerItems = Array.isArray(invasion.AttackerReward)
			? invasion.AttackerReward
			: (invasion.AttackerReward as {countedItems: Array<{ItemType: string; ItemCount: number}>}).countedItems ?? [];
		const defenderItems = Array.isArray(invasion.DefenderReward)
			? invasion.DefenderReward
			: (invasion.DefenderReward as {countedItems: Array<{ItemType: string; ItemCount: number}>}).countedItems ?? [];

		const attackerItem = attackerItems[0];
		const defenderItem = defenderItems[0];
		const attackerVisible = attackerItem ? isInvasionRewardShown(attackerItem.ItemType) : false;
		const defenderVisible = defenderItem ? isInvasionRewardShown(defenderItem.ItemType) : false;

		if (attackerVisible || defenderVisible) {
			anyVisible = true;
		}

		const node = ExportRegions[invasion.Node];
		const nodeLabel = `${String(dict[node.name])}, ${String(dict[node.systemName])}`;

		// eslint-disable-next-line no-await-in-loop
		const rows = await buildInvasionRows({
			invasion, percentage: percentage ?? 0, isDuplicate, node, nodeLabel,
			attackerItem, defenderItem, attackerVisible, defenderVisible,
		});
		tbody.append(...rows);
	}

	if (!anyVisible) {
		const tr = document.createElement('tr');
		const td = document.createElement('td');
		td.textContent = 'No invasions match the current filters.';
		tr.append(td);
		tbody.append(tr);
	}

	const invasionsTable = document.querySelector('#invasions-table');
	if (invasionsTable) {
		for (const x of invasionsTable.querySelectorAll('[data-bs-toggle=tooltip]')) {
			(globalThis.bootstrap as any).Tooltip.getInstance(x).dispose();
		}

		invasionsTable.innerHTML = '';
		invasionsTable.append(tbody);
	}
}

// Expose functions globally for non-module scripts
(globalThis as any).calculatePercentage = calculatePercentage;
(globalThis as any).createInvasionProgressBar = createInvasionProgressBar;
(globalThis as any).isInvasionRewardShown = isInvasionRewardShown;
(globalThis as any).updateInvasions = updateInvasions;
