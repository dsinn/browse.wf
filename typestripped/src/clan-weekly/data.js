import { fetchItemMaps } from '../helpers/item-maps.js';
import { lastPathSegment, normalizeStoreItemPath } from '../helpers/path-helpers.js';
import { camelToWords } from '../helpers/string-helpers.js';
import { getWeekIndex, WEEK_EPOCH_MS, MILLIS_PER_WEEK } from '../helpers/time-helpers.js';
export function resolveBonusRegion(bonusRegion, dict) {
    return dict[bonusRegion]
        ?? dict[bonusRegion + '_SPACE']
        ?? camelToWords(lastPathSegment(bonusRegion));
}
/**
Millisecond timestamp of when a given WeekCount began.
*/
export function weekCountToActivationMs(weekCount) {
    return WEEK_EPOCH_MS + (weekCount * MILLIS_PER_WEEK);
}
/**
Returns the WeeklyVaultBonusRewards entry for the current week, falling back to the upcoming week.
*/
export function findClanWeeklyEntry(entries) {
    const currentWeekIdx = getWeekIndex(Date.now());
    return entries.find(entry => entry.WeekCount === currentWeekIdx)
        ?? entries.find(entry => entry.WeekCount === currentWeekIdx + 1);
}
/**
 Resolves rewards for a single WeeklyVaultBonusRewards entry.
 Sorts ascending by PointThreshold; renders each as a percentage of the max threshold.
 */
export async function resolveClanWeeklyRewards(entry, dict) {
    const { itemNameMap, itemIconMap, fusionPointsMap } = await fetchItemMaps();
    const sorted = [...entry.Rewards].sort((a, b) => a.PointThreshold - b.PointThreshold);
    const maxThreshold = sorted[sorted.length - 1].PointThreshold;
    return sorted.map(reward => {
        const pct = Math.round((reward.PointThreshold / maxThreshold) * 100);
        const normalized = normalizeStoreItemPath(reward.Reward);
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
            const denominationDigits = lastPathSegment(reward.Reward).replaceAll(/\D+/gu, '');
            const total = reward.ItemCount * (denominationDigits === '' ? 1 : Number(denominationDigits));
            return { pct, display: `${total.toLocaleString('en')} Credits`, iconPath };
        }
        // Endo: fold itemCount × fusionPoints into a single formatted total.
        const fusionPoints = fusionPointsMap[normalized];
        if (fusionPoints) {
            const total = reward.ItemCount * fusionPoints;
            return { pct, display: `${total.toLocaleString('en')} Endo`, iconPath };
        }
        const nameKey = itemNameMap[normalized];
        const itemName = (nameKey && dict[nameKey]) ?? camelToWords(lastPathSegment(reward.Reward));
        return { pct, display: `${reward.ItemCount.toLocaleString('en')}x ${itemName}`, iconPath };
    });
}
//# sourceMappingURL=data.js.map