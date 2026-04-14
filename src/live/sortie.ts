export function appendSortieLocation(td: HTMLTableCellElement, node: any, tileset: string): void {
	td.append(document.createElement('br'));
	const locationElement = document.createElement('abbr');
	locationElement.textContent = `${(window as any).dict[node.name]}, ${(window as any).dict[node.systemName]}`;
	window.addTooltip!(locationElement, window.formatTileset!(tileset));
	td.append(locationElement);
}

window.appendSortieLocation = appendSortieLocation;
