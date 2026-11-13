/**
Creates a Bootstrap tooltip instance for an element.
Returns the instance so callers can use a plain call instead of `new` for its side effects.
*/
export function createTooltip(elm: Element): unknown {
	return new window.bootstrap.Tooltip(elm);
}

/**
Attaches a Bootstrap tooltip to an element.
*/
export function addTooltip(elm: HTMLElement, title: string): void {
	elm.dataset.bsToggle = 'tooltip';
	elm.dataset.bsTitle = title;
	createTooltip(elm);
}

window.addTooltip = addTooltip;
