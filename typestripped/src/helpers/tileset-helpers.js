let tilesetPrefixes;
function getTilesetPrefixes() {
    if (!tilesetPrefixes) {
        const knownTilesets = [...new Set((Object.values(window.ExportRegions))
                .map(n => n.tileset)
                .filter((t) => t !== undefined))];
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
export function getTileset(node) {
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
export function formatTileset(tileset) {
    if (!tileset) {
        return '';
    }
    return tileset
        .replace('Tileset', '')
        .replaceAll(/(?<=[a-z])(?=[A-Z])/gu, ' ');
}
window.getTileset = getTileset;
window.formatTileset = formatTileset;
//# sourceMappingURL=tileset-helpers.js.map