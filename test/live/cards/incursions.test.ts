/**
 * Tests for Steel Path Incursions card
 *
 * Note: Content filtering behavior (updateIncursionsLocalised) is not tested here to avoid
 * test drift. The mock implementation would need to duplicate production logic,
 * and any divergence would give false confidence.
 *
 * Content filtering logic should be tested via E2E tests or manual testing.
 */
import { describe, test, expect } from 'vitest';
import { getById } from '../../helpers/dom-helpers';
import { testCardFilters } from '../card-filters-factory';

// Test generic card filter integration for Incursions card
// This verifies: gear icon, accordion, checkboxes, localStorage persistence, auto-expand
testCardFilters('incursions');

describe('Incursions Card', () => {
  test('incursions body element exists', () => {
    const incursionsBody = getById('incursions-body');
    expect(incursionsBody).toBeTruthy();
  });
});
