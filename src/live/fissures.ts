import {isFilterEnabled} from '../card-filters.js';
import {fetchExport} from '../public-export-fetcher.js';
import {canonicalizeMissionType} from '../helpers/mission-helpers.js';
import {getTileset, formatTileset} from '../helpers/tileset-helpers.js';
import {addTooltip} from '../tooltip.js';

let latestRenderedFissureTime = 0;
const fissuresScheduledExpiries = new Set<number>();

function buildFissureRow(
	dict: Record<string, string>,
	exports: {regions: any; factions: any; tiers: any},
	renderedTierHeadings: Record<string, Set<string>>,
	fissure: any,
): HTMLTableRowElement | undefined {
	const node = exports.regions[fissure.Node];
	const tier = fissure.Modifier; // VoidT1 = Lith, VoidT2 = Meso, etc.
	const cardName = fissure.Category; // "fissures", "sp-fissures", or "rj-fissures"
	// Railjack missions use node.missionName (strip prefix for cleaner localStorage keys)
	const missionType = cardName === 'rj-fissures'
		? node.missionName.replace('/Lotus/Language/Missions/MissionName_', '')
		: node.missionType;

	if (!isFilterEnabled(cardName, tier) || !isFilterEnabled(cardName, canonicalizeMissionType(missionType))) {
		return undefined;
	}

	const tr = document.createElement('tr');

	// Tier column
	{
		const th = document.createElement('th');
		if (!renderedTierHeadings[cardName].has(tier)) {
			th.textContent = exports.tiers[tier] ?? tier;
			renderedTierHeadings[cardName].add(tier);
		}

		tr.append(th);
	}

	// Expiry column
	{
		const td = document.createElement('td');
		td.append(window.createExpiryBadge(fissure.Expiry.$date.$numberLong));
		tr.append(td);
	}

	// Mission type + Level range column
	{
		const td = document.createElement('td');
		td.textContent = window.toTitleCase(dict[node.missionName]);
		if (cardName === 'rj-fissures') {
			// Void Storms: show level range with +10 adjustment
			const adjustedMin = (node.minEnemyLevel as number) + 10;
			const adjustedMax = (node.maxEnemyLevel as number) + 10;
			td.textContent += ` (${adjustedMin}-${adjustedMax})`;
		} else {
			// Normal and Steel Path fissures: omit level range (inconsistent/incorrect data)
		}

		tr.append(td);
	}

	// Faction column (only show when systemIndex != 21)
	{
		const td = document.createElement('td');
		if (node.systemIndex !== 21) {
			td.textContent = dict[exports.factions[node.faction].name];
		}

		tr.append(td);
	}

	tr.append(buildLocationCell(dict, node));

	return tr;
}

function buildLocationCell(dict: Record<string, string>, node: any): HTMLTableCellElement {
	const td = document.createElement('td');
	const locationText = dict[node.name] + ', ' + dict[node.systemName];
	const tileset = getTileset(node);
	if (tileset) {
		const abbr = document.createElement('abbr');
		abbr.textContent = locationText;
		addTooltip(abbr, formatTileset(tileset));
		td.append(abbr);
	} else {
		td.textContent = locationText;
	}

	return td;
}

