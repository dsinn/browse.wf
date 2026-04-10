// Shared tileset helper functions used by arbys.ts and live.ts
// Type-only import is safe (doesn't trigger module mode)
import type {IRegion} from 'warframe-public-export-plus';

let tilesetPrefixes: string[] | undefined;

function getTilesetPrefixes(): string[] {
	if (!tilesetPrefixes) {
		const knownTilesets = [...new Set((Object.values((globalThis as any).ExportRegions as Record<string, IRegion>))
			.map(n => n.tileset)
			.filter((t): t is string => t !== undefined))];
		// Sort longest-first so more specific prefixes (e.g. GrineerForestCaves) match before shorter ones (GrineerForest)
		tilesetPrefixes = knownTilesets.sort((a, b) => b.length - a.length);
	}

	return tilesetPrefixes;
}

/**
 * Get tileset from a region node.
 * Falls back to inferring the tileset from levelOverride for nodes that lack tileset data,
 * by matching the segment against prefixes derived from known tilesets in ExportRegions.
 * @param node - The region node from ExportRegions
 */
export function getTileset(node: IRegion): string | undefined {
	if (node.tileset) {
		return node.tileset;
	}

	if (node.levelOverride) {
		const segment = node.levelOverride.split('/').pop() ?? '';
		const match = getTilesetPrefixes().find(t => segment.startsWith(t.split('Tileset')[0]));
		if (match) {
			return match;
		}
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

(globalThis as any).getTileset = getTileset;
(globalThis as any).formatTileset = formatTileset;
