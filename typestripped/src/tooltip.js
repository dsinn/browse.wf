/** Attaches a Bootstrap tooltip to an element. */
export function addTooltip(elm, title) {
    elm.dataset.bsToggle = 'tooltip';
    elm.dataset.bsTitle = title;
    void new window.bootstrap.Tooltip(elm);
}
window.addTooltip = addTooltip;
//# sourceMappingURL=tooltip.js.map