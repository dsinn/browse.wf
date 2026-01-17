// Invasion helper functions for calculating progress, sorting, and creating UI elements

interface InvasionExtraData {
	hasInfested: boolean;
	isDuplicate: boolean; // @TODO Use this for sorting and styles later
	percentage: number;
	worldStateData: WorldStateInvasionData;
}

interface WorldStateInvasionData {
	_id: { $oid: string };
	Node: string;
	Count: number;
	Goal: number;
	Faction: string;
	DefenderFaction: string;
	Completed: boolean;
}

function calculatePercentage(wsInvasion: WorldStateInvasionData): number
{
	let progress: number; // Range: 0 to 1

	if (wsInvasion.Faction === "FC_INFESTATION") {
		progress = 1 - Math.abs(wsInvasion.Count / wsInvasion.Goal);
	} else {
		// Corpus vs. Grineer, no Infested
		progress = (wsInvasion.Count + wsInvasion.Goal) / (2 * wsInvasion.Goal);

		if (wsInvasion.Count > 0) {
			// Attacker is winning
			progress = 1 - progress;
		}
	}

	progress = Math.max(0, progress);
	progress = Math.min(1, progress);
	return progress * 100;
}

function createInvasionProgressBar(extraData: InvasionExtraData): HTMLDivElement
{
	const [attackerFactionClass, defenderFactionClass] = [
		extraData.worldStateData.Faction,
		extraData.worldStateData.DefenderFaction
	].map(factionKey => factionKey.toLowerCase().replace("fc_", "invasion-"));

	const container = document.createElement("div");
	container.className = `invasion-progress-container ${defenderFactionClass}`;

	const bar = document.createElement("div");
	bar.className = `invasion-progress-bar ${attackerFactionClass}`;
	bar.style.width = `${extraData.worldStateData.Count <= 0 ? extraData.percentage : (100 - extraData.percentage)}%`;
	container.appendChild(bar);

	return container;
}

function buildInvasionExtraDataMap(wsInvasions: WorldStateInvasionData[], oracleInvasions: any[]): Record<string, InvasionExtraData>
{
	const extraDataMap: Record<string, InvasionExtraData> = {};

	for (const wsInvasion of wsInvasions) {
		if (wsInvasion.Completed) continue;

		const oracleInvasion = oracleInvasions.find(inv => inv.id === wsInvasion._id.$oid);
		if (!oracleInvasion) continue;

		extraDataMap[oracleInvasion.id] = {
			hasInfested: wsInvasion.Faction === "FC_INFESTATION",
			isDuplicate: false,
			percentage: calculatePercentage(wsInvasion),
			worldStateData: wsInvasion
		};
	}

	return extraDataMap;
}

function renderInvasionProgressPercentage(last_id: string, extraData: InvasionExtraData): HTMLTableCellElement
{
	const td = document.createElement("td");
	if (last_id !== extraData.worldStateData._id.$oid) {
		td.className = "text-end";
		const span = document.createElement("span");
		span.className = "invasion-percentage";
		span.textContent = `${extraData.percentage.toFixed(1)}%`;
		td.appendChild(span);
	}
	return td;
}

function sortInvasionsInPlace(invasions: any[], extraDataMap: Record<string, InvasionExtraData>): void
{
	invasions.sort((a, b) => {
		const [extraDataA, extraDataB] = [a, b].map(x => extraDataMap[x.id]);

		if (!extraDataA || !extraDataB) return 0;

		return extraDataA.percentage - extraDataB.percentage;
	});
}

// Expose functions globally for non-module scripts
(window as any).createInvasionProgressBar = createInvasionProgressBar;
(window as any).buildInvasionExtraDataMap = buildInvasionExtraDataMap;
(window as any).renderInvasionProgressPercentage = renderInvasionProgressPercentage;
(window as any).sortInvasionsInPlace = sortInvasionsInPlace;
