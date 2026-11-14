/**
 Calendar Seasons card lifecycle for the /live page.
 Handles active season detection, expiry-triggered re-renders,
 and injection of the expiry badge and completion toggle.

 Depends on globals from common.js: createExpiryBadge, createCompletionToggle, setImageSource
 Depends on globals from calendar-seasons.ts: renderCalendarSeasonPane
 */
import { renderCalendarSeasonPane } from '../calendar-seasons/index.js';
import { scheduleAt } from '../timer-registry.js';
import { populateLiveCard } from './card-helpers.js';
export async function updateCalendarSeason() {
    const seasons = window.worldState?.KnownCalendarSeasons ?? [];
    if (seasons.length === 0) {
        setTimeout(() => {
            void updateCalendarSeason();
        }, 5000);
        return;
    }
    const now = Date.now();
    const activeSeason = seasons.find(s => Number(s.Activation.$date.$numberLong) <= now && now < Number(s.Expiry.$date.$numberLong));
    if (activeSeason) {
        // Schedule re-render when the active season expires
        const expiry = Number(activeSeason.Expiry.$date.$numberLong);
        scheduleAt(expiry, () => {
            void updateCalendarSeason();
        });
    }
    else {
        // No active season yet — worldState may be stale; retry shortly
        setTimeout(() => {
            void updateCalendarSeason();
        }, 5000);
        return;
    }
    await populateLiveCard('calendar-season', Number(activeSeason.Expiry.$date.$numberLong), `calendarseason-${String(activeSeason.Expiry.$date.$numberLong)}`, async () => renderCalendarSeasonPane(activeSeason));
}
window.updateCalendarSeason = updateCalendarSeason;
//# sourceMappingURL=calendar-seasons.js.map