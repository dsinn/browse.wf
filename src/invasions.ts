// Invasion helper functions for calculating progress, sorting, and creating UI elements

interface InvasionExtraData {
	isDuplicate: boolean;
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
	Activation: { $date: { $numberLong: string } };
}

function calculatePercentage(wsInvasion: WorldStateInvasionData): number
{
	let progress: number = 1 - Math.abs(wsInvasion.Count / wsInvasion.Goal);
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

	let barPercentage = extraData.worldStateData.Faction === "FC_INFESTATION"
		? extraData.percentage
		: 100 * (extraData.worldStateData.Count + extraData.worldStateData.Goal) / (2 * extraData.worldStateData.Goal);
	bar.style.width = `${barPercentage}%`;
	container.appendChild(bar);

	return container;
}

function buildInvasionExtraDataMap(wsInvasions: WorldStateInvasionData[], oracleInvasions: any[]): Record<string, InvasionExtraData>
{
	const extraDataMap: Record<string, InvasionExtraData> = {};

	// Track the earliest activation time for each node
	const nodeFirstActivation = new Map<string, number>();

	// First pass: determine the earliest activation for each node
	for (const wsInvasion of wsInvasions) {
		if (wsInvasion.Completed) continue;

		const activationTime = parseInt(wsInvasion.Activation.$date.$numberLong);
		const currentEarliest = nodeFirstActivation.get(wsInvasion.Node);

		if (currentEarliest === undefined || activationTime < currentEarliest) {
			nodeFirstActivation.set(wsInvasion.Node, activationTime);
		}
	}

	// Second pass: mark invasions as duplicate if they're not the earliest on their node
	for (const wsInvasion of wsInvasions) {
		if (wsInvasion.Completed) continue;

		const oracleInvasion = oracleInvasions.find(inv => inv.id === wsInvasion._id.$oid);
		if (!oracleInvasion) continue;

		const activationTime = parseInt(wsInvasion.Activation.$date.$numberLong);
		const firstActivationTime = nodeFirstActivation.get(wsInvasion.Node);
		const isDuplicate = activationTime > firstActivationTime;

		extraDataMap[oracleInvasion.id] = {
			isDuplicate: isDuplicate,
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
