/**
 * Fork-specific fallback names for items for which browse.wf has no item data (it 404s) and
 * whose names warframe-public-export-plus does not provide.
 *
 * Entries live in translation-fallback-data.json, keyed by item unique name (English text, used for
 * every language). live.ts calls window.getItemDataFallback() before requesting item data from
 * browse.wf, so listed items are named without making a request.
 *
 * NOTE: This only covers item names resolved through getItemDataPromise()/getItemNamePromise()
 * in live.ts. It does NOT add the entries to the translation dict, so code that looks up
 * `dict[path]` directly will still miss them.
 */
import fallback from './translation-fallback-data.json';

/**
 * Stand-in item data (just a name) for an item we have a fallback name for.
 * Returns undefined for anything else, so the caller falls through to the normal request.
 */
export function getItemDataFallback(uniqueName: string): Promise<{name: string}> | undefined {
	const name = (fallback as Record<string, unknown>)[uniqueName];
	return typeof name === 'string' ? Promise.resolve({name}) : undefined;
}

(window as any).getItemDataFallback = getItemDataFallback;
