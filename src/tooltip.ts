/** Attaches a Bootstrap tooltip to an element. */
export function addTooltip(elm: HTMLElement, title: string): void {
	elm.dataset.bsToggle = 'tooltip';
	elm.dataset.bsTitle = title;
	void new window.bootstrap.Tooltip(elm);
}

window.addTooltip = addTooltip;
