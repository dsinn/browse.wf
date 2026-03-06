import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { MOCK_TIMESTAMP, TEST_FRONT_PROXY_BASE_URL } from '../../test/helpers/test-constants';
import { isImageRequest } from '../../test/helpers/domain-blocker';

export { MOCK_TIMESTAMP };

const EXPORT_PLUS_DIR = path.join(process.cwd(), 'node_modules', 'warframe-public-export-plus');
const VALID_EXPORT_FILES = new Set(
  fs.readdirSync(EXPORT_PLUS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.slice(0, -5))
);

/**
 * Mocks warframe-public-export-plus/* endpoints with empty objects.
 *
 * Call this in beforeEach for tests that trigger export data fetches but don't assert on the
 * data itself — content is covered by Vitest unit tests using real export data. Without this,
 * tests load multi-MB JSON files from disk, causing flakiness under CI load.
 *
 * @param exportFiles - File names without extensions (e.g. 'ExportResources'). Must exist in
 *                      the warframe-public-export-plus package.
 */
export async function mockExportData(page: Page, exportFiles: string[]): Promise<void> {
  for (const exportFile of exportFiles) {
    if (!VALID_EXPORT_FILES.has(exportFile)) {
      throw new Error(`mockExportData: "${exportFile}" not found in warframe-public-export-plus. Valid files: ${[...VALID_EXPORT_FILES].sort().join(', ')}`);
    }
    await page.route(`**/warframe-public-export-plus/${exportFile}.json`, route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
  }
}

/**
 * Reloads the page and re-freezes the clock, since page.clock does not persist across reloads.
 */
export async function reloadWithFrozenClock(page: Page, timestamp: number = MOCK_TIMESTAMP): Promise<void> {
  await page.reload();
  await page.clock.install({ time: new Date(timestamp) });
  await page.clock.pauseAt(new Date(timestamp));
}

/**
 * Sets up mock routes for all oracle.browse.wf API endpoints used by E2E tests.
 *
 * This intercepts network requests and serves mock data from test/__mocks__/
 * instead of hitting real APIs, making tests faster, deterministic, and offline-capable.
 *
 * @param page - The Playwright page instance to set up routes on
 * @param options - Optional configuration
 * @param options.worldStateFile - Custom worldState mock file name (default: 'worldState.json')
 * @param options.freezeTime - Whether to freeze time (default: true)
 * @param options.frozenTime - Custom timestamp to freeze at (default: MOCK_TIMESTAMP)
 */
export async function setupMockRoutes(page: Page, options?: { worldStateFile?: string; freezeTime?: boolean; frozenTime?: number }): Promise<void> {
  // Freeze time for deterministic tests (unless explicitly disabled)
  // Use install() to mock setTimeout/setInterval as well (needed for incursions expiry logic)
  if (options?.freezeTime !== false) {
    const timeToFreeze = options?.frozenTime ?? MOCK_TIMESTAMP;
    await page.clock.install({ time: new Date(timeToFreeze) });
    await page.clock.pauseAt(new Date(timeToFreeze));
  }
  const mocksDir = path.join(process.cwd(), 'test', '__mocks__');

  // Load mock data
  const bountyCycleData = JSON.parse(fs.readFileSync(path.join(mocksDir, 'bounty-cycle.json'), 'utf8'));
  const worldStateFile = options?.worldStateFile || 'worldState.json';
  const worldStateData = JSON.parse(fs.readFileSync(path.join(mocksDir, worldStateFile), 'utf8'));
  const redtextData = JSON.parse(fs.readFileSync(path.join(mocksDir, 'redtext-empty.json'), 'utf8'));
  const dictEnData = JSON.parse(fs.readFileSync(path.join(mocksDir, 'dicts', 'en.json'), 'utf8'));

  // SAFEGUARD: Register catch-all FIRST (will be checked LAST due to reverse order)
  // Blocks all requests not handled by a specific mock above, except for localhost,
  // known CDN hosts, image requests (stubbed with an empty PNG), and /Lotus/ paths
  // (item/weapon lookups, stubbed with an empty object).
  await page.route('**/*', (route) => {
    const url = route.request().url();
    const { hostname } = new URL(url);

    const ALLOWED_EXTERNAL_HOSTS = [
      'localhost',
      '127.0.0.1',
      'cdn.jsdelivr.net',   // Bootstrap, table-sort-js
      'esm.sh',             // Supabase
      'pluto-lang.org',     // PlutoScript
    ];

    if (ALLOWED_EXTERNAL_HOSTS.includes(hostname)) {
      return route.continue();
    }

    if (isImageRequest(url)) {
      return route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from([]),
      });
    }

    // Lotus/* paths are item/weapon lookups - return empty object to avoid blocking tests
    if (url.includes('/Lotus/')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    }

    console.error(`TEST SAFEGUARD: Unregistered request — add a mock for: ${url}`);
    route.abort('failed');
  });

  // Now register specific mocks (these will be checked FIRST due to reverse order)

  // Prohibited Oracle endpoints — these were removed from the app; calls indicate a regression
  for (const path of ['/min', '/invasions', '/weekly', '/worldState*']) {
    await page.route(`**/oracle.browse.wf${path}`, route => {
      console.error(`TEST SAFEGUARD: Prohibited Oracle endpoint called: ${route.request().url()}`);
      route.abort('failed');
    });
  }

  // Mock oracle.browse.wf/bounty-cycle (used in live.ts:388)
  await page.route('**/oracle.browse.wf/bounty-cycle', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(bountyCycleData),
    });
  });

  // Mock the front proxy worldState endpoint (used by WarframeApiFrontProxyClient)
  await page.route(`**/${new URL(TEST_FRONT_PROXY_BASE_URL).host}/worldState`, route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(worldStateData),
    });
  });

  // Mock oracle.browse.wf/redtext.json (used in live.ts:841)
  await page.route('**/oracle.browse.wf/redtext.json', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(redtextData),
    });
  });

  // Mock oracle.browse.wf/dicts/en.json (dictionary requests)
  // Note: The query parameter (?9) is a cache-busting parameter, so we match with wildcard
  await page.route('**/oracle.browse.wf/dicts/en.json*', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(dictEnData),
    });
  });
}
