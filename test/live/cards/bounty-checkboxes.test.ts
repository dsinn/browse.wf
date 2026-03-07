/**
 * Tests for bounty-checkboxes.ts
 *
 * Verifies that daily completion checkboxes are appended to the Cavia and
 * The Hex bounty headings, and that the OID changes after a daily reset.
 */
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadScript, mockBootstrapTooltip } from '../../helpers/dom-helpers';
import { freezeTime } from '../../helpers/time-helpers';
import { MOCK_TIMESTAMP } from '../../helpers/test-constants';

const DAY_MS = 86_400_000;

describe('Bounty Checkboxes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockBootstrapTooltip();
    (window as any).createCompletionToggle = vi.fn(() => document.createTextNode(''));
    loadScript('typestripped/src/bounty-checkboxes.js');
    (window as any).updateBountyCheckboxes();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (window as any).updateBountyCheckboxes;
    delete (window as any).createCompletionToggle;
  });

  test('calls createCompletionToggle twice (once per heading)', () => {
    expect((window as any).createCompletionToggle).toHaveBeenCalledTimes(2);
  });

  test('OID changes after a daily reset', () => {
    const oidBefore = (window as any).createCompletionToggle.mock.calls[0][0];

    freezeTime(MOCK_TIMESTAMP + DAY_MS);
    (window as any).createCompletionToggle.mockClear();
    (window as any).updateBountyCheckboxes();

    const oidAfter = (window as any).createCompletionToggle.mock.calls[0][0];
    expect(oidAfter).not.toBe(oidBefore);
  });

  test('Cavia and Hex have different OIDs from each other', () => {
    const [oid1, oid2] = (window as any).createCompletionToggle.mock.calls.map((c: any) => c[0]);
    expect(oid1).not.toBe(oid2);
  });

  test('re-running updateBountyCheckboxes does not duplicate the checkbox span', () => {
    (window as any).updateBountyCheckboxes();
    const heading = document.getElementById('EntratiLabSyndicate-name')!;
    expect(heading.querySelectorAll('#EntratiLabSyndicate-check').length).toBe(1);
  });

  test('silently skips missing headings', () => {
    document.getElementById('EntratiLabSyndicate-name')!.remove();
    expect(() => (window as any).updateBountyCheckboxes()).not.toThrow();
  });
});
