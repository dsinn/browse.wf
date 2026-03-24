export function renderAllyIcon(allyName: string, allyCell: Element): void {
	const allyImg = document.createElement('img');
	allyImg.className = 'ally-icon';
	(globalThis as any).setImageSource(allyImg, `/Lotus/Interface/Icons/Player/${allyName}PixelGlyph.png`);
	(globalThis as any).addTooltip(allyImg, allyName);
	allyCell.innerHTML = '';
	allyCell.append(allyImg);
}

export function applyBountyTierFilter(syndicateTag: string, rows: NodeListOf<Element>): void {
	const minTier = (globalThis as any).getMinimumTier(syndicateTag) as number;
	const heading = document.querySelector(`#${syndicateTag}-name`);
	heading?.classList.toggle('d-none', minTier < 1);
	for (const [i, row] of [...rows].entries()) {
		const tier = i + 1; // Tier 1 is index 0, Tier 2 is index 1, etc.
		row.classList.toggle('d-none', minTier < 1 || tier < minTier);
	}
}

(globalThis as any).renderAllyIcon = renderAllyIcon;
(globalThis as any).applyBountyTierFilter = applyBountyTierFilter;
