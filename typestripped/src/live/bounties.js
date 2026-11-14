export function renderAllyIcon(allyName, allyCell) {
    const allyImg = document.createElement('img');
    allyImg.className = 'ally-icon';
    window.setImageSource(allyImg, `/Lotus/Interface/Icons/Player/${allyName}PixelGlyph.png`);
    window.addTooltip(allyImg, allyName);
    allyCell.replaceChildren(allyImg);
}
export function applyBountyFilters(syndicateTag, rows) {
    const minTier = window.getMinimumTier(syndicateTag);
    const isSectionHidden = minTier < 1;
    document.querySelector(`#${syndicateTag}-name`)?.classList.toggle('d-none', isSectionHidden);
    let isAnyVisible = false;
    for (const [i, row] of [...rows].entries()) {
        const tier = i + 1; // Tier 1 is index 0, Tier 2 is index 1, etc.
        const missionType = row.dataset.missionType ?? '';
        const isMissionVisible = !missionType || window.isBountyMissionTypeEnabled(syndicateTag, missionType);
        const isHidden = isSectionHidden || tier < minTier || !isMissionVisible;
        row.classList.toggle('d-none', isHidden);
        if (!isHidden) {
            isAnyVisible = true;
        }
    }
    document.querySelector(`#${syndicateTag}-empty`)?.classList.toggle('d-none', isSectionHidden || isAnyVisible);
}
window.renderAllyIcon = renderAllyIcon;
window.applyBountyFilters = applyBountyFilters;
//# sourceMappingURL=bounties.js.map