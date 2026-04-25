/**
 * Lazy singleton fetcher for warframe-public-export-plus JSON files.
 * Each export is fetched at most once per page load; subsequent calls
 * return the cached promise.
 *
 * Context-aware:
 *   - Browser: fetches via HTTP (warframe-public-export-plus/<name>.json)
 *   - Node.js: imports directly from the warframe-public-export-plus package
 */

export const exportCache = new Map<string, Promise<any>>();

async function fetchExportBrowser(name: string): Promise<any> {
	return fetch(`warframe-public-export-plus/${name}.json`).then(async r => r.json());
}

async function fetchExportNode(name: string): Promise<any> {
	const pkg = await import('warframe-public-export-plus');
	return (pkg as any)[name];
}

const isBrowser = typeof document !== 'undefined';
const fetchExportImpl = isBrowser ? fetchExportBrowser : fetchExportNode;

export async function fetchExport(name: string): Promise<any> {
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
