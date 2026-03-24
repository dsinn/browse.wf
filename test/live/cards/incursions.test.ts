/**
 * Tests for Steel Path Incursions card
 */
import {
	describe, test, expect, beforeEach, afterEach,
} from 'vitest';
import {getById, mockBootstrapTooltip} from '../../helpers/dom-helpers';
import {setupMockFetch, loadExportJson} from '../../helpers/api-mocks';
import {testCardFilters} from '../card-filters-factory';
import {updateIncursionsLocalised} from '../../../src/live/incursions';

// Test generic card filter integration for Incursions card
// This verifies: gear icon, accordion, checkboxes, localStorage persistence, auto-expand
testCardFilters('incursions');

describe('Incursions Card - DOM Structure', () => {
	test('incursions body element exists', () => {
		const incursionsBody = getById('incursions-body');
		expect(incursionsBody).toBeTruthy();
	});

	test('incursions body has six placeholder spans', () => {
		const spans = document.querySelectorAll('#incursions-body span.d-block');
		// Live.php renders 6 spans (one per incursion slot)
		expect(spans.length).toBe(6);
	});

	test('empty message element exists and is hidden by default', () => {
		const message = getById('incursions-empty-message');
		expect(message).toBeTruthy();
		expect(message.classList.contains('d-none')).toBe(true);
	});

	test('filter panel has checkboxes for all expected mission types', () => {
		const expectedTypes = [
			'MT_ALCHEMY',
			'MT_ASCENSION',
			'MT_ASSASSINATION',
			'MT_ASSAULT',
			'MT_CAPTURE',
			'MT_EVACUATION',
			'MT_DEFENSE',
			'MT_ARTIFACT',
			'MT_EXCAVATE',
			'MT_EXTERMINATION',
			'MT_RETRIEVAL',
			'MT_HIVE',
			'MT_PURIFY',
			'MT_TERRITORY',
			'MT_MOBILE_DEFENSE',
			'MT_PURSUIT',
			'MT_RESCUE',
			'MT_RUSH',
			'MT_SABOTAGE',
			'MT_OFFERING',
			'MT_SPY',
			'MT_SURVIVAL',
			'MT_ARMAGEDDON',
			'MT_VOID_CASCADE',
			'MT_CORRUPTION',
		];
		for (const type of expectedTypes) {
			const checkbox = document.querySelector(`#incursions-filters input[data-filter-type="${type}"]`);
			expect(checkbox, `Expected checkbox for ${type}`).toBeTruthy();
		}
	});
});

// Six nodes from ExportRegions with varied mission types; SolNode225 is MT_INTEL (tests canonicalization)
const MOCK_INCURSIONS_TODAY = ['SolNode94', 'SolNode130', 'SolNode119', 'SolNode12', 'SolNode103', 'SolNode225'];

function setupIncursionsGlobals() {
	setupMockFetch();
	mockBootstrapTooltip();

	(globalThis as any).incursions_today = MOCK_INCURSIONS_TODAY;
	(globalThis as any).incursions_expiry = Date.now() + 86_400_000;

	(globalThis as any).toTitleCase = (s: string) => s
		.split(' ')
		.map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
		.join(' ');

	(globalThis as any).addTooltip = (element: HTMLElement, title: string) => {
		element.dataset.bsTitle = title;
	};

	(globalThis as any).setDatum = (name: string, value: string) => {
		const element = document.querySelector(`#${name}`);
		if (element) {
			element.textContent = value;
		}
	};

	(globalThis as any).getTileset = (node: any) => node.tileset ?? '';
	(globalThis as any).formatTileset = (tileset: string) => tileset.replace('Tileset', '').trim();
}

