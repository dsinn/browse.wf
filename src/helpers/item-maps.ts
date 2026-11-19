import {fetchExport} from '../public-export-fetcher.js';
import {normalizeStoreItemPath} from './path-helpers.js';

export type IItemMaps = {
	itemNameMap: Record<string, string>;
	itemIconMap: Record<string, string>;
	fusionPointsMap: Record<string, number>;
};

let itemMapsPromise: Promise<IItemMaps> | undefined;

/**
 Builds (once) lookups from normalized item paths to name keys, icon paths, and Endo fusion points.
 */
export async function fetchItemMaps(): Promise<IItemMaps> {
	itemMapsPromise ??= (async () => {
		const [
			exportResources,
			exportGear,
			exportBundles,
			exportBoosterPacks,
			exportBoosters,
			exportCreditBundles,
			exportFusionBundles,
		] = await Promise.all([
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
		const namedExports = [
			exportResources,
			exportGear,
			exportBundles,
			exportBoosterPacks,
			exportBoosters,
			exportCreditBundles,
		];
		for (const exportData of namedExports) {
			for (const [key, value] of Object.entries(exportData)) {
				const normalized = normalizeStoreItemPath(key);
				if ((value as any).icon) {
					itemIconMap[normalized] = (value as any).icon;
				}

				if ((value as any).name) {
					itemNameMap[normalized] = (value as any).name;
				}
			}
		}

		for (const [key, value] of Object.entries(exportFusionBundles)) {
			const normalized = normalizeStoreItemPath(key);
			if ((value as any).fusionPoints) {
				fusionPointsMap[normalized] = (value as any).fusionPoints as number;
			}

			if ((value as any).icon) {
				itemIconMap[normalized] = (value as any).icon;
			}
		}

		return {itemNameMap, itemIconMap, fusionPointsMap};
	})();

	return itemMapsPromise;
}
