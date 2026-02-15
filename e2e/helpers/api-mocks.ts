import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { MOCK_TIMESTAMP } from '../../test/helpers/test-constants';
import { isBlockedDomain, isImageRequest } from '../../test/helpers/domain-blocker';

export { MOCK_TIMESTAMP };

/**
 * Sets up mock routes for all oracle.browse.wf API endpoints used by E2E tests.
 *
 * This intercepts network requests and serves mock data from test/__mocks__/
 * instead of hitting real APIs, making tests faster, deterministic, and offline-capable.
 *
 * @param page - The Playwright page instance to set up routes on
 * @param options - Optional configuration
 * @param options.worldStateFile - Custom worldState mock file name (default: 'worldState.json')
 * @param options.freezeTime - Whether to freeze time at MOCK_TIMESTAMP (default: true)
 */
export async function setupMockRoutes(page: Page, options?: { worldStateFile?: string; freezeTime?: boolean }): Promise<void> {
  // Freeze time for deterministic tests (unless explicitly disabled)
  // Use install() to mock setTimeout/setInterval as well (needed for incursions expiry logic)
  if (options?.freezeTime !== false) {
    await page.clock.install({ time: new Date(MOCK_TIMESTAMP) });
    await page.clock.pauseAt(new Date(MOCK_TIMESTAMP));
  }
  const mocksDir = path.join(process.cwd(), 'test', '__mocks__');

  // Load mock data
  const minData = JSON.parse(fs.readFileSync(path.join(mocksDir, 'min.json'), 'utf8'));
  const bountyCycleData = JSON.parse(fs.readFileSync(path.join(mocksDir, 'bounty-cycle.json'), 'utf8'));
  const worldStateFile = options?.worldStateFile || 'worldState.json';
  const worldStateData = JSON.parse(fs.readFileSync(path.join(mocksDir, worldStateFile), 'utf8'));
  const invasionsData = JSON.parse(fs.readFileSync(path.join(mocksDir, 'invasions.json'), 'utf8'));
  const redtextData = JSON.parse(fs.readFileSync(path.join(mocksDir, 'redtext-empty.json'), 'utf8'));
  const dictEnData = JSON.parse(fs.readFileSync(path.join(mocksDir, 'dicts', 'en.json'), 'utf8'));

  // SAFEGUARD: Register catch-all FIRST (will be checked LAST due to reverse order)
  // This blocks unmocked requests to production browse.wf domains
  await page.route('**/*', (route) => {
    const url = route.request().url();

    // Only intercept browse.wf domains
    if (!isBlockedDomain(url)) {
      // Not a blocked domain - let it through to localhost
      return route.continue();
    }

    // This is a blocked domain that wasn't handled by specific routes below
    if (isImageRequest(url)) {
      // Image requests: silently fulfill with empty response
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

    // Non-image, non-Lotus request to production domain - this is an error
    console.error(`TEST SAFEGUARD: Blocked request to production domain: ${url}`);
    route.abort('failed');
  });

  // Now register specific mocks (these will be checked FIRST due to reverse order)

  // Mock oracle.browse.wf/min (used in live.ts:794, 828)
  await page.route('**/oracle.browse.wf/min', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(minData),
    });
  });

  // Mock oracle.browse.wf/bounty-cycle (used in live.ts:388)
  await page.route('**/oracle.browse.wf/bounty-cycle', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(bountyCycleData),
    });
  });

  // Mock oracle.browse.wf/weekly - no longer used (removed in favor of worldState.Conquests)
  // Route left in place to catch any unexpected calls
  await page.route('**/oracle.browse.wf/weekly', route => {
    route.abort('failed');
  });

  // Mock oracle.browse.wf/worldState.json (used in live.ts:868)
  await page.route('**/oracle.browse.wf/worldState.json', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(worldStateData),
    });
  });

  // Mock oracle.browse.wf/invasions (used in live.ts:1484)
  await page.route('**/oracle.browse.wf/invasions', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(invasionsData),
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