describe('Incursions Card - updateIncursionsLocalised', () => {
	beforeEach(() => {
		setupIncursionsGlobals();
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
		delete (globalThis as any).incursions_today;
		delete (globalThis as any).incursions_expiry;
		delete (globalThis as any).toTitleCase;
		delete (globalThis as any).addTooltip;
		delete (globalThis as any).setDatum;
		delete (globalThis as any).getTileset;
		delete (globalThis as any).formatTileset;
	});

	test('renders all six incursion slots when no filters are set', async () => {
		await updateIncursionsLocalised();
		const visibleSpans = document.querySelectorAll('#incursions-body span.d-block:not(.d-none)');
		expect(visibleSpans.length).toBe(6);
	});

	test('each rendered slot has a location text with comma-separated node and system name', async () => {
		await updateIncursionsLocalised();
		const ExportRegions = loadExportJson('ExportRegions.json');
		const dict = loadExportJson('dict.en.json');

		const spans = document.querySelectorAll('#incursions-body span.d-block:not(.d-none)');
		expect(spans.length).toBeGreaterThan(0);

		for (const span of spans) {
			// Each span should contain location text "NodeName, SystemName"
			const abbr = span.querySelector('abbr');
			expect(abbr, 'abbr element for location').toBeTruthy();
			expect(abbr!.textContent).toMatch(/^.+, .+$/u);
		}
	});

	test('empty message is hidden when all slots are visible', async () => {
		await updateIncursionsLocalised();
		const emptyMessage = document.querySelector('#incursions-empty-message');
		expect(emptyMessage?.classList.contains('d-none')).toBe(true);
	});

	test('unchecking a mission type filter hides matching incursion slots', async () => {
		await updateIncursionsLocalised();
		const ExportRegions = loadExportJson('ExportRegions.json');

		// Find what mission type the first slot has
		const firstNode = ExportRegions[MOCK_INCURSIONS_TODAY[0]];
		const missionType = firstNode.missionType === 'MT_INTEL' ? 'MT_SPY' : firstNode.missionType;

		// Disable that mission type
		localStorage.setItem(`live.filter.incursions.${missionType}`, '0');
		await updateIncursionsLocalised();

		// Count how many slots have that mission type (should all be hidden)
		let expectedHidden = 0;
		for (const nodeId of MOCK_INCURSIONS_TODAY) {
			const node = ExportRegions[nodeId];
			const mt = node.missionType === 'MT_INTEL' ? 'MT_SPY' : node.missionType;
			if (mt === missionType) {
				expectedHidden++;
			}
		}

		const hiddenSpans = document.querySelectorAll('#incursions-body span.d-block.d-none');
		expect(hiddenSpans.length).toBe(expectedHidden);
	});

	test('empty message shown when all mission types are filtered out', async () => {
		// Disable all 25 mission types
		const allMissionTypes = [
			'MT_ALCHEMY',
			'MT_ASCENSION',
			'MT_ASSASSINATION',
			'MT_ASSAULT',
			'MT_CAPTURE',
			'MT_EVACUATION',
			'MT_DEFENSE',
			'MT_ARTIFACT',
			'MT_EXCAVATE',
			'MT_EXTERMINATION',
			'MT_RETRIEVAL',
			'MT_HIVE',
			'MT_PURIFY',
			'MT_TERRITORY',
			'MT_MOBILE_DEFENSE',
			'MT_PURSUIT',
			'MT_RESCUE',
			'MT_RUSH',
			'MT_SABOTAGE',
			'MT_OFFERING',
			'MT_SPY',
			'MT_SURVIVAL',
			'MT_ARMAGEDDON',
			'MT_VOID_CASCADE',
			'MT_CORRUPTION',
		];
		for (const mt of allMissionTypes) {
			localStorage.setItem(`live.filter.incursions.${mt}`, '0');
		}

		await updateIncursionsLocalised();

		expect(document.querySelectorAll('#incursions-body span.d-block:not(.d-none)').length).toBe(0);
		expect(document.querySelector('#incursions-empty-message')?.classList.contains('d-none')).toBe(false);
	});

	test('MT_INTEL is treated as MT_SPY for filter purposes', async () => {
		const ExportRegions = loadExportJson('ExportRegions.json');

		// Find a node with MT_INTEL if one exists in our test set, else skip with a note
		const intelNode = MOCK_INCURSIONS_TODAY.find(id => ExportRegions[id]?.missionType === 'MT_INTEL');

		if (!intelNode) {
			// No MT_INTEL in current test nodes — just verify the filter key used is MT_SPY for spy nodes
			const spyNode = MOCK_INCURSIONS_TODAY.find(id => ExportRegions[id]?.missionType === 'MT_SPY');
			if (spyNode) {
				localStorage.setItem('live.filter.incursions.MT_SPY', '0');
				await updateIncursionsLocalised();
				const idx = MOCK_INCURSIONS_TODAY.indexOf(spyNode);
				const span = document.querySelectorAll('#incursions-body span.d-block')[idx];
				expect((span as HTMLElement).classList.contains('d-none')).toBe(true);
			}

			return;
		}

		// Disabling MT_SPY should also hide MT_INTEL nodes
		localStorage.setItem('live.filter.incursions.MT_SPY', '0');
		await updateIncursionsLocalised();
		const idx = MOCK_INCURSIONS_TODAY.indexOf(intelNode);
		const span = document.querySelectorAll('#incursions-body span.d-block')[idx];
		expect((span as HTMLElement).classList.contains('d-none')).toBe(true);
	});
});
