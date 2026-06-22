import {camelToWords} from '../calendar-seasons/data.js';
import {getWeekIndex, WEEK_EPOCH_MS, MILLIS_PER_WEEK} from '../helpers/time-helpers.js';
import {fetchExport} from '../public-export-fetcher.js';

export type IResolvedClanWeeklyReward = {
	pct: number;
	display: string;
	iconPath?: string;
};

function lastSegment(path: string): string {
	return path.split('/').pop() ?? path;
}

export function resolveBonusRegion(bonusRegion: string, dict: Record<string, string>): string {
	return dict[bonusRegion]
		?? dict[bonusRegion + '_SPACE']
		?? camelToWords(lastSegment(bonusRegion));
}

/** Millisecond timestamp of when a given WeekCount began. */
export function weekCountToActivationMs(weekCount: number): number {
	return WEEK_EPOCH_MS + (weekCount * MILLIS_PER_WEEK);
}

/** Returns the WeeklyVaultBonusRewards entry for the current week, falling back to the upcoming week. */
export function findClanWeeklyEntry(entries: any[]): any | undefined {
	const currentWeekIdx = getWeekIndex(Date.now());
	return entries.find(entry => entry.WeekCount === currentWeekIdx)
		?? entries.find(entry => entry.WeekCount === currentWeekIdx + 1);
}

let itemMapsPromise: Promise<{itemNameMap: Record<string, string>; itemIconMap: Record<string, string>; fusionPointsMap: Record<string, number>}> | undefined;

async function fetchItemMaps(): Promise<{itemNameMap: Record<string, string>; itemIconMap: Record<string, string>; fusionPointsMap: Record<string, number>}> {
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
			const itemNameMap: Record<string, string> = {};
			const itemIconMap: Record<string, string> = {};
			const fusionPointsMap: Record<string, number> = {};
			for (const exportData of [exportResources, exportGear, exportBundles, exportBoosterPacks, exportBoosters, exportCreditBundles]) {
				for (const [key, value] of Object.entries(exportData)) {
					const normalized = key.replace('/Lotus/StoreItems/', '/Lotus/');
					if ((value as any).icon) {
						itemIconMap[normalized] = (value as any).icon;
					}

					if ((value as any).name) {
						itemNameMap[normalized] = (value as any).name;
					}
				}
			}

			for (const [key, value] of Object.entries(exportFusionBundles)) {
				const normalized = key.replace('/Lotus/StoreItems/', '/Lotus/');
				if ((value as any).fusionPoints) {
					fusionPointsMap[normalized] = (value as any).fusionPoints as number;
				}

				if ((value as any).icon) {
					itemIconMap[normalized] = (value as any).icon;
				}
			}

			return {itemNameMap, itemIconMap, fusionPointsMap};
		})();
	}

	return itemMapsPromise;
}

/**
 * Resolves rewards for a single WeeklyVaultBonusRewards entry.
 * Sorts ascending by PointThreshold; renders each as a percentage of the max threshold.
 */
export async function resolveClanWeeklyRewards(
	entry: any,
	dict: Record<string, string>,
): Promise<IResolvedClanWeeklyReward[]> {
	const {itemNameMap, itemIconMap, fusionPointsMap} = await fetchItemMaps();
	const sorted = [...(entry.Rewards as any[])].sort((a, b) => (a.PointThreshold as number) - (b.PointThreshold as number));
	const maxThreshold = sorted[sorted.length - 1]!.PointThreshold as number;

	return sorted.map(reward => {
		const pct = Math.round(((reward.PointThreshold as number) / maxThreshold) * 100);
		const normalized = (reward.Reward as string).replace('/Lotus/StoreItems/', '/Lotus/');
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
			const denomination = Number.parseInt(lastSegment(reward.Reward as string).replaceAll(/\D+/gu, ''), 10);
			const total = (reward.ItemCount as number) * (Number.isNaN(denomination) ? 1 : denomination);
			return {pct, display: `${total.toLocaleString('en')} Credits`, iconPath};
		}

		// Endo: fold itemCount × fusionPoints into a single formatted total.
		const fusionPoints = fusionPointsMap[normalized];
		if (fusionPoints) {
			const total = (reward.ItemCount as number) * fusionPoints;
			return {pct, display: `${total.toLocaleString('en')} Endo`, iconPath};
		}

		const nameKey = itemNameMap[normalized];
		const itemName = (nameKey && dict[nameKey]) ?? camelToWords(lastSegment(reward.Reward as string));
		return {pct, display: `${(reward.ItemCount as number).toLocaleString('en')}x ${itemName}`, iconPath};
	});
}
