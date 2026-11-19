/**
 Data transformation layer for the 1999 Calendar Seasons.
 Usable in both browser and Node.js environments.

 Consumed by:
 - src/calendar-seasons.ts          (browser DOM rendering, via globals)
 - src/calendar-seasons-data.mts    (ES module re-export for Node/tests)
 */
import { fetchItemMaps } from '../helpers/item-maps.js';
import { lastPathSegment, normalizeStoreItemPath } from '../helpers/path-helpers.js';
import { camelToWords } from '../helpers/string-helpers.js';
import { fetchExport } from '../public-export-fetcher.js';
export const SEASON_LABELS = {
    CST_SPRING: '🌸 Spring',
    CST_SUMMER: '🌻 Summer',
    CST_FALL: '🍂 Autumn',
    CST_WINTER: '❄️ Winter',
};
const EVENT_EMOJI = {
    CET_CHALLENGE: '📋',
    CET_REWARD: '🎁',
    CET_UPGRADE: '🔧',
};
export function getSeasonLabel(season) {
    return SEASON_LABELS[season] ?? season;
}
/**
 Converts a 1-indexed day of the 1999 in-game calendar to a short date string.
 Day 1 = Jan 1, Day 101 = Apr 11, etc.
 */
export function formatSeasonDay(day) {
    return new Date(1999, 0, day).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}
function resolveChallengeText(event, dict, exportChallenges) {
    const challengeData = exportChallenges[event.challenge];
    if (!challengeData) {
        return { text: camelToWords(lastPathSegment(event.challenge)) };
    }
    const iconPath = challengeData.icon || undefined;
    const desc = challengeData.description ? dict[challengeData.description] : null;
    const count = challengeData.requiredCount;
    const challengeName = camelToWords(lastPathSegment(event.challenge));
    let text = count ? `${challengeName} \u{D7}${String(count)}` : challengeName;
    if (desc && count) {
        text = desc.replace('|COUNT|', () => String(count));
    }
    return { text, iconPath };
}
function resolveEventText(event, dict, exportChallenges, itemMaps) {
    switch (event.type) {
        case 'CET_CHALLENGE': {
            return resolveChallengeText(event, dict, exportChallenges);
        }
        case 'CET_REWARD': {
            const normalized = normalizeStoreItemPath(event.reward);
            const nameKey = itemMaps.itemNameMap[normalized];
            const rawName = (nameKey && dict[nameKey]) ?? camelToWords(lastPathSegment(event.reward));
            return { text: rawName.replaceAll(/<[^<>]+>\s*/gu, '').trim(), iconPath: itemMaps.itemIconMap[normalized] };
        }
        case 'CET_UPGRADE': {
            return { text: camelToWords(lastPathSegment(event.upgrade)) };
        }
        default: {
            return { text: '' };
        }
    }
}
/**
 Resolves a calendar season's days into display-ready rows.
 Returns one IResolvedCalendarDay per day that has events, in order.
 */
export async function resolveCalendarSeasonDays(season, dict) {
    const [exportChallenges, itemMaps] = await Promise.all([
        fetchExport('ExportChallenges'),
        fetchItemMaps(),
    ]);
    const daysWithEvents = season.Days.filter((d) => d.events.length > 0);
    const result = [];
    for (const dayEntry of daysWithEvents) {
        const dateString = formatSeasonDay(dayEntry.day);
        const resolvedEvents = [];
        for (const event of dayEntry.events) {
            const emoji = EVENT_EMOJI[event.type] ?? event.type;
            const { text, iconPath } = resolveEventText(event, dict, exportChallenges, itemMaps);
            if (text) {
                resolvedEvents.push({
                    type: event.type, emoji, dateStr: dateString, text, iconPath,
                });
            }
        }
        if (resolvedEvents.length > 0) {
            result.push({ day: dayEntry.day, events: resolvedEvents });
        }
    }
    return result;
}
// Expose globals for browser classic scripts; guard allows this file to run in Node.js too
if (globalThis.window !== undefined) {
    window.getSeasonLabel = getSeasonLabel;
    window.resolveCalendarSeasonDays = resolveCalendarSeasonDays;
    window.formatSeasonDay = formatSeasonDay;
    window.camelToWords = camelToWords;
    window.SEASON_LABELS = SEASON_LABELS;
}
//# sourceMappingURL=data.js.map