/**
 * Data transformation layer for the 1999 Calendar Seasons.
 * Usable in both browser and Node.js environments.
 *
 * Consumed by:
 *   - src/calendar-seasons.ts          (browser DOM rendering, via globals)
 *   - src/calendar-seasons-data.mts    (ES module re-export for Node/tests)
 */
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
 * Converts a 1-indexed day of the 1999 in-game calendar to a short date string.
 * Day 1 = Jan 1, Day 101 = Apr 11, etc.
 */
export function formatSeasonDay(day) {
    return new Date(1999, 0, day).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}
export function camelToWords(s) {
    return s.replaceAll(/(?<=.)(?=[A-Z])/gu, ' ');
}
function lastSegment(path) {
    return path.split('/').pop() ?? path;
}
function resolveChallengeText(event, dict, exportChallenges) {
    const challengeData = exportChallenges[event.challenge];
    if (!challengeData) {
        return { text: camelToWords(lastSegment(event.challenge)) };
    }
    const iconPath = challengeData.icon || undefined;
    const desc = challengeData.description ? dict[challengeData.description] : null;
    const count = challengeData.requiredCount;
    if (desc && count) {
        return { text: desc.replace('|COUNT|', String(count)), iconPath };
    }
    if (count) {
        return { text: `${camelToWords(lastSegment(event.challenge))} \u00D7${String(count)}`, iconPath };
    }
    return { text: camelToWords(lastSegment(event.challenge)), iconPath };
}
let itemMapsPromise;
async function fetchItemMaps() {
    if (itemMapsPromise === undefined) {
        itemMapsPromise = (async () => {
            const [exportResources, exportBundles, exportBoosterPacks, exportBoosters] = await Promise.all([
                fetchExport('ExportResources'),
                fetchExport('ExportBundles'),
                fetchExport('ExportBoosterPacks'),
                fetchExport('ExportBoosters'),
            ]);
            const itemIconMap = {};
            const itemNameMap = {};
            for (const exportData of [exportResources, exportBundles, exportBoosterPacks, exportBoosters]) {
                for (const [key, value] of Object.entries(exportData)) {
                    const normalized = key.replace('/Lotus/StoreItems/', '/Lotus/');
                    if (value.icon) {
                        itemIconMap[normalized] = value.icon;
                    }
                    if (value.name) {
                        itemNameMap[normalized] = value.name;
                    }
                }
            }
            return { itemIconMap, itemNameMap };
        })();
    }
    return itemMapsPromise;
}
/**
 * Resolves a calendar season's days into display-ready rows.
 * Returns one IResolvedCalendarDay per day that has events, in order.
 */
export async function resolveCalendarSeasonDays(season, dict) {
    const [exportChallenges, { itemIconMap, itemNameMap }] = await Promise.all([
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
            let text = '';
            let iconPath;
            switch (event.type) {
                case 'CET_CHALLENGE': {
                    ({ text, iconPath } = resolveChallengeText(event, dict, exportChallenges));
                    break;
                }
                case 'CET_REWARD': {
                    const normalized = event.reward.replace('/Lotus/StoreItems/', '/Lotus/');
                    iconPath = itemIconMap[normalized];
                    const nameKey = itemNameMap[normalized];
                    const rawName = (nameKey && dict[nameKey]) ?? camelToWords(lastSegment(event.reward));
                    text = rawName.replaceAll(/<[^>]+>\s*/gu, '').trim();
                    break;
                }
                case 'CET_UPGRADE': {
                    text = camelToWords(lastSegment(event.upgrade));
                    break;
                }
                // No default
            }
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