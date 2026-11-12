/**
 Fork-specific fallback translations for names that browse.wf and warframe-public-export-plus
 do not provide.

 KNOWN GAP: the export-plus `dict` (getDictPromise() in common.js) is NOT merged, so direct
 `dict[key]` lookups still miss these entries. Add the same one-line hook there if one is needed.
 Upstream entries always take precedence over the fallback.
 */
import fallback from './translation-fallback-data.json';

/**
 Stand-in item data (just a name) for an item we have a fallback name for.
 Returns undefined for anything else, so the caller falls through to the normal request.
 */
export function getItemDataFallback(uniqueName: string): Promise<{name: string}> | undefined {
	const name = (fallback as Record<string, unknown>)[uniqueName];
	return typeof name === 'string' ? Promise.resolve({name}) : undefined;
}

/**
 Returns the given dictionary with fallback entries added for keys it lacks.
 Does not mutate the input.
 */
export function withTranslationFallback(dict: Record<string, string>): Record<string, string> {
	return {...fallback, ...dict};
}

(window as any).getItemDataFallback = getItemDataFallback;
(window as any).withTranslationFallback = withTranslationFallback;
