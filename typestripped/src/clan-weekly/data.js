import { camelToWords } from '../calendar-seasons/data.js';
import { getWeekIndex, WEEK_EPOCH_MS, MILLIS_PER_WEEK } from '../helpers/time-helpers.js';
import { fetchExport } from '../public-export-fetcher.js';
function lastSegment(path) {
    return path.split('/').pop() ?? path;
}
export function resolveBonusRegion(bonusRegion, dict) {
    return dict[bonusRegion]
        ?? dict[bonusRegion + '_SPACE']
        ?? camelToWords(lastSegment(bonusRegion));
}
/** Millisecond timestamp of when a given WeekCount began. */
export function weekCountToActivationMs(weekCount) {
    return WEEK_EPOCH_MS + (weekCount * MILLIS_PER_WEEK);
}
/** Returns the WeeklyVaultBonusRewards entry for the current week, falling back to the upcoming week. */
export function findClanWeeklyEntry(entries) {
    const currentWeekIdx = getWeekIndex(Date.now());
    return entries.find(entry => entry.WeekCount === currentWeekIdx)
        ?? entries.find(entry => entry.WeekCount === currentWeekIdx + 1);
}
let itemMapsPromise;
async function fetchItemMaps() {
    if (itemMapsPromise === undefined) {
        itemMapsPromise = (async () => {
            const [exportResources, exportGear, exportBundles, exportBoosterPacks, exportBoosters, exportCreditBundles, exportFusionBundles] = await Promise.all([
                fetchExport('ExportResources'),
                fetchExport('ExportGear'),
                fetchExport('ExportBundles'),
                fetchExport('ExportBoosterPacks'),
                fetchExport('ExportBoosters'),
                fetchExport('ExportCreditBundles'),
                fetchExport('ExportFusionBundles'),
            ]);
            const itemNameMap = {};
            const itemIconMap = {};
            const fusionPointsMap = {};
            for (const exportData of [exportResources, exportGear, exportBundles, exportBoosterPacks, exportBoosters, exportCreditBundles]) {
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
            for (const [key, value] of Object.entries(exportFusionBundles)) {
                const normalized = key.replace('/Lotus/StoreItems/', '/Lotus/');
                if (value.fusionPoints) {
                    fusionPointsMap[normalized] = value.fusionPoints;
                }
                if (value.icon) {
                    itemIconMap[normalized] = value.icon;
                }
            }
            return { itemNameMap, itemIconMap, fusionPointsMap };
        })();
    }
    return itemMapsPromise;
}
/**
 * Resolves rewards for a single WeeklyVaultBonusRewards entry.
 * Sorts ascending by PointThreshold; renders each as a percentage of the max threshold.
 */
export async function resolveClanWeeklyRewards(entry, dict) {
    const { itemNameMap, itemIconMap, fusionPointsMap } = await fetchItemMaps();
    const sorted = [...entry.Rewards].sort((a, b) => a.PointThreshold - b.PointThreshold);
    const maxThreshold = sorted[sorted.length - 1].PointThreshold;
    return sorted.map(reward => {
        const pct = Math.round((reward.PointThreshold / maxThreshold) * 100);
        const normalized = reward.Reward.replace('/Lotus/StoreItems/', '/Lotus/');
        let iconPath = itemIconMap[normalized];
        // 50000Credits (and potentially other amounts) is absent from ExportCreditBundles even though
        // every other /PickUps/Credits/ entry shares the same CreditsLarge icon — use any sibling's icon.
        if (!iconPath && normalized.includes('/PickUps/Credits/')) {
            const sibling = Object.entries(itemIconMap).find(([k]) => k.includes('/PickUps/Credits/'));
            if (sibling) {
                iconPath = sibling[1];
            }
        }
        // Credits: fold itemCount × the credit denomination into a single formatted total.
        if (normalized.includes('/PickUps/Credits/')) {
            const denomination = Number.parseInt(lastSegment(reward.Reward).replaceAll(/\D+/gu, ''), 10);
            const total = reward.ItemCount * (Number.isNaN(denomination) ? 1 : denomination);
            return { pct, display: `${total.toLocaleString('en')} Credits`, iconPath };
        }
        // Endo: fold itemCount × fusionPoints into a single formatted total.
        const fusionPoints = fusionPointsMap[normalized];
        if (fusionPoints) {
            const total = reward.ItemCount * fusionPoints;
            return { pct, display: `${total.toLocaleString('en')} Endo`, iconPath };
        }
        const nameKey = itemNameMap[normalized];
        const itemName = (nameKey && dict[nameKey]) ?? camelToWords(lastSegment(reward.Reward));
        return { pct, display: `${reward.ItemCount.toLocaleString('en')}x ${itemName}`, iconPath };
    });
}
//# sourceMappingURL=data.js.map