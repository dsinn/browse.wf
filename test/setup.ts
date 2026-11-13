import process from 'node:process';
import {beforeAll, beforeEach} from 'vitest';
import {loadFixture} from './helpers/fixture-loader';
import {loadExportJson, setupMockFetch} from './helpers/api-mocks';
import {freezeTime} from './helpers/time-helpers';

beforeAll(() => {
	if (process.env.API_VALIDATION) {
		return;
	}

	window.scrollTo = () => {
		// Suppress jsdom "Not implemented" warnings; only Playwright would ever care about scrolling
	};

	// The jsdom library doesn't implement Element#getHTML(). The tests have no shadow roots, so it's equivalent to the
	// innerHTML getter (read through its descriptor, since the polyfill is what the lint rule steers code towards).
	const getInnerHtml = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')!.get!;
	Element.prototype.getHTML ??= function (this: Element) {
		return getInnerHtml.call(this) as string;
	};

	(globalThis as any).dict = {};
	(globalThis as any).osdict = {};
	(globalThis as any).ExportRegions = loadExportJson('ExportRegions.json');
	(globalThis as any).ExportChallenges = loadExportJson('ExportChallenges.json');
	(globalThis as any).ExportMissionTypes = loadExportJson('ExportMissionTypes.json');
	(globalThis as any).ExportFactions = loadExportJson('ExportFactions.json');
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
