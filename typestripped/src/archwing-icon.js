const ARCHWING_ICON_PATH = '/Lotus/Interface/Icons/StoreIcons/Gear/GenericArchwingSystems.png';
const ARCHWING_TOOLTIP = 'Archwing';
export function makeArchwingIcon(className) {
    const img = document.createElement('img');
    if (className) {
        img.className = className;
    }
    img.style.cursor = 'help';
    setImageSource(img, ARCHWING_ICON_PATH);
    addTooltip(img, ARCHWING_TOOLTIP);
    return img;
}
window.makeArchwingIcon = makeArchwingIcon;
//# sourceMappingURL=archwing-icon.js.map