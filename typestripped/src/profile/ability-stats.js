/**
 Renders the Abilities table on the profile Stats tab: how often each ability was cast (Stats.Abilities).

 Abilities are attributed to a Warframe, Archwing or Necramech using the ability lists in ExportWarframes.
 Variants (Prime, Umbra, etc.) share ability paths, so they share a row; the shortest variant name is used.
 Abilities outside those lists (Operator, Helminth, Drifter, Railjack, ...) are attributed by category.

 Called via (window as any).renderAbilityStats() from the profile extras hook in profile.ts.
 */
import { logger } from '../logger.js';
import { fetchExport } from '../public-export-fetcher.js';
import { lastPathSegment } from '../helpers/path-helpers.js';
import { createInternalName, enableInternalNameTooltips } from './internal-name.js';
import { EQUIPMENT_CATEGORIES, initStatsFilterBar, makeRenumber } from './stats-filters.js';
const ARCHWING_PREFIX = '<ARCHWING> ';
const SLOT_EMOJI = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
const FRAME_CATEGORIES = {
    Suits: 'Warframe',
    SpecialItems: 'Warframe',
    SpaceSuits: 'Archwing',
    MechSuits: 'Necramech',
};
function categoryIcon(productCategory) {
    return EQUIPMENT_CATEGORIES[productCategory]?.icon ?? '';
}
const ABILITY_CATEGORY_ENTRIES = [
    { key: 'Warframe', tooltip: 'Warframes', icon: categoryIcon('Suits') },
    { key: 'Archwing', tooltip: 'Archwing', icon: categoryIcon('SpaceSuits') },
    { key: 'Necramech', tooltip: 'Necramech', icon: categoryIcon('MechSuits') },
    {
        key: 'Operator', tooltip: 'Operator', icon: '', displayText: '🧒',
    },
    {
        key: 'Drifter', tooltip: 'Drifter', icon: '', displayText: '🧑',
    },
    {
        key: 'Helminth', tooltip: 'Helminth', icon: '', displayText: '🧬',
    },
    {
        key: 'Railjack', tooltip: 'Railjack', icon: '', displayText: '🚀',
    },
    {
        key: 'Other', tooltip: 'Other', icon: '', displayText: '✨',
    },
];
let abilityRankObserver;
/**
 Guesses the category of an ability that has no entry in ExportWarframes, from its internal path.
 */
export function classifyAbilityPath(path) {
    const basename = lastPathSegment(path);
    if (path.includes('/Archwing/')) {
        return 'Archwing';
    }
    if (basename.startsWith('Operator')) {
        return 'Operator';
    }
    if (basename.startsWith('Helminth')) {
        return 'Helminth';
    }
    if (basename.includes('Drifter')) {
        return 'Drifter';
    }
    return path.includes('/CrewShip/') ? 'Railjack' : 'Other';
}
/**
 Builds a lookup from ability path to its owner, slot and display name.
 */
export function buildAbilityInfoMap(exportWarframes, exportAbilities, translate) {
    const infoMap = new Map();
    for (const [frameType, frame] of Object.entries(exportWarframes)) {
        const abilities = frame.abilities ?? [];
        if (abilities.length === 0) {
            continue;
        }
        const category = FRAME_CATEGORIES[frame.productCategory] ?? 'Other';
        const owner = (translate(frame.name) ?? lastPathSegment(frameType)).replace(ARCHWING_PREFIX, '');
        for (const [slot, ability] of abilities.entries()) {
            const existing = infoMap.get(ability.uniqueName);
            const isBetterOwner = !existing
                || owner.length < existing.owner.length
                || (owner.length === existing.owner.length && owner < existing.owner);
            if (isBetterOwner) {
                infoMap.set(ability.uniqueName, {
                    owner, category, slot, name: translate(ability.name),
                });
            }
        }
    }
    for (const [path, ability] of Object.entries(exportAbilities)) {
        if (infoMap.has(path)) {
            continue;
        }
        const category = classifyAbilityPath(path);
        infoMap.set(path, { owner: category, category, name: translate(ability.name) });
    }
    return infoMap;
}
/**
 Returns the key the Warframe column sorts by. Abilities with a slot sort by owner and then slot number,
 so a Warframe's abilities stay in their in-game order. Others sort by owner and then by name.
 */
export function getAbilitySortKey(info, abilityName) {
    return info.slot === undefined ? `${info.owner} ${abilityName}` : `${info.owner} ${info.slot + 1}`;
}
function resolveInfo(infoMap, path) {
    const known = infoMap.get(path);
    if (known) {
        return known;
    }
    const category = classifyAbilityPath(path);
    return { owner: category, category };
}
function createSlotElement(slot) {
    const label = `Ability ${slot + 1}`;
    const span = document.createElement('span');
    span.className = 'ability-slot';
    span.textContent = SLOT_EMOJI[slot] ?? String(slot + 1);
    span.title = label;
    span.setAttribute('role', 'img');
    span.setAttribute('aria-label', label);
    return span;
}
function createAbilityRow(ability, info) {
    const abilityName = info.name ?? lastPathSegment(ability.type);
    const tr = document.createElement('tr');
    tr.dataset.category = info.category;
    // Rank, filled in by makeRenumber()
    tr.append(document.createElement('td'));
    const ownerCell = document.createElement('td');
    ownerCell.textContent = info.owner;
    ownerCell.dataset.sort = getAbilitySortKey(info, abilityName);
    tr.append(ownerCell);
    const nameCell = document.createElement('td');
    nameCell.dataset.sort = abilityName;
    if (info.slot !== undefined) {
        nameCell.append(createSlotElement(info.slot), ' ');
    }
    if (info.name) {
        nameCell.append(info.name);
    }
    else {
        nameCell.append(createInternalName(ability.type));
    }
    tr.append(nameCell);
    const castsCell = document.createElement('td');
    castsCell.textContent = (ability.used ?? 0).toLocaleString();
    tr.append(castsCell);
    return tr;
}
export async function renderAbilityStats(profile) {
    // Disconnect early so queued MutationObserver callbacks from the previous render can't fire on the new rows.
    abilityRankObserver?.disconnect();
    abilityRankObserver = undefined;
    const filterBar = document.querySelector('#ability-filter-bar');
    const tbody = document.querySelector('#ability-stats');
    if (!filterBar || !tbody) {
        logger.warn('renderAbilityStats: ability table is missing');
        return;
    }
    tbody.replaceChildren();
    filterBar.replaceChildren();
    enableInternalNameTooltips(tbody);
    const abilities = [...profile?.Stats?.Abilities ?? []];
    if (abilities.length === 0) {
        return;
    }
    const [exportWarframes, exportAbilities] = await Promise.all([
        fetchExport('ExportWarframes'),
        fetchExport('ExportAbilities'),
    ]);
    const { dict } = globalThis;
    const infoMap = buildAbilityInfoMap(exportWarframes, exportAbilities, key => (key ? dict?.[key] : undefined));
    abilities.sort((a, b) => (b.used ?? 0) - (a.used ?? 0));
    const rows = [];
    for (const ability of abilities) {
        const info = resolveInfo(infoMap, ability.type);
        rows.push(createAbilityRow(ability, info));
    }
    tbody.replaceChildren(...rows);
    const { renumber, observer } = makeRenumber(tbody, abilityRankObserver);
    abilityRankObserver = observer;
    initStatsFilterBar(filterBar, tbody, ABILITY_CATEGORY_ENTRIES.map(entry => ({ ...entry })), renumber);
    renumber();
}
window.renderAbilityStats = renderAbilityStats;
//# sourceMappingURL=ability-stats.js.map