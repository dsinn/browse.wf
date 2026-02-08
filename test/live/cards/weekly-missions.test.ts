/**
 * Tests for Weekly Missions card
 *
 * Note: Content filtering behavior (updateCircuitLocalised) is not tested here to avoid
 * test drift. The mock implementation would need to duplicate production logic,
 * and any divergence would give false confidence.
 *
 * Content filtering logic should be tested via E2E tests or manual testing.
 */
import { describe, test, expect } from 'vitest';
import { getById } from '../../helpers/dom-helpers';
import { testCardFilters } from '../card-filters-factory';

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

    const missions = Array.from(entries!).map(entry => entry.getAttribute('data-mission'));
    expect(missions).toContain('clem');
    expect(missions).toContain('maroo');
    expect(missions).toContain('circuit-normal');
    expect(missions).toContain('circuit-sp');
    expect(missions).toContain('netracells');
    expect(missions).toContain('kahl');
  });
});
