import {fetchExport} from '../public-export-fetcher.js';

declare function createExpiryBadge(expiryMs: number): Node;
declare function createCompletionToggle(oid: string): Node;

/**
 Fills a live-page card whose header has `#{idPrefix}-expiry` and `#{idPrefix}-checks` spans and whose body is
 `#{idPrefix}-body`: injects the expiry badge and completion toggle right away, then loads the images the pane's
 icons need and renders the pane.
 */
export async function populateLiveCard(
	idPrefix: string,
	expiryMs: number,
	completionOid: string,
	renderPane: () => Promise<Node>,
): Promise<void> {
	document.querySelector(`#${idPrefix}-expiry`)?.replaceChildren(createExpiryBadge(expiryMs));
	document.querySelector(`#${idPrefix}-checks`)?.replaceChildren(createCompletionToggle(completionOid));

	// Required for common.js' setImageSource, must be set before the pane is rendered
	window.ExportImages = await fetchExport('ExportImages');

	const body = document.querySelector(`#${idPrefix}-body`);
	if (!body) {
		return;
	}

	body.replaceChildren(await renderPane());
}
