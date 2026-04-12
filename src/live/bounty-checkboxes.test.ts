/**
 * Tests for bounty-checkboxes.ts
 *
 * Verifies that daily completion checkboxes are appended to the Cavia and
 * The Hex bounty headings, and that the OID changes after a daily reset.
 */
import {
	describe, test, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {mockBootstrapTooltip} from '@test/helpers/dom-helpers';
import {freezeTime} from '@test/helpers/time-helpers';
import {MOCK_TIMESTAMP} from '@test/helpers/test-constants';
import {MILLIS_PER_DAY} from '../helpers/time-helpers';
import {updateBountyCheckboxes} from './bounty-checkboxes';

describe('Bounty Checkboxes', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		mockBootstrapTooltip();
		(globalThis as any).createCompletionToggle = vi.fn(() => document.createTextNode(''));
		updateBountyCheckboxes();
	});

	afterEach(() => {
		vi.useRealTimers();
		delete (globalThis as any).createCompletionToggle;
	});

	test('calls createCompletionToggle twice (once per heading)', () => {
		expect((globalThis as any).createCompletionToggle).toHaveBeenCalledTimes(2);
	});

	test('OID changes after a daily reset', () => {
		const oidBefore = (globalThis as any).createCompletionToggle.mock.calls[0][0];

		freezeTime(MOCK_TIMESTAMP + MILLIS_PER_DAY);
		(globalThis as any).createCompletionToggle.mockClear();
		updateBountyCheckboxes();

		const oidAfter = (globalThis as any).createCompletionToggle.mock.calls[0][0];
		expect(oidAfter).not.toBe(oidBefore);
	});

	test('Cavia and Hex have different OIDs from each other', () => {
		const [oid1, oid2] = (globalThis as any).createCompletionToggle.mock.calls.map((c: any) => c[0]);
		expect(oid1).not.toBe(oid2);
	});

	test('re-running updateBountyCheckboxes does not duplicate the checkbox span', () => {
		updateBountyCheckboxes();
		const heading = document.querySelector('#EntratiLabSyndicate-name');
		expect(heading!.querySelectorAll('#EntratiLabSyndicate-check').length).toBe(1);
	});

	test('silently skips missing headings', () => {
		document.querySelector('#EntratiLabSyndicate-name')!.remove();
		expect(() => {
			updateBountyCheckboxes();
		}).not.toThrow();
	});
});
