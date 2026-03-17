/** Attaches a Bootstrap tooltip to an element. */
export function addTooltip(elm: HTMLElement, title: string): void
{
	elm.setAttribute("data-bs-toggle", "tooltip");
	elm.setAttribute("data-bs-title", title);
	new window.bootstrap.Tooltip(elm);
}

(window as any).addTooltip = addTooltip;
