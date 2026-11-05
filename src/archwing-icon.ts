const ARCHWING_ICON_PATH = '/Lotus/Interface/Icons/StoreIcons/Gear/GenericArchwingSystems.png';
const ARCHWING_TOOLTIP = 'Archwing';

// `tooltip.js` (from bundle)
declare function addTooltip(element: HTMLElement, title: string): void;

// `common.js`
declare function setImageSource(img: HTMLImageElement, icon: string): void;

export function makeArchwingIcon(className?: string): HTMLImageElement {
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
