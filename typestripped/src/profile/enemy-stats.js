/**
 * Augments the upstream enemy stats table with rank column and faction
 * filter bar.
 *
 * Called via (window as any).augmentEnemyStats() immediately after the
 * upstream rendering block in profile.ts populates #enemy-stats.
 */
import { logger } from '../logger.js';
import { ENEMY_FACTIONS, initStatsFilterBar, makeRenumber } from './stats-filters.js';
let enemyRankObserver;
export function augmentEnemyStats(profile) {
    const { ExportEnemies } = globalThis;
    const enemyFilterBar = document.querySelector('#enemy-filter-bar');
    const enemyTbody = document.querySelector('#enemy-stats');
    const rows = enemyTbody.querySelectorAll('tr');
    if (rows.length === 0) {
        logger.warn('augmentEnemyStats: #enemy-stats is empty');
        return;
    }
    const enemies = (profile?.Stats?.Enemies ?? []);
    const presentFactions = new Set();
    let rowIndex = 0;
    for (const enemy of enemies) {
        const type = ExportEnemies.avatars[enemy.type];
        if (!type) {
            continue;
        }
        const tr = rows[rowIndex++];
        const bucket = ENEMY_FACTIONS.find(f => f.factions.includes(type.faction));
        const factionLabel = bucket ? bucket.tooltip : '';
        tr.dataset.category = factionLabel;
        if (factionLabel) {
            presentFactions.add(factionLabel);
        }
        // Prepend rank cell
        const rankCell = document.createElement('td');
        tr.insertBefore(rankCell, tr.firstChild);
    }
    const enemyEntries = ENEMY_FACTIONS.map(({ tooltip, icon }) => ({ key: tooltip, tooltip, icon }));
    const { renumber, observer } = makeRenumber(enemyTbody, enemyRankObserver);
    enemyRankObserver = observer;
    initStatsFilterBar(enemyFilterBar, enemyTbody, enemyEntries, presentFactions, renumber);
    renumber();
}
window.augmentEnemyStats = augmentEnemyStats;
//# sourceMappingURL=enemy-stats.js.map