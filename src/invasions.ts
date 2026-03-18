// Invasion helper functions for calculating progress, sorting, and creating UI elements

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

function sortInvasions(invasions: InvasionData[]): InvasionData[] {
	// eslint-disable-next-line unicorn/no-array-sort -- .toSorted() is ES2023; this project targets ES2021
	return [...invasions].sort((a, b) => calculatePercentage(a) - calculatePercentage(b));
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
	return (globalThis as any).isFilterEnabled('invasions', `reward-${invasionRewardFilterKey(itemType)}`);
}

export async function updateInvasions(): Promise<void> {
	if (!globalThis.worldState?.Invasions) {
		return;
	}

	// Await data dependencies in case this is called before they resolve
	if ((globalThis as any).dicts_promise) {
		await (globalThis as any).dicts_promise;
	}

	if ((globalThis as any).ExportRegions_promise) {
		await (globalThis as any).ExportRegions_promise;
	}

	const {ExportRegions} = (globalThis as any);
	const {dict} = (globalThis as any);
	if (!ExportRegions || !dict) {
		return;
	}

	// Build duplicate-detection map: node → earliest activation time
	const nodeFirstActivation = new Map<string, number>();
	for (const inv of globalThis.worldState.Invasions) {
		if (inv.Completed) {
			continue;
		}

		const t = Number.parseInt(inv.Activation.$date.$numberLong, 10);
		const cur = nodeFirstActivation.get(inv.Node);
		if (cur === undefined || t < cur) {
			nodeFirstActivation.set(inv.Node, t);
		}
	}

	const sorted = sortInvasions(globalThis.worldState.Invasions.filter((inv: InvasionData) => !inv.Completed));

	const tbody = document.createElement('tbody');
	let anyVisible = false;

	for (const invasion of sorted) {
		const percentage = calculatePercentage(invasion);
		const isDuplicate = Number.parseInt(invasion.Activation.$date.$numberLong, 10) > nodeFirstActivation.get(invasion.Node);

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

		// Both hidden → skip both rows
		if (!attackerVisible && !defenderVisible) {
			// Still render hidden rows so [data-oid] elements stay in DOM for pruneStaleOids
			const hiddenRow = document.createElement('tr');
			hiddenRow.classList.add('d-none');
			const td = document.createElement('td');
			if (!isDuplicate) {
				td.append((globalThis as any).createCompletionToggle(invasion._id.$oid));
			}

			hiddenRow.append(td);
			tbody.append(hiddenRow);
			continue;
		}

		anyVisible = true;

		const node = ExportRegions[invasion.Node];
		const nodeLabel = `${String(dict[node.name])}, ${String(dict[node.systemName])}`;

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
			{
				const th = document.createElement('th');
				th.textContent = nodeLabel;
				if (node.missionType === 'MT_ASSASSINATION') {
					const img = document.createElement('img');
					img.className = 'invasion-boss-icon ms-1';
					(globalThis as any).setImageSource(img, '/Lotus/Interface/Icons/Sigils/Phorid.png');
					(globalThis as any).addTooltip(img, 'Assassination (Phorid)');
					th.append(img);
				} else if (invasion.Node === 'SolNode65') {
					const span = document.createElement('span');
					span.textContent = ' 💥';
					(globalThis as any).addTooltip(span, 'Sabotage');
					th.append(span);
				}

				th.append(createInvasionProgressBar(invasion, percentage));
				tr.append(th);
			}

			// Td: percentage
			{
				const td = document.createElement('td');
				td.className = 'text-end';
				const span = document.createElement('span');
				span.className = 'invasion-percentage';
				span.textContent = `${percentage.toFixed(1)}%`;
				td.append(span);
				tr.append(td);
			}

			// Td: reward
			{
				const td = document.createElement('td');
				// eslint-disable-next-line no-await-in-loop
				td.textContent = `${row1Item.ItemCount > 1 ? `${String(row1Item.ItemCount)}x ` : ''}${String(await (globalThis as any).getItemNamePromise(row1Item.ItemType))}`;
				tr.append(td);
			}

			// Td: completion toggle
			{
				const td = document.createElement('td');
				if (isDuplicate) {
					const span = document.createElement('span');
					span.textContent = '⏳';
					(globalThis as any).addTooltip(span, `Will unlock after the first ${nodeLabel} invasion is completed.`);
					td.append(span);
				} else {
					td.append((globalThis as any).createCompletionToggle(invasion._id.$oid));
				}

				tr.append(td);
			}

			tbody.append(tr);
		} else if (!row1Visible && row1Item) {
			// Hidden attacker row (still add for DOM completeness with completion toggle)
			const tr = document.createElement('tr');
			tr.classList.add('d-none');
			const td = document.createElement('td');
			tr.append(td);
			tbody.append(tr);
		}

		// Row 2: defender row (only if attacker was also visible)
		if (attackerVisible && defenderVisible && defenderItem) {
			const tr = document.createElement('tr');
			tr.classList.add('invasion-defender-reward');
			if (isDuplicate) {
				tr.classList.add('opacity-50');
			}

			// Th: empty
			tr.append(document.createElement('th'));

			// Td: empty percentage cell
			tr.append(document.createElement('td'));

			// Td: defender reward
			{
				const td = document.createElement('td');
				// eslint-disable-next-line no-await-in-loop
				td.textContent = `${defenderItem.ItemCount > 1 ? `${String(defenderItem.ItemCount)}x ` : ''}${String(await (globalThis as any).getItemNamePromise(defenderItem.ItemType))}`;
				tr.append(td);
			}

			// Td: empty toggle
			tr.append(document.createElement('td'));

			tbody.append(tr);
		}
	}

	if (!anyVisible) {
		const tr = document.createElement('tr');
		const td = document.createElement('td');
		td.textContent = 'No invasions match the current filters.';
		tr.append(td);
		tbody.append(tr);
	}

	for (const x of document.querySelector('#invasions-table').querySelectorAll('[data-bs-toggle=tooltip]')) {
		(globalThis.bootstrap as any).Tooltip.getInstance(x).dispose();
	}

	document.querySelector('#invasions-table').innerHTML = '';
	document.querySelector('#invasions-table').append(tbody);
}

// Expose functions globally for non-module scripts
(globalThis as any).calculatePercentage = calculatePercentage;
(globalThis as any).createInvasionProgressBar = createInvasionProgressBar;
(globalThis as any).isInvasionRewardShown = isInvasionRewardShown;
(globalThis as any).updateInvasions = updateInvasions;
