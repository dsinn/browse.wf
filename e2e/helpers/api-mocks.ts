import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { MOCK_TIMESTAMP } from '../../test/helpers/test-constants';

export { MOCK_TIMESTAMP };

/**
 * Sets up mock routes for all oracle.browse.wf API endpoints used by E2E tests.
 *
 * This intercepts network requests and serves mock data from test/__mocks__/
 * instead of hitting real APIs, making tests faster, deterministic, and offline-capable.
 *
 * @param page - The Playwright page instance to set up routes on
 */
export async function setupMockRoutes(page: Page): Promise<void> {
  // Freeze time for deterministic tests
  // Use install() to mock setTimeout/setInterval as well (needed for incursions expiry logic)
  await page.clock.install({ time: new Date(MOCK_TIMESTAMP) });
  await page.clock.pauseAt(new Date(MOCK_TIMESTAMP));
  const mocksDir = path.join(process.cwd(), 'test', '__mocks__');

  // Load mock data
  const minData = JSON.parse(fs.readFileSync(path.join(mocksDir, 'min.json'), 'utf8'));
  const bountyCycleData = JSON.parse(fs.readFileSync(path.join(mocksDir, 'bounty-cycle.json'), 'utf8'));
  const weeklyData = JSON.parse(fs.readFileSync(path.join(mocksDir, 'weekly.json'), 'utf8'));
  const worldStateData = JSON.parse(fs.readFileSync(path.join(mocksDir, 'worldState.json'), 'utf8'));
  const invasionsData = JSON.parse(fs.readFileSync(path.join(mocksDir, 'invasions.json'), 'utf8'));
  const redtextData = JSON.parse(fs.readFileSync(path.join(mocksDir, 'redtext-empty.json'), 'utf8'));

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

  // Mock oracle.browse.wf/weekly (used in live.ts:609)
  await page.route('**/oracle.browse.wf/weekly', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(weeklyData),
    });
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
}
