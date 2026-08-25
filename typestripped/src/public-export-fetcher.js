/**
 * Lazy singleton fetcher for warframe-public-export-plus JSON files.
 * Each export is fetched at most once per page load; subsequent calls
 * return the cached promise.
 *
 * Context-aware:
 *   - Browser: fetches via HTTP (warframe-public-export-plus/<name>.json)
 *   - Node.js: imports directly from the warframe-public-export-plus package
 */
export const exportCache = new Map();
async function fetchExportBrowser(name) {
    return fetch(`warframe-public-export-plus/${name}.json`).then(async (r) => r.json());
}
async function fetchExportNode(name) {
    const pkg = await import('warframe-public-export-plus');
    return pkg[name];
}
const isBrowser = typeof document !== 'undefined';
const fetchExportImpl = isBrowser ? fetchExportBrowser : fetchExportNode;
export async function fetchExport(name) {
    let promise = exportCache.get(name);
    if (promise === undefined) {
        promise = fetchExportImpl(name);
        exportCache.set(name, promise);
    }
    return promise;
}
if (isBrowser) {
    window.fetchExport = fetchExport;
}
//# sourceMappingURL=public-export-fetcher.js.map