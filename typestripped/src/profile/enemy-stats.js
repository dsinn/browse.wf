/**
 Augments the upstream enemy stats table with rank column and faction
 filter bar. Enemies without an entry in the export data are shown by
 internal name under the "Unnamed" category.

 Called via (window as any).augmentEnemyStats() immediately after the
 upstream rendering block in profile.ts populates #enemy-stats.
 */
import { logger } from '../logger.js';
import { renderEnemyAggregates } from './aggregate-stats.js';
import { enableInternalNameTooltips, renderInternalName } from './internal-name.js';
import { appendUnnamedToggle, ENEMY_FACTIONS, initStatsFilterBar, makeRenumber, UNNAMED_CATEGORY, UNNAMED_DISPLAY_TEXT, } from './stats-filters.js';
let enemyRankObserver;
export function augmentEnemyStats(profile) {
    const { ExportEnemies } = globalThis;
    renderEnemyAggregates([], [], undefined);
    const unnamedToggle = document.querySelector('#enemy-unnamed-toggle');
    unnamedToggle.replaceChildren();
    const enemyFilterBar = document.querySelector('#enemy-filter-bar');
    const enemyTbody = document.querySelector('#enemy-stats');
    const rows = enemyTbody.querySelectorAll('tr');
    if (rows.length === 0) {
        logger.warn('augmentEnemyStats: #enemy-stats is empty');
        return;
    }
    const enemies = (profile?.Stats?.Enemies ?? []);
    if (rows.length !== enemies.length) {
        // E.g. a cached profile.js that still skips enemies without an export entry; the rows can't be matched up
        logger.warn(`augmentEnemyStats: ${rows.length} rows for ${enemies.length} enemies`);
        return;
    }
    const presentFactions = new Set();
    const categories = [];
    for (const [rowIndex, enemy] of enemies.entries()) {
        const type = ExportEnemies.avatars[enemy.type];
        const tr = rows[rowIndex];
        let factionLabel = UNNAMED_CATEGORY;
        if (type) {
            const bucket = ENEMY_FACTIONS.find(f => f.factions.includes(type.faction));
            factionLabel = bucket ? bucket.tooltip : '';
        }
        else {
            renderInternalName(tr.cells[0], enemy.type);
        }
        tr.dataset.category = factionLabel;
        categories.push(factionLabel);
        if (factionLabel) {
            presentFactions.add(factionLabel);
        }
        // Prepend rank cell
        const rankCell = document.createElement('td');
        tr.insertBefore(rankCell, tr.firstChild);
    }
    const enemyEntries = [
        ...ENEMY_FACTIONS.map(({ tooltip, icon }) => ({ key: tooltip, tooltip, icon })),
        {
            key: UNNAMED_CATEGORY, tooltip: 'Unnamed', icon: '', displayText: UNNAMED_DISPLAY_TEXT,
        },
    ];
    const { renumber, observer } = makeRenumber(enemyTbody, enemyRankObserver);
    enemyRankObserver = observer;
    const scans = profile?.Stats?.Scans;
    renderEnemyAggregates(enemies, categories, scans, false);
    initStatsFilterBar(enemyFilterBar, enemyTbody, enemyEntries, renumber);
    if (presentFactions.has(UNNAMED_CATEGORY)) {
        appendUnnamedToggle(unnamedToggle, enemyTbody, 'Show unnamed enemies', () => {
            renumber();
            renderEnemyAggregates(enemies, categories, scans, enemyTbody.dataset.showUnnamed === 'true');
        });
        enableInternalNameTooltips(enemyTbody);
    }
    renumber();
}
window.augmentEnemyStats = augmentEnemyStats;
//# sourceMappingURL=enemy-stats.js.map