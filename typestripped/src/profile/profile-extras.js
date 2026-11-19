/**
 Single entry point for the fork's additions to the profile header (death marks) and Stats tab.

 Called via (window as any).renderProfileExtras() at the end of renderProfile() in profile.ts.
 */
import { logger } from '../logger.js';
import { renderAbilityStats } from './ability-stats.js';
import { renderDeathMarks } from './death-marks.js';
import { renderRaceStats } from './race-stats.js';
import { renderStatsOverview } from './stats-overview.js';
import { initStatsSubtabs } from './stats-subtabs.js';
/**
 Runs one part of the extras. A part that fails (throws, or rejects) is logged and skipped, so that the other parts,
 and the rest of the profile, still show. The part starts running straight away, before anything is awaited.
 */
async function attempt(name, render) {
    try {
        await render();
    }
    catch (error) {
        logger.warn(`renderProfileExtras: ${name} failed`, error);
    }
}
export async function renderProfileExtras(profile) {
    await Promise.all([
        attempt('death marks', () => {
            renderDeathMarks(profile);
        }),
        attempt('stats sub-tabs', () => {
            initStatsSubtabs(window.__profileParams);
        }),
        attempt('stats overview', () => {
            renderStatsOverview(profile);
        }),
        attempt('races', () => {
            renderRaceStats(profile);
        }),
        attempt('abilities', async () => renderAbilityStats(profile)),
    ]);
}
window.renderProfileExtras = renderProfileExtras;
//# sourceMappingURL=profile-extras.js.map