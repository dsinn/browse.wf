import { isFilterEnabled } from '../card-filters.js';
import { fetchExport } from '../public-export-fetcher.js';
import { canonicalizeMissionType } from '../helpers/mission-helpers.js';
import { getTileset, formatTileset } from '../helpers/tileset-helpers.js';
import { addTooltip } from '../tooltip.js';
import { scheduleAt } from '../timer-registry.js';
let latestRenderedFissureTime = 0;
const fissuresScheduledExpiries = new Set();
function buildFissureRow(dict, exports, renderedTierHeadings, fissure) {
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
        td.append(window.createExpiryBadge(fissure.Expiry.$date.$numberLong, 'Expired'));
        tr.append(td);
    }
    // Mission type + Level range column
    {
        const td = document.createElement('td');
        td.textContent = window.toTitleCase(dict[node.missionName]);
        if (cardName === 'rj-fissures') {
            // Void Storms: show level range with +10 adjustment
            const adjustedMin = node.minEnemyLevel + 10;
            const adjustedMax = node.maxEnemyLevel + 10;
            td.textContent += ` (${adjustedMin}-${adjustedMax})`;
        }
        else {
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
function buildLocationCell(dict, node) {
    const td = document.createElement('td');
    const locationText = dict[node.name] + ', ' + dict[node.systemName];
    const tileset = getTileset(node);
    if (tileset) {
        const abbr = document.createElement('abbr');
        abbr.textContent = locationText;
        addTooltip(abbr, formatTileset(tileset));
        td.append(abbr);
    }
    else {
        td.textContent = locationText;
    }
    return td;
}
export async function updateFissures(shouldForceRender = false) {
    const [dict, ExportRegions, ExportFactions] = await Promise.all([
        window.getDictPromise(),
        fetchExport('ExportRegions'),
        fetchExport('ExportFactions'),
    ]);
    // Skip re-render if no new mission has entered the set
    // (expiry-based re-renders handle removals; we only need to catch additions here)
    const now = Date.now();
    let maxActivation = 0;
    for (const f of [...window.worldState.ActiveMissions, ...window.worldState.VoidStorms]) {
        const activation = Number(f.Activation.$date.$numberLong);
        if (activation <= now && now < Number(f.Expiry.$date.$numberLong)) {
            maxActivation = Math.max(maxActivation, activation);
        }
    }
    if (!shouldForceRender && maxActivation === latestRenderedFissureTime) {
        return;
    }
    latestRenderedFissureTime = maxActivation;
    const fissures = Array.from(window.worldState.ActiveMissions, (fissure) => ({
        Category: fissure.Hard ? 'sp-fissures' : 'fissures',
        Hard: fissure.Hard,
        Activation: fissure.Activation,
        Expiry: fissure.Expiry,
        Node: fissure.Node,
        Modifier: fissure.Modifier,
    }));
    for (const fissure of window.worldState.VoidStorms) {
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
        return tierDiff === 0 ? Number(a.Expiry.$date.$numberLong) - Number(b.Expiry.$date.$numberLong) : tierDiff;
    });
    const tbody = {
        fissures: document.createElement('tbody'),
        'sp-fissures': document.createElement('tbody'),
        'rj-fissures': document.createElement('tbody'),
    };
    // Track which tier headings have been rendered for each category
    const renderedTierHeadings = {
        fissures: new Set(),
        'sp-fissures': new Set(),
        'rj-fissures': new Set(),
    };
    // Schedule re-render when each active fissure expires
    const activeFissureExpiries = new Set(fissures
        .filter(f => Date.now() >= Number(f.Activation.$date.$numberLong) && Date.now() < Number(f.Expiry.$date.$numberLong))
        .map(f => Number(f.Expiry.$date.$numberLong)));
    for (const expiry of activeFissureExpiries) {
        if (fissuresScheduledExpiries.has(expiry)) {
            continue;
        }
        fissuresScheduledExpiries.add(expiry);
        scheduleAt(expiry + 60_000, () => {
            fissuresScheduledExpiries.delete(expiry);
            void updateFissures(true);
        });
    }
    const { fissureTiers } = globalThis;
    for (const fissure of fissures) {
        if (Date.now() < Number(fissure.Activation.$date.$numberLong)) {
            // Not yet active; expiry-based re-render will handle it when worldState refreshes
        }
        else if (Date.now() < Number(fissure.Expiry.$date.$numberLong)) {
            const row = buildFissureRow(dict, { regions: ExportRegions, factions: ExportFactions, tiers: fissureTiers }, renderedTierHeadings, fissure);
            if (row) {
                tbody[fissure.Category].append(row);
            }
        }
    }
    // Show empty state message if no missions rendered for a category
    for (const category of Object.keys(tbody)) {
        if (renderedTierHeadings[category].size > 0) {
            continue;
        }
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.textContent = 'No missions to display based on the current filters.';
        tr.append(td);
        tbody[category].append(tr);
    }
    document.querySelector('#fissures-table').replaceChildren(tbody.fissures);
    document.querySelector('#sp-fissures-table').replaceChildren(tbody['sp-fissures']);
    document.querySelector('#rj-fissures-table').replaceChildren(tbody['rj-fissures']);
}
window.updateFissures = updateFissures;
//# sourceMappingURL=fissures.js.map