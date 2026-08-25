import {
	describe, test, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {mockBootstrapTooltip} from '@test/helpers/dom-helpers';
import {setCompletionToggle, refreshAllCompletionToggles} from './completion-toggles';

describe('completion-toggles', () => {
	beforeEach(() => {
		mockBootstrapTooltip();
		localStorage.clear();
		(globalThis as any).isOidMarkedAsCompleted = (oid: string) =>
			(JSON.parse(localStorage.getItem('oids_completed') ?? '[]') as string[]).includes(oid);
		(globalThis as any).toggleOidCompletion = (oid: string) => {
			const array = JSON.parse(localStorage.getItem('oids_completed') ?? '[]') as string[];
			const index = array.indexOf(oid);
			if (index === -1) {
				array.push(oid);
			} else {
				array.splice(index, 1);
			}

			localStorage.setItem('oids_completed', JSON.stringify(array));
		};
	});

	afterEach(() => {
		localStorage.clear();
		delete (globalThis as any).isOidMarkedAsCompleted;
		delete (globalThis as any).toggleOidCompletion;
	});

	function makeToggle(oid: string): HTMLAnchorElement {
		const a = document.createElement('a');
		a.className = 'completion-check';
		a.dataset.oid = oid;
		a.innerHTML = '<i class="bi bi-square"></i>';
		document.body.append(a);
		return a;
	}

	describe('setCompletionToggle', () => {
		test('marks element as completed', () => {
			const elm = makeToggle('test-oid-1');
			setCompletionToggle(elm, true);
			expect(elm.innerHTML).toContain('bi-check-square');
			expect((globalThis as any).isOidMarkedAsCompleted('test-oid-1')).toBe(true);
		});

		test('unmarks element as completed', () => {
			const elm = makeToggle('test-oid-2');
			setCompletionToggle(elm, true);
			setCompletionToggle(elm, false);
			expect(elm.innerHTML).toContain('bi-square');
			expect(elm.innerHTML).not.toContain('bi-check-square');
			expect((globalThis as any).isOidMarkedAsCompleted('test-oid-2')).toBe(false);
		});

		test('does nothing when oid is absent', () => {
			const elm = document.createElement('a');
			// No data-oid set
			expect(() => {
				setCompletionToggle(elm, true);
			}).not.toThrow();
		});

		test('does not double-toggle when state already matches', () => {
			const elm = makeToggle('test-oid-3');
			setCompletionToggle(elm, true);
			setCompletionToggle(elm, true); // Should not un-mark
			expect((globalThis as any).isOidMarkedAsCompleted('test-oid-3')).toBe(true);
		});
	});

	describe('refreshAllCompletionToggles', () => {
		test('updates all .completion-check elements to match localStorage', () => {
			const elm1 = makeToggle('refresh-oid-1');
			const elm2 = makeToggle('refresh-oid-2');

			localStorage.setItem('oids_completed', JSON.stringify(['refresh-oid-1']));
			refreshAllCompletionToggles();

			expect(elm1.innerHTML).toContain('bi-check-square');
			expect(elm2.innerHTML).toContain('bi-square');
			expect(elm2.innerHTML).not.toContain('bi-check-square');
		});

		test('handles elements without data-oid gracefully', () => {
			const orphan = document.createElement('a');
			orphan.className = 'completion-check';
			document.body.append(orphan);
			expect(() => {
				refreshAllCompletionToggles();
			}).not.toThrow();
		});
	});
});
