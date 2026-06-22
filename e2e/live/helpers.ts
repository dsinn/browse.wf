import {type Locator, type Page} from '@playwright/test';
import {mockExportData} from '../helpers/api-mocks';

// All warframe-public-export-plus files fetched by live.ts that are large enough to cause
// CI flakiness under parallel load. E2E tests don't assert on export data content —
// that's covered by Vitest unit tests.
const LIVE_EXPORT_FILES = [
	// Sizes are approximate
	'dict.en', // 4 MB
	'ExportBoosterPacks', // 135 KB
	'ExportBundles', // 1 MB
	'ExportChallenges', // 220 KB
	'ExportGear', // 78 KB
	'ExportImages', // 2 MB
	'ExportRegions', // 330 KB
	'ExportResources', // 2 MB
];

/**
 * Returns a locator for the expiry badge within a given element.
 */
export function expiryBadge(element: Locator): Locator {
	return element.locator('.badge[data-expiry]');
}

/**
 * Mocks all large warframe-public-export-plus files fetched by live.ts with empty objects.
 *
 * @param page - The Playwright page instance
 * @param options.skip - File names to skip mocking (e.g. when a test asserts on that data)
 */
export async function mockLiveExports(page: Page, options?: {skip?: string[]}): Promise<void> {
	const skip = new Set(options?.skip);
	const files = LIVE_EXPORT_FILES.filter(f => !skip.has(f));
	await mockExportData(page, files);
}