export async function updateFissures(forceRender = false) {
	const [dict, ExportRegions, ExportFactions] = await Promise.all([
		window.getDictPromise(),
		fetchExport('ExportRegions'),
		fetchExport('ExportFactions'),
	]);

	// Skip re-render if no new mission has entered the set
	// (expiry-based re-renders handle removals; we only need to catch additions here)
	const now = Date.now();
	let maxActivation = 0;
	for (const f of [...(window as any).worldState.ActiveMissions, ...(window as any).worldState.VoidStorms]) {
		const activation = Number.parseInt(f.Activation.$date.$numberLong, 10);
		if (activation <= now && now < Number.parseInt(f.Expiry.$date.$numberLong, 10)) {
			maxActivation = Math.max(maxActivation, activation);
		}
	}

	if (!forceRender && maxActivation === latestRenderedFissureTime) {
		return;
	}

	latestRenderedFissureTime = maxActivation;

	const fissures: any[] = [];
	for (const fissure of (window as any).worldState.ActiveMissions) {
		fissures.push({
			Category: fissure.Hard ? 'sp-fissures' : 'fissures',
			Hard: fissure.Hard,
			Activation: fissure.Activation,
			Expiry: fissure.Expiry,
			Node: fissure.Node,
			Modifier: fissure.Modifier,
		});
	}

	for (const fissure of (window as any).worldState.VoidStorms) {
		fissures.push({
			Category: 'rj-fissures',
			Hard: false,
			Activation: fissure.Activation,
			Expiry: fissure.Expiry,
			Node: fissure.Node,
			Modifier: fissure.ActiveMissionTier,
		});
	}

	// Sort by tier first, then by expiry within each tier
	fissures.sort((a, b) => {
		const tierDiff = (a.Modifier.codePointAt(5) ?? 0) - (b.Modifier.codePointAt(5) ?? 0);
		if (tierDiff !== 0) {
			return tierDiff;
		}

		return Number.parseInt(a.Expiry.$date.$numberLong, 10) - Number.parseInt(b.Expiry.$date.$numberLong, 10);
	});

	const tbody = {
		fissures: document.createElement('tbody'),
		'sp-fissures': document.createElement('tbody'),
		'rj-fissures': document.createElement('tbody'),
	};
	// Track which tier headings have been rendered for each category
	const renderedTierHeadings: Record<string, Set<string>> = {
		fissures: new Set<string>(),
		'sp-fissures': new Set<string>(),
		'rj-fissures': new Set<string>(),
	};

	// Schedule re-render when each active fissure expires
	const activeFissureExpiries = new Set(fissures
		.filter(f => Date.now() >= Number.parseInt(f.Activation.$date.$numberLong, 10) && Date.now() < Number.parseInt(f.Expiry.$date.$numberLong, 10))
		.map(f => Number.parseInt(f.Expiry.$date.$numberLong, 10)));
	for (const expiry of activeFissureExpiries) {
		if (fissuresScheduledExpiries.has(expiry)) {
			continue;
		}

		fissuresScheduledExpiries.add(expiry);
		setTimeout(() => {
			fissuresScheduledExpiries.delete(expiry);
			void updateFissures(true);
		}, Math.max(0, expiry + 60_000 - Date.now()));
	}

	const {fissureTiers} = (globalThis as any);

	for (const fissure of fissures) {
		if (Date.now() < Number.parseInt(fissure.Activation.$date.$numberLong, 10)) {
			// Not yet active; expiry-based re-render will handle it when worldState refreshes
		} else if (Date.now() < Number.parseInt(fissure.Expiry.$date.$numberLong, 10)) {
			const row = buildFissureRow(dict, {regions: ExportRegions, factions: ExportFactions, tiers: fissureTiers}, renderedTierHeadings, fissure);
			if (row) {
				tbody[fissure.Category as keyof typeof tbody].append(row);
			}
		}
	}

	// Show empty state message if no missions rendered for a category
	for (const category of Object.keys(tbody)) {
		if (renderedTierHeadings[category].size === 0) {
			const tr = document.createElement('tr');
			const td = document.createElement('td');
			td.textContent = 'No missions to display based on the current filters.';
			tr.append(td);
			tbody[category as keyof typeof tbody].append(tr);
		}
	}

	document.querySelector('#fissures-table')!.innerHTML = '';
	document.querySelector('#fissures-table')!.append(tbody.fissures);
	document.querySelector('#sp-fissures-table')!.innerHTML = '';
	document.querySelector('#sp-fissures-table')!.append(tbody['sp-fissures']);
	document.querySelector('#rj-fissures-table')!.innerHTML = '';
	document.querySelector('#rj-fissures-table')!.append(tbody['rj-fissures']);
}

window.updateFissures = updateFissures;
