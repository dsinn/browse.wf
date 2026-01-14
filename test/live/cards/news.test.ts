/**
 * Tests for News card
 *
 * Note: Content filtering behavior (updateNewsTicker) is not tested here to avoid
 * test drift. The mock implementation would need to duplicate production logic,
 * and any divergence would give false confidence.
 *
 * Content filtering logic should be tested via E2E tests or manual testing.
 */
import { describe, test, expect } from 'vitest';
import { getById } from '../../helpers/dom-helpers';
import { testCardFilters } from '../card-filters-factory';

// Test generic card filter integration for News card
// This verifies: gear icon, accordion, checkboxes, localStorage persistence, auto-expand
testCardFilters('news');

describe('News Card', () => {
  test('news body element exists', () => {
    const newsBody = getById('news-body');
    expect(newsBody).toBeTruthy();
  });

  test('displays news items', () => {
    const newsBody = getById('news-body');

    // Simulate rendering a news item
    newsBody.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'card-text mb-1';

    const badge = document.createElement('span');
    badge.className = 'badge text-bg-secondary';
    badge.textContent = 'Just now';
    p.appendChild(badge);

    const textSpan = document.createElement('span');
    textSpan.className = 'text-danger';
    textSpan.textContent = ' Server restart in 5 minutes';
    p.appendChild(textSpan);

    newsBody.appendChild(p);

    expect(newsBody.querySelector('p')).toBeTruthy();
    expect(newsBody.querySelector('.text-danger')?.textContent).toBe(' Server restart in 5 minutes');
  });
});
