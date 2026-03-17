/**
 * Generic card filter test factory
 *
 * Export testCardFilters() to test filter functionality for any card.
 * Each card that implements filters should call this function to ensure
 * correct integration.
 *
 * Imports the REAL production code (src/card-filters.ts) to avoid test drift.
 */
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { loadFixture } from '../helpers/fixture-loader';
import { mockBootstrapTooltip } from '../helpers/dom-helpers';
import { initializeCardFilters_all, isFilterEnabled, refreshFilterStatus } from '../../src/card-filters';

/**
 * Test factory function that tests generic card filter functionality for a specific card.
 * Call this from a card's test file to verify filter integration.
 *
 * @param cardName - The name of the card to test (e.g., 'news', 'fissures', 'invasions')
 */
export function testCardFilters(cardName: string) {
  describe(`Card Filters - ${cardName}`, () => {
    beforeEach(() => {
      // Clear localStorage before each test
      localStorage.clear();

      // Setup DOM from actual live.php fixture
      document.body.innerHTML = loadFixture('live');
      mockBootstrapTooltip();

      // Mock addTooltip (used by card-filters.js)
      (window as any).addTooltip = function(element: HTMLElement, title: string) {
        element.setAttribute('data-bs-toggle', 'tooltip');
        element.setAttribute('data-bs-title', title);
        if (window.bootstrap?.Tooltip) {
          new window.bootstrap.Tooltip(element);
        }
      };

      // Mock refreshCollapseStatus (needed by card-filters.js but not defined there)
      (window as any).refreshCollapseStatus = function(elm: HTMLElement) {
        const cardName = elm.getAttribute('data-collapse-toggle');
        const engaged = localStorage.getItem(`live.collapse.${cardName}`);
        if (engaged) {
          elm.classList.add('engaged');
        } else {
          elm.classList.remove('engaged');
        }
      };

      // Initialize the card filters
      initializeCardFilters_all();
    });

    afterEach(() => {
      localStorage.clear();
      delete window.bootstrap;
    });

    describe('Gear Icon', () => {
      test('gear icon exists in card header', () => {
        const gearIcon = document.querySelector(`[data-filter-toggle="${cardName}"]`);
        expect(gearIcon).toBeTruthy();
      });

      test('gear icon starts in disabled (grayscale) state', () => {
        const gearIcon = document.querySelector(`[data-filter-toggle="${cardName}"]`) as HTMLElement;
        expect(gearIcon).toBeTruthy();

        // The refreshFilterStatus function should have been called during init
        const span = gearIcon.querySelector('span');
        expect(span?.classList.contains('filter-gear-disabled')).toBe(true);
        expect(span?.classList.contains('filter-gear-enabled')).toBe(false);
      });

      test('gear icon has tooltip "Widget settings"', () => {
        const gearIcon = document.querySelector(`[data-filter-toggle="${cardName}"]`) as HTMLElement;
        const span = gearIcon.querySelector('span');

        expect(span?.getAttribute('data-bs-title')).toBe('Widget settings');
      });
    });

    describe('Filter Panel Accordion', () => {
      test('filter panel exists and is hidden by default', () => {
        const panel = document.getElementById(`${cardName}-filters`);
        expect(panel).toBeTruthy();
        expect(panel?.style.display).toBe('none');
        expect(panel?.classList.contains('show')).toBe(false);
      });

      test('clicking gear icon opens filter panel', () => {
        const gearIcon = document.querySelector(`[data-filter-toggle="${cardName}"]`) as HTMLAnchorElement;
        const panel = document.getElementById(`${cardName}-filters`);

        // Click to open
        gearIcon.click();

        expect(panel?.style.display).toBe('grid');
        expect(panel?.classList.contains('show')).toBe(true);
      });

      test('clicking gear icon again closes filter panel but keeps card expanded', () => {
        const gearIcon = document.querySelector(`[data-filter-toggle="${cardName}"]`) as HTMLAnchorElement;
        const panel = document.getElementById(`${cardName}-filters`);
        const collapseToggle = document.querySelector(`[data-collapse-toggle="${cardName}"]`) as HTMLElement;

        // Start with collapsed card
        localStorage.setItem(`live.collapse.${cardName}`, '1');
        if ((window as any).refreshCollapseStatus) {
          (window as any).refreshCollapseStatus(collapseToggle);
        }
        expect(collapseToggle.classList.contains('engaged')).toBe(true);

        // Click to open - card should auto-expand
        gearIcon.click();
        expect(panel?.classList.contains('show')).toBe(true);
        expect(collapseToggle.classList.contains('engaged')).toBe(false);

        // Click to close - card should stay expanded
        gearIcon.click();
        expect(panel?.classList.contains('show')).toBe(false);
        expect(collapseToggle.classList.contains('engaged')).toBe(false);
      });

      test('gear icon changes to enabled (blue) state when panel opens', () => {
        const gearIcon = document.querySelector(`[data-filter-toggle="${cardName}"]`) as HTMLAnchorElement;

        // Click to open
        gearIcon.click();

        // Query for span again after refresh
        const span = gearIcon.querySelector('span');

        expect(span?.classList.contains('filter-gear-enabled')).toBe(true);
        expect(span?.classList.contains('filter-gear-disabled')).toBe(false);
      });
    });

    describe('Auto-Expand Collapsed Card', () => {
      test('opening filter panel expands collapsed card', () => {
        const collapseToggle = document.querySelector(`[data-collapse-toggle="${cardName}"]`) as HTMLElement;
        const gearIcon = document.querySelector(`[data-filter-toggle="${cardName}"]`) as HTMLAnchorElement;

        // First, collapse the card
        localStorage.setItem(`live.collapse.${cardName}`, '1');
        if ((window as any).refreshCollapseStatus) {
          (window as any).refreshCollapseStatus(collapseToggle);
        }

        expect(collapseToggle.classList.contains('engaged')).toBe(true);

        // Now open the filter panel
        gearIcon.click();

        // Card should be expanded
        expect(collapseToggle.classList.contains('engaged')).toBe(false);
        expect(localStorage.getItem(`live.collapse.${cardName}`)).toBeNull();
      });
    });

    describe('Filter Checkboxes', () => {
      test('checkboxes with data-filter-type exist', () => {
        const panel = document.getElementById(`${cardName}-filters`);
        const checkboxes = panel?.querySelectorAll('[data-filter-type]');

        expect(checkboxes).toBeTruthy();
        expect(checkboxes!.length).toBeGreaterThan(0);
      });

      test('checkboxes are checked by default', () => {
        const panel = document.getElementById(`${cardName}-filters`);
        const checkboxes = panel?.querySelectorAll<HTMLInputElement>('[data-filter-type]');

        checkboxes?.forEach(checkbox => {
          expect(checkbox.checked).toBe(true);
        });
      });

      test('unchecking a checkbox saves to localStorage', () => {
        const panel = document.getElementById(`${cardName}-filters`);
        const checkbox = panel?.querySelector<HTMLInputElement>('[data-filter-type]');
        const filterType = checkbox?.getAttribute('data-filter-type');

        expect(checkbox).toBeTruthy();
        expect(filterType).toBeTruthy();

        // Uncheck the checkbox
        checkbox!.checked = false;
        checkbox!.dispatchEvent(new Event('change'));

        expect(localStorage.getItem(`live.filter.${cardName}.${filterType}`)).toBe('0');
      });

      test('checking a checkbox saves to localStorage', () => {
        const panel = document.getElementById(`${cardName}-filters`);
        const checkbox = panel?.querySelector<HTMLInputElement>('[data-filter-type]');
        const filterType = checkbox?.getAttribute('data-filter-type');

        expect(checkbox).toBeTruthy();

        // Uncheck first
        checkbox!.checked = false;
        checkbox!.dispatchEvent(new Event('change'));

        // Then check again
        checkbox!.checked = true;
        checkbox!.dispatchEvent(new Event('change'));

        expect(localStorage.getItem(`live.filter.${cardName}.${filterType}`)).toBe('1');
      });

      test('checkbox state persists from localStorage', () => {
        const panel = document.getElementById(`${cardName}-filters`);
        const firstCheckbox = panel?.querySelector<HTMLInputElement>('[data-filter-type]');
        const filterType = firstCheckbox?.getAttribute('data-filter-type');

        expect(filterType).toBeTruthy();

        // Set localStorage state before initialization
        localStorage.setItem(`live.filter.${cardName}.${filterType}`, '0');

        // Reinitialize
        initializeCardFilters_all();

        const checkbox = panel?.querySelector<HTMLInputElement>('[data-filter-type]');
        expect(checkbox?.checked).toBe(false);
      });
    });

    describe('isFilterEnabled Function', () => {
      test('returns true when no filter is set (default)', () => {
        const isEnabled = isFilterEnabled(cardName, 'any-type');
        expect(isEnabled).toBe(true);
      });

      test('returns false when filter is explicitly disabled', () => {
        localStorage.setItem(`live.filter.${cardName}.any-type`, '0');
        const isEnabled = isFilterEnabled(cardName, 'any-type');
        expect(isEnabled).toBe(false);
      });

      test('returns true when filter is explicitly enabled', () => {
        localStorage.setItem(`live.filter.${cardName}.any-type`, '1');
        const isEnabled = isFilterEnabled(cardName, 'any-type');
        expect(isEnabled).toBe(true);
      });
    });
  });
}
