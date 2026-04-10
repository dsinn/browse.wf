/**
 * Tests for Bounty Filters
 *
 * Tests dropdown-based tier filtering for bounties:
 * - Dropdown selectors for each syndicate
 * - localStorage persistence
 * - getMinimumTier function
 *
 * Note: Gear icon behavior is tested in card-filters tests.
 * Content filtering behavior (updateBountyCycleLocalised) is tested via E2E tests.
 */
import {
	describe, test, expect, beforeEach, afterEach,
} from 'vitest';
import {loadFixture} from '@test/helpers/fixture-loader';
import {initializeBountyFiltersAll, getMinimumTier, isBountyMissionTypeEnabled} from './bounty-filters';

describe('Bounty Filters', () => {
	beforeEach(() => {
		// Clear localStorage before each test
		localStorage.clear();

		// Setup DOM from actual live.php fixture
		document.body.innerHTML = loadFixture('live');

		// Initialize the filters
		initializeBountyFiltersAll();
	});

	afterEach(() => {
		localStorage.clear();
	});

	describe('Dropdown Initialization', () => {
		test('dropdowns default to Min Tier 1 (show all)', () => {
			const holdfast = document.querySelector<HTMLSelectElement>('#bounty-filter-ZarimanSyndicate');
			const cavia = document.querySelector<HTMLSelectElement>('#bounty-filter-EntratiLabSyndicate');
			const hex = document.querySelector<HTMLSelectElement>('#bounty-filter-HexSyndicate');

			expect(holdfast!.value).toBe('1');
			expect(cavia!.value).toBe('1');
			expect(hex!.value).toBe('1');
		});
	});

	describe('localStorage Persistence', () => {
		test('changing dropdown saves to localStorage', () => {
			const dropdown = document.querySelector<HTMLSelectElement>('#bounty-filter-ZarimanSyndicate');

			dropdown!.value = '3';
			dropdown!.dispatchEvent(new Event('change'));

			expect(localStorage.getItem('live.filter.bounties.ZarimanSyndicate.minTier')).toBe('3');
		});

		test('setting Hide option saves to localStorage', () => {
			const dropdown = document.querySelector<HTMLSelectElement>('#bounty-filter-HexSyndicate');

			dropdown!.value = '-1';
			dropdown!.dispatchEvent(new Event('change'));

			expect(localStorage.getItem('live.filter.bounties.HexSyndicate.minTier')).toBe('-1');
		});

		test('dropdown state persists from localStorage on init', () => {
			// Set localStorage state before initialization
			localStorage.setItem('live.filter.bounties.EntratiLabSyndicate.minTier', '4');

			// Reinitialize
			initializeBountyFiltersAll();

			const dropdown = document.querySelector<HTMLSelectElement>('#bounty-filter-EntratiLabSyndicate');
			expect(dropdown!.value).toBe('4');
		});

		test('all three syndicates persist independently', () => {
			const holdfast = document.querySelector<HTMLSelectElement>('#bounty-filter-ZarimanSyndicate');
			const cavia = document.querySelector<HTMLSelectElement>('#bounty-filter-EntratiLabSyndicate');
			const hex = document.querySelector<HTMLSelectElement>('#bounty-filter-HexSyndicate');

			holdfast!.value = '2';
			holdfast!.dispatchEvent(new Event('change'));

			cavia!.value = '5';
			cavia!.dispatchEvent(new Event('change'));

			hex!.value = '-1';
			hex!.dispatchEvent(new Event('change'));

			expect(localStorage.getItem('live.filter.bounties.ZarimanSyndicate.minTier')).toBe('2');
			expect(localStorage.getItem('live.filter.bounties.EntratiLabSyndicate.minTier')).toBe('5');
			expect(localStorage.getItem('live.filter.bounties.HexSyndicate.minTier')).toBe('-1');
		});
	});

	describe('Mission Type Checkboxes', () => {
		test('checkboxes default to checked', () => {
			const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"][data-bounty-syndicate="ZarimanSyndicate"][data-filter-type="MT_CORRUPTION"]');
			expect(checkbox).not.toBeNull();
			expect(checkbox!.checked).toBe(true);
		});

		test('unchecking saves 0 to localStorage', () => {
			const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"][data-bounty-syndicate="EntratiLabSyndicate"][data-filter-type="MT_SURVIVAL"]');
			checkbox!.checked = false;
			checkbox!.dispatchEvent(new Event('change'));
			expect(localStorage.getItem('live.filter.bounties.EntratiLabSyndicate.MT_SURVIVAL')).toBe('0');
		});

		test('rechecking saves 1 to localStorage', () => {
			localStorage.setItem('live.filter.bounties.HexSyndicate.MT_SURVIVAL', '0');
			initializeBountyFiltersAll();
			const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"][data-bounty-syndicate="HexSyndicate"][data-filter-type="MT_SURVIVAL"]');
			checkbox!.checked = true;
			checkbox!.dispatchEvent(new Event('change'));
			expect(localStorage.getItem('live.filter.bounties.HexSyndicate.MT_SURVIVAL')).toBe('1');
		});

		test('checkbox state persists from localStorage on init', () => {
			localStorage.setItem('live.filter.bounties.ZarimanSyndicate.MT_ARMAGEDDON', '0');
			initializeBountyFiltersAll();
			const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"][data-bounty-syndicate="ZarimanSyndicate"][data-filter-type="MT_ARMAGEDDON"]');
			expect(checkbox!.checked).toBe(false);
		});

		test('checkboxes for different syndicates are independent', () => {
			const caviaSurvival = document.querySelector<HTMLInputElement>('input[type="checkbox"][data-bounty-syndicate="EntratiLabSyndicate"][data-filter-type="MT_SURVIVAL"]');
			const hexSurvival = document.querySelector<HTMLInputElement>('input[type="checkbox"][data-bounty-syndicate="HexSyndicate"][data-filter-type="MT_SURVIVAL"]');
			caviaSurvival!.checked = false;
			caviaSurvival!.dispatchEvent(new Event('change'));
			expect(localStorage.getItem('live.filter.bounties.EntratiLabSyndicate.MT_SURVIVAL')).toBe('0');
			expect(localStorage.getItem('live.filter.bounties.HexSyndicate.MT_SURVIVAL')).toBeNull();
			expect(hexSurvival!.checked).toBe(true);
		});
	});

	describe('isBountyMissionTypeEnabled', () => {
		test('returns true by default (no localStorage entry)', () => {
			expect(isBountyMissionTypeEnabled('ZarimanSyndicate', 'MT_CORRUPTION')).toBe(true);
		});

		test('returns false when localStorage value is "0"', () => {
			localStorage.setItem('live.filter.bounties.HexSyndicate.MT_DEFENSE', '0');
			expect(isBountyMissionTypeEnabled('HexSyndicate', 'MT_DEFENSE')).toBe(false);
		});

		test('returns true when localStorage value is "1"', () => {
			localStorage.setItem('live.filter.bounties.EntratiLabSyndicate.MT_SURVIVAL', '1');
			expect(isBountyMissionTypeEnabled('EntratiLabSyndicate', 'MT_SURVIVAL')).toBe(true);
		});

		test('keys are per-syndicate (same mission type, different syndicates)', () => {
			localStorage.setItem('live.filter.bounties.EntratiLabSyndicate.MT_EXTERMINATION', '0');
			expect(isBountyMissionTypeEnabled('EntratiLabSyndicate', 'MT_EXTERMINATION')).toBe(false);
			expect(isBountyMissionTypeEnabled('ZarimanSyndicate', 'MT_EXTERMINATION')).toBe(true);
			expect(isBountyMissionTypeEnabled('HexSyndicate', 'MT_EXTERMINATION')).toBe(true);
		});
	});

	describe('getMinimumTier Function', () => {
		test('returns 1 when no filter is set (default)', () => {
			const minTier = getMinimumTier('ZarimanSyndicate');
			expect(minTier).toBe(1);
		});

		test('returns -1 when Hide is selected', () => {
			localStorage.setItem('live.filter.bounties.HexSyndicate.minTier', '-1');
			const minTier = getMinimumTier('HexSyndicate');
			expect(minTier).toBe(-1);
		});

		test('returns correct tier for Holdfasts', () => {
			localStorage.setItem('live.filter.bounties.ZarimanSyndicate.minTier', '3');
			const minTier = getMinimumTier('ZarimanSyndicate');
			expect(minTier).toBe(3);
		});

		test('returns correct tier for Cavia', () => {
			localStorage.setItem('live.filter.bounties.EntratiLabSyndicate.minTier', '5');
			const minTier = getMinimumTier('EntratiLabSyndicate');
			expect(minTier).toBe(5);
		});

		test('returns correct tier for Hex', () => {
			localStorage.setItem('live.filter.bounties.HexSyndicate.minTier', '7');
			const minTier = getMinimumTier('HexSyndicate');
			expect(minTier).toBe(7);
		});

		test('handles invalid values gracefully', () => {
			localStorage.setItem('live.filter.bounties.ZarimanSyndicate.minTier', 'invalid');
			const minTier = getMinimumTier('ZarimanSyndicate');
			expect(minTier).toBe(1); // Falls back to default
		});
	});
});
