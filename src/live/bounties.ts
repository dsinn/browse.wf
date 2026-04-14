export function renderAllyIcon(allyName: string, allyCell: Element): void {
	const allyImg = document.createElement('img');
	allyImg.className = 'ally-icon';
	window.setImageSource(allyImg, `/Lotus/Interface/Icons/Player/${allyName}PixelGlyph.png`);
	window.addTooltip!(allyImg, allyName);
	allyCell.innerHTML = '';
	allyCell.append(allyImg);
}

export function applyBountyFilters(syndicateTag: string, rows: NodeListOf<Element>): void {
	const minTier = window.getMinimumTier!(syndicateTag);
	const sectionHidden = minTier < 1;
	document.querySelector(`#${syndicateTag}-name`)?.classList.toggle('d-none', sectionHidden);

	let anyVisible = false;
	for (const [i, row] of [...rows].entries()) {
		const tier = i + 1; // Tier 1 is index 0, Tier 2 is index 1, etc.
		const missionType = (row as HTMLElement).dataset.missionType ?? '';
		const missionVisible = !missionType || window.isBountyMissionTypeEnabled!(syndicateTag, missionType);
		const hidden = sectionHidden || tier < minTier || !missionVisible;
		row.classList.toggle('d-none', hidden);
		if (!hidden) {
			anyVisible = true;
		}
	}

	document.querySelector(`#${syndicateTag}-empty`)?.classList.toggle('d-none', sectionHidden || anyVisible);
}

window.renderAllyIcon = renderAllyIcon;
window.applyBountyFilters = applyBountyFilters;
