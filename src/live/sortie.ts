export function appendSortieLocation(td: HTMLTableCellElement, node: any, tileset: string): void {
	td.append(document.createElement('br'));
	const locationElement = document.createElement('abbr');
	locationElement.textContent = `${(globalThis as any).dict[node.name]}, ${(globalThis as any).dict[node.systemName]}`;
	(globalThis as any).addTooltip(locationElement, (globalThis as any).formatTileset(tileset) as string);
	td.append(locationElement);
}

(globalThis as any).appendSortieLocation = appendSortieLocation;
