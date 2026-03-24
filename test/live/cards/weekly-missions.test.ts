import {
	describe, test, expect, beforeEach, afterEach,
} from 'vitest';
import {getById} from '../../helpers/dom-helpers';
import {testCardFilters} from '../card-filters-factory';
import {filterWeeklyMissions} from '../../../src/live/weekly';

// Test generic card filter integration for Weekly Missions card
// This verifies: gear icon, accordion, checkboxes, localStorage persistence, auto-expand
testCardFilters('weekly-missions');

describe('Weekly Missions Card', () => {
	test('weekly missions elements exist', () => {
		const clemCheck = getById('clem-check');
		const marooCheck = getById('maroo-check');
		const circuitFrames = getById('circuit-frames');
		const circuitWeapons = getById('circuit-weapons');
		const netracellChecks = getById('netracell-checks');
		const kahlChecks = getById('kahl-checks');

		expect(clemCheck).toBeTruthy();
		expect(marooCheck).toBeTruthy();
		expect(circuitFrames).toBeTruthy();
		expect(circuitWeapons).toBeTruthy();
		expect(netracellChecks).toBeTruthy();
		expect(kahlChecks).toBeTruthy();
	});

	test('circuit header exists', () => {
		const circuitHeader = getById('circuit-header');
		expect(circuitHeader).toBeTruthy();
	});

	test('mission entries have data-mission attributes', () => {
		const card = document.querySelector('[data-collapse-toggle="weekly-missions"]')?.closest('.card');
		const entries = card?.querySelectorAll('[data-mission]');

		expect(entries).toBeTruthy();
		expect(entries!.length).toBe(6);

		const missions = [...entries!].map(entry => (entry as HTMLElement).dataset.mission);
		expect(missions).toContain('clem');
		expect(missions).toContain('maroo');
		expect(missions).toContain('circuit-normal');
		expect(missions).toContain('circuit-sp');
		expect(missions).toContain('netracells');
		expect(missions).toContain('kahl');
	});
});

describe('Weekly Missions Filtering', () => {
	const missions = ['clem', 'maroo', 'circuit-normal', 'circuit-sp', 'netracells', 'kahl'];

	beforeEach(() => {
		localStorage.clear();
		// All missions visible by default (no filter set)
		filterWeeklyMissions();
	});

	afterEach(() => {
		localStorage.clear();
	});

	test('all missions visible by default', () => {
		for (const mission of missions) {
			const element = document.querySelector<HTMLElement>(`[data-mission="${mission}"]`);
			expect(element?.style.display, mission).not.toBe('none');
		}
	});

	test('unchecking a mission hides it', () => {
		localStorage.setItem('live.filter.weekly-missions.clem', '0');
		filterWeeklyMissions();

		const clem = document.querySelector<HTMLElement>('[data-mission="clem"]');
		expect(clem?.style.display).toBe('none');
	});

	test('unchecked mission does not affect other missions', () => {
		localStorage.setItem('live.filter.weekly-missions.clem', '0');
		filterWeeklyMissions();

		for (const mission of missions.filter(m => m !== 'clem')) {
			const element = document.querySelector<HTMLElement>(`[data-mission="${mission}"]`);
			expect(element?.style.display, mission).not.toBe('none');
		}
	});

	test('unchecking multiple missions hides all of them', () => {
		localStorage.setItem('live.filter.weekly-missions.clem', '0');
		localStorage.setItem('live.filter.weekly-missions.maroo', '0');
		localStorage.setItem('live.filter.weekly-missions.netracells', '0');
		filterWeeklyMissions();

		expect(document.querySelector<HTMLElement>('[data-mission="clem"]')?.style.display).toBe('none');
		expect(document.querySelector<HTMLElement>('[data-mission="maroo"]')?.style.display).toBe('none');
		expect(document.querySelector<HTMLElement>('[data-mission="netracells"]')?.style.display).toBe('none');
		expect(document.querySelector<HTMLElement>('[data-mission="circuit-normal"]')?.style.display).not.toBe('none');
		expect(document.querySelector<HTMLElement>('[data-mission="circuit-sp"]')?.style.display).not.toBe('none');
		expect(document.querySelector<HTMLElement>('[data-mission="kahl"]')?.style.display).not.toBe('none');
	});

	test('rechecking a mission shows it again', () => {
		localStorage.setItem('live.filter.weekly-missions.circuit-normal', '0');
		filterWeeklyMissions();
		expect(document.querySelector<HTMLElement>('[data-mission="circuit-normal"]')?.style.display).toBe('none');

		localStorage.setItem('live.filter.weekly-missions.circuit-normal', '1');
		filterWeeklyMissions();
		expect(document.querySelector<HTMLElement>('[data-mission="circuit-normal"]')?.style.display).not.toBe('none');
	});

	test('empty state hidden when at least one mission is visible', () => {
		filterWeeklyMissions();
		const emptyState = document.querySelector('#weekly-missions-empty-state');
		expect(emptyState?.classList.contains('d-none')).toBe(true);
	});

	test('empty state shown when all missions are hidden', () => {
		for (const mission of missions) {
			localStorage.setItem(`live.filter.weekly-missions.${mission}`, '0');
		}

		filterWeeklyMissions();

		const emptyState = document.querySelector('#weekly-missions-empty-state');
		expect(emptyState?.classList.contains('d-none')).toBe(false);
	});

	test('empty state hidden again when a mission is re-enabled', () => {
		for (const mission of missions) {
			localStorage.setItem(`live.filter.weekly-missions.${mission}`, '0');
		}

		filterWeeklyMissions();
		expect(document.querySelector('#weekly-missions-empty-state')?.classList.contains('d-none')).toBe(false);

		localStorage.setItem('live.filter.weekly-missions.clem', '1');
		filterWeeklyMissions();
		expect(document.querySelector('#weekly-missions-empty-state')?.classList.contains('d-none')).toBe(true);
	});

	test('each mission can be individually toggled', () => {
		for (const mission of missions) {
			localStorage.setItem(`live.filter.weekly-missions.${mission}`, '0');
			filterWeeklyMissions();
			expect(document.querySelector<HTMLElement>(`[data-mission="${mission}"]`)?.style.display, mission).toBe('none');

			localStorage.setItem(`live.filter.weekly-missions.${mission}`, '1');
			filterWeeklyMissions();
			expect(document.querySelector<HTMLElement>(`[data-mission="${mission}"]`)?.style.display, mission).not.toBe('none');
		}
	});

	test('filter state persists: re-calling filterWeeklyMissions re-reads localStorage', () => {
		// Simulate what happens on page load with stored filter state
		localStorage.setItem('live.filter.weekly-missions.maroo', '0');
		filterWeeklyMissions();
		expect(document.querySelector<HTMLElement>('[data-mission="maroo"]')?.style.display).toBe('none');
	});
});
