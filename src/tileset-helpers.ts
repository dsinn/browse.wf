// Shared tileset helper functions used by arbys.ts and live.ts
// Type-only import is safe (doesn't trigger module mode)
import type {IRegion} from 'warframe-public-export-plus';

/**
 * Get tileset from a region node
 * Handles edge case for SolNode94 (Apollodorus) which lacks tileset data
 * @param node - The region node from ExportRegions
 * @param regionKey - Optional region key (e.g., "SolNode94") for fallback logic
 */
export function getTileset(node: IRegion, regionKey?: string): string | undefined {
	// First check if node has tileset data
	if (node.tileset) {
		return node.tileset;
	}

	// Fallback for known nodes without tileset data
	if (regionKey === 'SolNode94') {
		return 'GrineerGalleonTileset';
	}

	// Log unexpected missing tileset data
	if ((globalThis as any).logger && regionKey) {
		(globalThis as any).logger.debug(`Node ${regionKey} is missing tileset data`);
	}

	return undefined;
}

/**
 * Format tileset string for display
 * Converts "GrineerGalleonTileset" to "Grineer Galleon"
 */
export function formatTileset(tileset: string | undefined): string {
	if (!tileset) {
		return '';
	}

	return tileset
		.replace('Tileset', '')
		.replaceAll(/(?<=[a-z])(?=[A-Z])/gu, ' ');
}

// Expose functions globally for non-module scripts
(globalThis as any).getTileset = getTileset;
(globalThis as any).formatTileset = formatTileset;
