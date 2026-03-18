import process from 'node:process';
import {beforeAll, beforeEach} from 'vitest';
import {loadFixture} from './helpers/fixture-loader';
import {loadExportJson, setupMockFetch} from './helpers/api-mocks';
import {freezeTime} from './helpers/time-helpers';

// Mock global objects that live.ts expects
declare global {
	type Window = {
		LIVE_VERSION: number;
		dict: Record<string, string>;
		osdict: Record<string, string>;
		ExportRegions: any;
		ExportChallenges: any;
		ExportMissionTypes: any;
		ExportFactions: any;
	};
}

beforeAll(() => {
	if (process.env.API_VALIDATION) {
		return;
	}

	globalThis.LIVE_VERSION = 0;
	globalThis.dict = {};
	globalThis.osdict = {};
	globalThis.ExportRegions = loadExportJson('ExportRegions.json');
	globalThis.ExportChallenges = loadExportJson('ExportChallenges.json');
	globalThis.ExportMissionTypes = loadExportJson('ExportMissionTypes.json');
	globalThis.ExportFactions = loadExportJson('ExportFactions.json');
});

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
});
