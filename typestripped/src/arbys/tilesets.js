/**
 * Appends the formatted tileset name to a log entry span, if the node has one.
 */
export function appendTilesetText(span, node) {
    const formattedTileset = window.formatTileset(window.getTileset(node));
    if (formattedTileset) {
        span.textContent += `, ${formattedTileset}`;
    }
}
/**
 * Returns true if the tileset checkbox for the given node is checked (or absent).
 * Returns false if the checkbox exists and is unchecked.
 */
export function isTilesetChecked(node) {
    const tileset = window.getTileset(node);
    if (!tileset) {
        return true;
    }
    const checkbox = document.querySelector(`#filter-${tileset}`);
    return checkbox === null || checkbox.checked;
}
/**
 * Populates the "next occurrence" table row for the tileset of the given node,
 * if the row exists and hasn't been filled yet.
 */
export function updateTilesetNextOccurrence(node, timestamp, dateText, detailText) {
    const tileset = window.getTileset(node);
    if (!tileset) {
        return;
    }
    const tr = document.querySelector(`#next-${tileset}`);
    if (!tr?.children[1] || tr?.children[1].innerHTML !== 'N/A') {
        return;
    }
    delete tr.dataset.starved;
    tr.children[1].dataset.timestamp = timestamp.toString();
    tr.children[1].textContent = dateText;
    tr.children[2].textContent = detailText;
    if ('darkSectorData' in node) {
        tr.children[2].textContent += ` (${(node.darkSectorData.resourceBonus * 100).toFixed(0)}% resource bonus)`;
    }
}
window.appendTilesetText = appendTilesetText;
window.isTilesetChecked = isTilesetChecked;
window.updateTilesetNextOccurrence = updateTilesetNextOccurrence;
//# sourceMappingURL=tilesets.js.map