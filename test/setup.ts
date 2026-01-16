import { beforeEach } from 'vitest';
import { loadFixture } from './helpers/fixture-loader';
import { setupMockFetch } from './helpers/api-mocks';
import { freezeTime } from './helpers/time-helpers';

// Mock global objects that live.ts expects
declare global {
  interface Window {
    LIVE_VERSION: number;
    dict: Record<string, string>;
    osdict: Record<string, string>;
    ExportRegions: any;
    ExportChallenges: any;
    ExportMissionTypes: any;
    ExportFactions: any;
  }
}

beforeEach(() => {
  // Skip setup for API validation tests (they need real fetch)
  if (process.env.API_VALIDATION) {
    return;
  }

  // Setup DOM structure from actual live.php
  document.body.innerHTML = loadFixture('live');

  // Setup API mocks
  setupMockFetch();

  // Freeze time for predictable tests
  freezeTime();

  // Mock window globals
  window.LIVE_VERSION = 0;
  window.dict = {};
  window.osdict = {};
  window.ExportRegions = {};
  window.ExportChallenges = {};
  window.ExportMissionTypes = {};
  window.ExportFactions = {};
});
