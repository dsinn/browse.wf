import {
	describe, test, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {loadMock, setupMockFetch} from '@test/helpers/api-mocks';
import {mockBootstrapTooltip} from '@test/helpers/dom-helpers';
import {testCardFilters} from '@test/live/card-filters-factory';
import {updateFissures} from './fissures';

// Test generic card filter integration for Fissures card
// This verifies: gear icon, accordion, checkboxes, localStorage persistence, auto-expand
testCardFilters('fissures');

describe('Void Fissures Card', () => {
	test('renders fissure data from worldState', () => {
		const worldState = loadMock('worldState.json');

		expect(worldState.ActiveMissions).toBeDefined();
		expect(Array.isArray(worldState.ActiveMissions)).toBe(true);
		expect(worldState.ActiveMissions.length).toBeGreaterThan(0);

		expect(worldState.VoidStorms).toBeDefined();
		expect(Array.isArray(worldState.VoidStorms)).toBe(true);
		expect(worldState.VoidStorms.length).toBeGreaterThan(0);
	});

	test('fissures within each tier are sorted by expiry in chronological order', () => {
		const worldState = loadMock('worldState.json');

		// Combine ActiveMissions and VoidStorms into fissures array, mimicking live.ts logic
		const fissures = [];

		for (const fissure of worldState.ActiveMissions) {
			fissures.push({
				Category: fissure.Hard ? 'sp-fissures' : 'fissures',
				Hard: fissure.Hard,
				Activation: fissure.Activation,
				Expiry: fissure.Expiry,
				Node: fissure.Node,
				Modifier: fissure.Modifier,
			});
		}

		for (const fissure of worldState.VoidStorms) {
			fissures.push({
				Category: 'rj-fissures',
				Hard: false,
				Activation: fissure.Activation,
				Expiry: fissure.Expiry,
				Node: fissure.Node,
				Modifier: fissure.ActiveMissionTier,
			});
		}

		// Sort by tier first, then by expiry within each tier (same logic as live.ts)
		fissures.sort((a, b) => {
			const tierDiff = (a.Modifier.codePointAt(5) ?? 0) - (b.Modifier.codePointAt(5) ?? 0);
			if (tierDiff !== 0) {
				return tierDiff;
			}

			return Number.parseInt(a.Expiry.$date.$numberLong, 10) - Number.parseInt(b.Expiry.$date.$numberLong, 10);
		});

		// Group by tier and Hard mode to verify chronological ordering
		const tierGroups: Record<string, any[]> = {};
		for (const fissure of fissures) {
			const key = `${fissure.Hard ? 'SP-' : ''}${String(fissure.Modifier)}`;
			tierGroups[key] ||= [];

			tierGroups[key].push(fissure);
		}

		// Verify each tier group is sorted chronologically by expiry
		for (const [tier, group] of Object.entries(tierGroups)) {
			if (group.length <= 1) {
				continue; // Single-item groups are trivially sorted
			}

			const expiries = group.map(f => Number.parseInt(f.Expiry.$date.$numberLong, 10));

			// Check that each expiry is <= the next one (chronological order)
			for (let i = 0; i < expiries.length - 1; i++) {
				expect(expiries[i]).toBeLessThanOrEqual(expiries[i + 1]);
			}

			// Additional verification: compare with a sorted copy
			const sortedExpiries = [...expiries].sort((a: number, b: number) => a - b);
			expect(expiries).toEqual(sortedExpiries);
		}
	});

	test('identifies missions with unsorted expiries in mock data', () => {
		const worldState = loadMock('worldState.json');

		// Group missions by tier WITHOUT sorting to see original order
		const byTierAndMode: Record<string, string[]> = {};

		for (const m of worldState.ActiveMissions as any[]) {
			const key = `${m.Hard ? 'SP-' : ''}${String(m.Modifier)}`;
			byTierAndMode[key] ||= [];
			byTierAndMode[key].push(m.Expiry.$date.$numberLong);
		}

		for (const m of worldState.VoidStorms as any[]) {
			const key = `RJ-${String(m.ActiveMissionTier)}`;
			byTierAndMode[key] ||= [];
			byTierAndMode[key].push(m.Expiry.$date.$numberLong);
		}

		// Find at least one tier with unsorted missions
		let foundUnsorted = false;
		for (const [tier, expiries] of Object.entries(byTierAndMode)) {
			if (expiries.length <= 1) {
				continue;
			}

			const sorted = [...expiries].sort((a: string, b: string) => Number.parseInt(a, 10) - Number.parseInt(b, 10));
			const alreadySorted = JSON.stringify(expiries) === JSON.stringify(sorted);

			if (!alreadySorted) {
				foundUnsorted = true;
				// Verify specific tiers we know are unsorted from our analysis
				if (tier === 'SP-VoidT2' || tier === 'SP-VoidT3' || tier === 'VoidT4' || tier === 'VoidT5') {
					expect(alreadySorted).toBe(false);
				}
			}
		}

		// Ensure the mock data actually has unsorted missions to test the sorting logic
		expect(foundUnsorted).toBe(true);
	});

	test('has correct tier labels', () => {
		const worldState = loadMock('worldState.json');

		const fissureTiers = {
			VoidT1: 'Lith',
			VoidT2: 'Meso',
			VoidT3: 'Neo',
			VoidT4: 'Axi',
			VoidT5: 'Requiem',
			VoidT6: 'Omnia',
		};

		// Check that all modifiers in mock data have corresponding tier labels
		const allModifiers = new Set([
			...worldState.ActiveMissions.map((m: any) => m.Modifier),
			...worldState.VoidStorms.map((m: any) => m.ActiveMissionTier),
		]);

		for (const modifier of allModifiers) {
			expect(fissureTiers).toHaveProperty(modifier);
		}
	});

	test('separates normal, steel path, and void storms correctly', () => {
		const worldState = loadMock('worldState.json');

		const normalFissures = worldState.ActiveMissions.filter((m: any) => !m.Hard);
		const steelPathFissures = worldState.ActiveMissions.filter((m: any) => m.Hard);
		const voidStorms = worldState.VoidStorms;

		expect(normalFissures.length).toBeGreaterThan(0);
		expect(steelPathFissures.length).toBeGreaterThan(0);
		expect(voidStorms.length).toBeGreaterThan(0);

		// Verify they're mutually exclusive
		expect(normalFissures.every((m: any) => !m.Hard)).toBe(true);
		expect(steelPathFissures.every((m: any) => m.Hard)).toBe(true);
	});
});

describe('Void Fissures - updateFissures rendering', () => {
	beforeEach(() => {
		setupMockFetch();
		mockBootstrapTooltip();
		localStorage.clear();

		(globalThis as any).worldState = loadMock('worldState.json');
		(globalThis as any).fissureTiers = {
			VoidT1: 'Lith', VoidT2: 'Meso', VoidT3: 'Neo', VoidT4: 'Axi', VoidT5: 'Requiem', VoidT6: 'Omnia',
		};
		(globalThis as any).toTitleCase = (s: string) => s.replaceAll(/\b\w/gu, c => c.toUpperCase());
		(globalThis as any).createExpiryBadge = () => document.createElement('span');

		// Freeze time to within the mock worldState's fissure active window (Jan 11 2026 06:30 UTC)
		vi.useFakeTimers();
		vi.setSystemTime(1_768_131_600_000);
	});

	afterEach(() => {
		vi.useRealTimers();
		localStorage.clear();
		delete (globalThis as any).worldState;
		delete (globalThis as any).fissureTiers;
		delete (globalThis as any).toTitleCase;
		delete (globalThis as any).createExpiryBadge;
	});

	test('renders fissure rows with tier labels into fissures-table', async () => {
		await updateFissures(true);
		const tbody = document.querySelector('#fissures-table tbody');
		expect(tbody).toBeTruthy();
		const headings = [...tbody!.querySelectorAll('th')].map(th => th.textContent).filter(Boolean);
		expect(headings.length).toBeGreaterThan(0);
		// All headings should be known tier labels
		const knownTiers = new Set(['Lith', 'Meso', 'Neo', 'Axi', 'Requiem', 'Omnia']);
		for (const h of headings) {
			expect(knownTiers.has(h), `Unknown tier label: ${h}`).toBe(true);
		}
	});

	test('each row has mission name and location cells', async () => {
		await updateFissures(true);
		const tbody = document.querySelector('#fissures-table tbody');
		const rows = [...tbody!.querySelectorAll('tr')];
		// Skip the empty-state row if present
		const dataRows = rows.filter(tr => !tr.querySelector('td[colspan]') && tr.querySelectorAll('td').length >= 3);
		expect(dataRows.length).toBeGreaterThan(0);
		for (const row of dataRows) {
			const cells = row.querySelectorAll('td');
			// Mission name cell (index 1) should have text
			expect(cells[1]?.textContent?.trim(), 'mission name').toBeTruthy();
			// Location cell (index 3) should contain a comma
			expect(cells[3]?.textContent, 'location').toMatch(/,/u);
		}
	});

	test('tier heading appears once per tier in a category', async () => {
		await updateFissures(true);
		const tbody = document.querySelector('#fissures-table tbody');
		const headings = [...tbody!.querySelectorAll('th')].map(th => th.textContent).filter(Boolean);
		// Each heading should be unique (tier rendered only on first row of that tier)
		expect(new Set(headings).size).toBe(headings.length);
	});

	test('unchecking a tier filter removes that tier heading and its rows', async () => {
		// Disable Lith (VoidT1)
		localStorage.setItem('live.filter.fissures.VoidT1', '0');
		await updateFissures(true);

		const tbody = document.querySelector('#fissures-table tbody');
		const headings = [...tbody!.querySelectorAll('th')].map(th => th.textContent).filter(Boolean);
		expect(headings).not.toContain('Lith');
	});

	test('unchecking a tier still shows other tier headings', async () => {
		localStorage.setItem('live.filter.fissures.VoidT1', '0');
		await updateFissures(true);

		const tbody = document.querySelector('#fissures-table tbody');
		const headings = [...tbody!.querySelectorAll('th')].map(th => th.textContent).filter(Boolean);
		// Other tiers present in mock data should still appear
		expect(headings.some(h => h !== 'Lith')).toBe(true);
	});

	test('when all tiers are unchecked, shows empty-state message', async () => {
		for (const tier of ['VoidT1', 'VoidT2', 'VoidT3', 'VoidT4', 'VoidT5', 'VoidT6']) {
			localStorage.setItem(`live.filter.fissures.${tier}`, '0');
		}

		await updateFissures(true);

		const tbody = document.querySelector('#fissures-table tbody');
		expect(tbody!.textContent).toContain('No missions to display based on the current filters.');
		const headings = [...tbody!.querySelectorAll('th')].filter(th => th.textContent);
		expect(headings.length).toBe(0);
	});

	test('location cell has tileset tooltip on abbr element', async () => {
		await updateFissures(true);
		const tbody = document.querySelector('#fissures-table tbody');
		const rows = tbody!.querySelectorAll('tr');
		expect(rows.length).toBeGreaterThan(0);

		const locationCell = rows[0].querySelectorAll('td')[3];
		const abbr = locationCell?.querySelector('abbr');
		expect(abbr, 'location should be wrapped in <abbr> with tileset tooltip').toBeTruthy();
		const title = abbr!.dataset.bsTitle;
		expect(title, 'tileset tooltip should be non-empty').toBeTruthy();
	});
});
