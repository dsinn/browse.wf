import {addTooltip} from '../tooltip.js';

/**
Creates a warning icon with a tooltip, for data that may be inaccurate.
*/
export function createDataWarning(id: string, message: string): HTMLElement {
	const span = document.createElement('span');
	span.id = id;
	span.className = 'data-warning ms-2 text-warning';
	span.innerHTML = '<i class="bi bi-exclamation-triangle-fill"></i>';
	addTooltip(span, message);
	return span;
}
