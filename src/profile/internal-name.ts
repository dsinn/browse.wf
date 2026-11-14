/**
 Rendering for rows whose type has no entry in the public export data (and so no display name).
 They are shown by the last segment of their internal path, in teletype, with the full path as a Bootstrap tooltip.

 The tooltip is delegated from the table body (see enableInternalNameTooltips) rather than created per element,
 because table-sort-js rebuilds rows from HTML when sorting, which would drop any per-element tooltip.
 */

import {lastPathSegment} from '../helpers/path-helpers.js';
import {createTooltip} from '../tooltip.js';

const INTERNAL_NAME_SELECTOR = 'code.internal-name';

export function createInternalName(internalName: string): HTMLElement {
	const code = document.createElement('code');
	code.className = 'internal-name';
	code.textContent = lastPathSegment(internalName);
	code.dataset.bsToggle = 'tooltip';
	code.dataset.bsTitle = internalName;
	return code;
}

export function renderInternalName(cell: HTMLElement, internalName: string): void {
	cell.replaceChildren(createInternalName(internalName));
}

/**
 Makes internal names inside the container show their full path as a Bootstrap tooltip, including ones that are
 added or re-created later. Safe to call repeatedly for the same container.
 */
export function enableInternalNameTooltips(container: Element | undefined): void {
	if (!(container instanceof HTMLElement) || container.dataset.internalNameTooltips) {
		return;
	}

	container.dataset.internalNameTooltips = 'true';
	createTooltip(container, {selector: INTERNAL_NAME_SELECTOR});
}
