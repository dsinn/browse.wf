// Invasion helper functions for calculating progress, sorting, and creating UI elements

interface InvasionData {
	_id: { $oid: string };
	Node: string;
	Count: number;
	Goal: number;
	Faction: string;
	DefenderFaction: string;
	Completed: boolean;
	Activation: { $date: { $numberLong: string } };
	AttackerReward: { countedItems: { ItemType: string; ItemCount: number }[] } | [];
	DefenderReward: { countedItems: { ItemType: string; ItemCount: number }[] } | [];
}

function calculatePercentage(wsInvasion: InvasionData): number
{
	let progress: number = 1 - Math.abs(wsInvasion.Count / wsInvasion.Goal);
	progress = Math.max(0, progress);
	progress = Math.min(1, progress);
	return progress * 100;
}

function createInvasionProgressBar(wsInvasion: InvasionData, percentage: number): HTMLDivElement
{
	const [attackerFactionClass, defenderFactionClass] = [
		wsInvasion.Faction,
		wsInvasion.DefenderFaction
	].map(factionKey => factionKey.toLowerCase().replace("fc_", "invasion-"));

	const container = document.createElement("div");
	container.className = `invasion-progress-container ${defenderFactionClass}`;

	const bar = document.createElement("div");
	bar.className = `invasion-progress-bar ${attackerFactionClass}`;

	let barPercentage = wsInvasion.Faction === "FC_INFESTATION"
		? percentage
		: 100 * (wsInvasion.Count + wsInvasion.Goal) / (2 * wsInvasion.Goal);
	bar.style.width = `${barPercentage}%`;
	container.appendChild(bar);

	return container;
}

function sortInvasions(invasions: InvasionData[]): InvasionData[]
{
	return [...invasions].sort((a, b) => calculatePercentage(a) - calculatePercentage(b));
}

