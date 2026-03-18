/** Attaches a Bootstrap tooltip to an element. */
export function addTooltip(elm: HTMLElement, title: string): void {
	elm.dataset.bsToggle = 'tooltip';
	elm.dataset.bsTitle = title;
	void new globalThis.bootstrap.Tooltip(elm);
}

(globalThis as any).addTooltip = addTooltip;
