/**
 * Lazy singleton fetcher for warframe-public-export-plus JSON files.
 * Each export is fetched at most once per page load; subsequent calls
 * return the cached promise.
 */

export const exportCache = new Map<string, Promise<any>>();

export async function fetchExport(name: string): Promise<any> {
	let promise = exportCache.get(name);
	if (promise === undefined) {
		promise = fetch(`warframe-public-export-plus/${name}.json`).then(async r => r.json());
		exportCache.set(name, promise);
	}

	return promise;
}

// Expose globally for non-module scripts
if (globalThis.window !== undefined) {
	(globalThis as any).fetchExport = fetchExport;
}