// Derive the invasion reward filter key from an ItemType path.
// The key is the last path segment, with the part-name suffix stripped for weapons
// (so all parts and blueprints of the same weapon map to the same checkbox).
// The derived key matches the data-filter-type attribute on the filter checkboxes.
function invasionRewardFilterKey(itemType: string): string
{
	const segment = itemType.replace(/^.+\//, '');
	const isWeapon = /\/(?:Weapons|WeaponParts)\/[^\/]+$/.test(itemType);
	// Weapons: strip trailing part-name word (Barrel, Receiver, Blueprint, etc.) so all
	// parts and blueprints of the same weapon share one key. SortieBlueprint is two words
	// so strip it explicitly first.
	// Non-weapons: strip Blueprint suffix only.
	return isWeapon
		? segment.replace(/SortieBlueprint$|[A-Z][a-z]+$/, '')
		: segment.replace(/Blueprint$/, '');
}

function isInvasionRewardShown(itemType: string): boolean
{
	return (window as any).isFilterEnabled("invasions", `reward-${invasionRewardFilterKey(itemType)}`);
}

async function updateInvasions(): Promise<void>
{
	if (!window.worldState?.Invasions) return;

	// Await data dependencies in case this is called before they resolve
	if ((window as any).dicts_promise) await (window as any).dicts_promise;
	if ((window as any).ExportRegions_promise) await (window as any).ExportRegions_promise;

	const ExportRegions = (window as any).ExportRegions;
	const dict = (window as any).dict;
	if (!ExportRegions || !dict) return;

	// Build duplicate-detection map: node → earliest activation time
	const nodeFirstActivation = new Map<string, number>();
	for (const inv of window.worldState.Invasions) {
		if (inv.Completed) continue;
		const t = parseInt(inv.Activation.$date.$numberLong);
		const cur = nodeFirstActivation.get(inv.Node);
		if (cur === undefined || t < cur) nodeFirstActivation.set(inv.Node, t);
	}

	const sorted = sortInvasions(window.worldState.Invasions.filter((inv: InvasionData) => !inv.Completed));

	const tbody = document.createElement("tbody");
	let anyVisible = false;

	for (const invasion of sorted) {
		const percentage = calculatePercentage(invasion);
		const isDuplicate = parseInt(invasion.Activation.$date.$numberLong) > nodeFirstActivation.get(invasion.Node)!;

		const attackerItems = Array.isArray(invasion.AttackerReward)
			? invasion.AttackerReward
			: (invasion.AttackerReward as { countedItems: { ItemType: string; ItemCount: number }[] }).countedItems ?? [];
		const defenderItems = Array.isArray(invasion.DefenderReward)
			? invasion.DefenderReward
			: (invasion.DefenderReward as { countedItems: { ItemType: string; ItemCount: number }[] }).countedItems ?? [];

		const attackerItem = attackerItems[0];
		const defenderItem = defenderItems[0];

		const attackerVisible = attackerItem ? isInvasionRewardShown(attackerItem.ItemType) : false;
		const defenderVisible = defenderItem ? isInvasionRewardShown(defenderItem.ItemType) : false;

		// Both hidden → skip both rows
		if (!attackerVisible && !defenderVisible) {
			// Still render hidden rows so [data-oid] elements stay in DOM for pruneStaleOids
			const hiddenRow = document.createElement("tr");
			hiddenRow.classList.add("d-none");
			const td = document.createElement("td");
			if (!isDuplicate) {
				td.appendChild((window as any).createCompletionToggle(invasion._id.$oid));
			}
			hiddenRow.appendChild(td);
			tbody.appendChild(hiddenRow);
			continue;
		}

		anyVisible = true;

		const node = ExportRegions[invasion.Node];
		const nodeLabel = dict[node.name] + ", " + dict[node.systemName];

		// Row 1: attacker row (or promoted defender row)
		const isAttackerPromoted = !attackerVisible && defenderVisible;
		const row1Item = isAttackerPromoted ? defenderItem : attackerItem;
		const row1Visible = isAttackerPromoted ? defenderVisible : attackerVisible;

		if (row1Visible && row1Item) {
			const tr = document.createElement("tr");
			if (isDuplicate) tr.classList.add("opacity-50");

			// th: node name + special mission icon + progress bar
			{
				const th = document.createElement("th");
				th.textContent = nodeLabel;
				if (node.missionType === "MT_ASSASSINATION") {
					const img = document.createElement("img");
					img.className = "invasion-boss-icon ms-1";
					(window as any).setImageSource(img, "/Lotus/Interface/Icons/Sigils/Phorid.png");
					(window as any).addTooltip(img, "Assassination (Phorid)");
					th.appendChild(img);
				} else if (invasion.Node === "SolNode65") {
					const span = document.createElement("span");
					span.textContent = " 💥";
					(window as any).addTooltip(span, "Sabotage");
					th.appendChild(span);
				}
				th.appendChild(createInvasionProgressBar(invasion, percentage));
				tr.appendChild(th);
			}

			// td: percentage
			{
				const td = document.createElement("td");
				td.className = "text-end";
				const span = document.createElement("span");
				span.className = "invasion-percentage";
				span.textContent = `${percentage.toFixed(1)}%`;
				td.appendChild(span);
				tr.appendChild(td);
			}

			// td: reward
			{
				const td = document.createElement("td");
				td.textContent = row1Item.ItemCount + "x " + await (window as any).getItemNamePromise(row1Item.ItemType);
				tr.appendChild(td);
			}

			// td: completion toggle
			{
				const td = document.createElement("td");
				if (isDuplicate) {
					const span = document.createElement("span");
					span.textContent = "⏳";
					(window as any).addTooltip(span, `Will unlock after the first ${nodeLabel} invasion is completed.`);
					td.appendChild(span);
				} else {
					td.appendChild((window as any).createCompletionToggle(invasion._id.$oid));
				}
				tr.appendChild(td);
			}

			tbody.appendChild(tr);
		} else if (!row1Visible && row1Item) {
			// Hidden attacker row (still add for DOM completeness with completion toggle)
			const tr = document.createElement("tr");
			tr.classList.add("d-none");
			const td = document.createElement("td");
			tr.appendChild(td);
			tbody.appendChild(tr);
		}

		// Row 2: defender row (only if attacker was also visible)
		if (attackerVisible && defenderVisible && defenderItem) {
			const tr = document.createElement("tr");
			tr.classList.add("invasion-defender-reward");
			if (isDuplicate) tr.classList.add("opacity-50");

			// th: empty
			tr.appendChild(document.createElement("th"));

			// td: empty percentage cell
			tr.appendChild(document.createElement("td"));

			// td: defender reward
			{
				const td = document.createElement("td");
				td.textContent = defenderItem.ItemCount + "x " + await (window as any).getItemNamePromise(defenderItem.ItemType);
				tr.appendChild(td);
			}

			// td: empty toggle
			tr.appendChild(document.createElement("td"));

			tbody.appendChild(tr);
		}
	}

	if (!anyVisible) {
		const tr = document.createElement("tr");
		const td = document.createElement("td");
		td.textContent = "No invasions match the current filters.";
		tr.appendChild(td);
		tbody.appendChild(tr);
	}

	document.getElementById("invasions-table").querySelectorAll("[data-bs-toggle=tooltip]").forEach((x: any) => window.bootstrap.Tooltip.getInstance(x).dispose());
	document.getElementById("invasions-table").innerHTML = "";
	document.getElementById("invasions-table").appendChild(tbody);
}

// Expose functions globally for non-module scripts
(window as any).calculatePercentage = calculatePercentage;
(window as any).createInvasionProgressBar = createInvasionProgressBar;
(window as any).isInvasionRewardShown = isInvasionRewardShown;
(window as any).updateInvasions = updateInvasions;
