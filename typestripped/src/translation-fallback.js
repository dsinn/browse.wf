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
export function getItemDataFallback(uniqueName) {
    const name = fallback[uniqueName];
    return typeof name === 'string' ? Promise.resolve({ name }) : undefined;
}
/**
 Returns the given dictionary with fallback entries added for keys it lacks.
 Does not mutate the input.
 */
export function withTranslationFallback(dict) {
    return { ...fallback, ...dict };
}
window.getItemDataFallback = getItemDataFallback;
window.withTranslationFallback = withTranslationFallback;
//# sourceMappingURL=translation-fallback.js.map