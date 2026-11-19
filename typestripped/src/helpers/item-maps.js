import { fetchExport } from '../public-export-fetcher.js';
import { normalizeStoreItemPath } from './path-helpers.js';
let itemMapsPromise;
/**
 Builds (once) lookups from normalized item paths to name keys, icon paths, and Endo fusion points.
 */
export async function fetchItemMaps() {
    itemMapsPromise ??= (async () => {
        const [exportResources, exportGear, exportBundles, exportBoosterPacks, exportBoosters, exportCreditBundles, exportFusionBundles,] = await Promise.all([
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
                if (value.icon) {
                    itemIconMap[normalized] = value.icon;
                }
                if (value.name) {
                    itemNameMap[normalized] = value.name;
                }
            }
        }
        for (const [key, value] of Object.entries(exportFusionBundles)) {
            const normalized = normalizeStoreItemPath(key);
            if (value.fusionPoints) {
                fusionPointsMap[normalized] = value.fusionPoints;
            }
            if (value.icon) {
                itemIconMap[normalized] = value.icon;
            }
        }
        return { itemNameMap, itemIconMap, fusionPointsMap };
    })();
    return itemMapsPromise;
}
//# sourceMappingURL=item-maps.js.map