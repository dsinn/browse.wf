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
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { loadFixture } from '../../helpers/fixture-loader';
import { loadScript } from '../../helpers/dom-helpers';

describe('Bounty Filters', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();

    // Setup DOM from actual live.php fixture
    document.body.innerHTML = loadFixture('live');

    // Load the actual production code - no mock, no drift
    loadScript('typestripped/src/bounty-filters.js');

    // Initialize the filters
    if ((window as any).initializeBountyFilters_all) {
      (window as any).initializeBountyFilters_all();
    }
  });

  afterEach(() => {
    localStorage.clear();
    delete (window as any).initializeBountyFilters_all;
    delete (window as any).getMinimumTier;
  });

  describe('Dropdown Initialization', () => {
    test('dropdowns default to Min Tier 1 (show all)', () => {
      const holdfast = document.getElementById('bounty-filter-ZarimanSyndicate') as HTMLSelectElement;
      const cavia = document.getElementById('bounty-filter-EntratiLabSyndicate') as HTMLSelectElement;
      const hex = document.getElementById('bounty-filter-HexSyndicate') as HTMLSelectElement;

      expect(holdfast.value).toBe('1');
      expect(cavia.value).toBe('1');
      expect(hex.value).toBe('1');
    });
  });

  describe('localStorage Persistence', () => {
    test('changing dropdown saves to localStorage', () => {
      const dropdown = document.getElementById('bounty-filter-ZarimanSyndicate') as HTMLSelectElement;

      dropdown.value = '3';
      dropdown.dispatchEvent(new Event('change'));

      expect(localStorage.getItem('live.filter.bounties.ZarimanSyndicate')).toBe('3');
    });

    test('setting Hide option saves to localStorage', () => {
      const dropdown = document.getElementById('bounty-filter-HexSyndicate') as HTMLSelectElement;

      dropdown.value = '-1';
      dropdown.dispatchEvent(new Event('change'));

      expect(localStorage.getItem('live.filter.bounties.HexSyndicate')).toBe('-1');
    });

    test('dropdown state persists from localStorage on init', () => {
      // Set localStorage state before initialization
      localStorage.setItem('live.filter.bounties.EntratiLabSyndicate', '4');

      // Reinitialize
      if ((window as any).initializeBountyFilters_all) {
        (window as any).initializeBountyFilters_all();
      }

      const dropdown = document.getElementById('bounty-filter-EntratiLabSyndicate') as HTMLSelectElement;
      expect(dropdown.value).toBe('4');
    });

    test('all three syndicates persist independently', () => {
      const holdfast = document.getElementById('bounty-filter-ZarimanSyndicate') as HTMLSelectElement;
      const cavia = document.getElementById('bounty-filter-EntratiLabSyndicate') as HTMLSelectElement;
      const hex = document.getElementById('bounty-filter-HexSyndicate') as HTMLSelectElement;

      holdfast.value = '2';
      holdfast.dispatchEvent(new Event('change'));

      cavia.value = '5';
      cavia.dispatchEvent(new Event('change'));

      hex.value = '-1';
      hex.dispatchEvent(new Event('change'));

      expect(localStorage.getItem('live.filter.bounties.ZarimanSyndicate')).toBe('2');
      expect(localStorage.getItem('live.filter.bounties.EntratiLabSyndicate')).toBe('5');
      expect(localStorage.getItem('live.filter.bounties.HexSyndicate')).toBe('-1');
    });
  });

  describe('getMinimumTier Function', () => {
    test('returns 1 when no filter is set (default)', () => {
      const minTier = (window as any).getMinimumTier('ZarimanSyndicate');
      expect(minTier).toBe(1);
    });

    test('returns -1 when Hide is selected', () => {
      localStorage.setItem('live.filter.bounties.HexSyndicate', '-1');
      const minTier = (window as any).getMinimumTier('HexSyndicate');
      expect(minTier).toBe(-1);
    });

    test('returns correct tier for Holdfasts', () => {
      localStorage.setItem('live.filter.bounties.ZarimanSyndicate', '3');
      const minTier = (window as any).getMinimumTier('ZarimanSyndicate');
      expect(minTier).toBe(3);
    });

    test('returns correct tier for Cavia', () => {
      localStorage.setItem('live.filter.bounties.EntratiLabSyndicate', '5');
      const minTier = (window as any).getMinimumTier('EntratiLabSyndicate');
      expect(minTier).toBe(5);
    });

    test('returns correct tier for Hex', () => {
      localStorage.setItem('live.filter.bounties.HexSyndicate', '7');
      const minTier = (window as any).getMinimumTier('HexSyndicate');
      expect(minTier).toBe(7);
    });

    test('handles invalid values gracefully', () => {
      localStorage.setItem('live.filter.bounties.ZarimanSyndicate', 'invalid');
      const minTier = (window as any).getMinimumTier('ZarimanSyndicate');
      expect(minTier).toBe(1); // Falls back to default
    });
  });
});
