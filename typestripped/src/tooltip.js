/**
Creates a Bootstrap tooltip instance for an element.
Returns the instance so callers can use a plain call instead of `new` for its side effects.
*/
export function createTooltip(elm, options) {
    return new window.bootstrap.Tooltip(elm, options);
}
/**
Attaches a Bootstrap tooltip to an element.
*/
export function addTooltip(elm, title) {
    elm.dataset.bsToggle = 'tooltip';
    elm.dataset.bsTitle = title;
    createTooltip(elm);
}
window.addTooltip = addTooltip;
//# sourceMappingURL=tooltip.js.map