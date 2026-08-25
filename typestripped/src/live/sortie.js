export function appendSortieLocation(td, node, tileset) {
    td.append(document.createElement('br'));
    const locationElement = document.createElement('abbr');
    locationElement.textContent = `${window.dict[node.name]}, ${window.dict[node.systemName]}`;
    window.addTooltip(locationElement, window.formatTileset(tileset));
    td.append(locationElement);
}
window.appendSortieLocation = appendSortieLocation;
//# sourceMappingURL=sortie.js.map