/**
 * Tests for checkbox-linking module
 *
 * Tests sequential group checking (Netracells, Narmer) and
 * Archimedea → Netracells additive linking behaviour.
 */
import {
	describe, test, expect, beforeEach, afterEach,
} from 'vitest';
import {applyCheckboxLinking} from '../../../src/checkbox-linking';

const WEEK_SUFFIX = '99999';
const EXPIRY_SUFFIX = '88888';

const NETRACELLS = [1, 2, 3, 4, 5].map(n => `netracell${n}-${WEEK_SUFFIX}`);
const NARMER = [
	`kahl-${WEEK_SUFFIX}`,
	`kahlb1-${WEEK_SUFFIX}`,
	`kahlb2-${WEEK_SUFFIX}`,
	`kahlb3-${WEEK_SUFFIX}`,
	`kahlb4-${WEEK_SUFFIX}`,
	`kahlb5-${WEEK_SUFFIX}`,
	`kahlb6-${WEEK_SUFFIX}`,
];
const DEEP_ARCH = `labconquest-${EXPIRY_SUFFIX}`;
const TEMP_ARCH = `hexconquest-${EXPIRY_SUFFIX}`;

function elementFor(oid: string): HTMLElement {
	return document.querySelector<HTMLElement>(`[data-oid="${oid}"]`);
}

function isChecked(oid: string): boolean {
	return (globalThis as any).isOidMarkedAsCompleted(oid);
}

function setChecked(oid: string, checked: boolean): void {
	(globalThis as any).setCompletionToggle(elementFor(oid), checked);
}

beforeEach(() => {
	localStorage.clear();

	// Mirrors the relevant data-* attributes from live.php
	document.body.innerHTML = `
        <span id="netracell-checks" data-checkbox-group>
            ${NETRACELLS.map(oid => `<a class="completion-check" data-oid="${oid}"></a>`).join('')}
        </span>
        <span id="kahl-checks" data-checkbox-group>
            ${NARMER.map(oid => `<a class="completion-check" data-oid="${oid}"></a>`).join('')}
        </span>
        <span data-autocheck-target="#netracell-checks" data-autocheck-count="2">
            <a class="completion-check" data-oid="${DEEP_ARCH}"></a>
        </span>
        <span data-autocheck-target="#netracell-checks" data-autocheck-count="2">
            <a class="completion-check" data-oid="${TEMP_ARCH}"></a>
        </span>
    `;

	// Minimal mocks
	const oidsCompleted: string[] = [];
	(globalThis as any).isOidMarkedAsCompleted = (oid: string) => oidsCompleted.includes(oid);
	(globalThis as any).setCompletionToggle = (element: HTMLAnchorElement, completed: boolean) => {
		const {oid} = element.dataset;
		const idx = oidsCompleted.indexOf(oid);
		if (completed && idx === -1) {
			oidsCompleted.push(oid);
		} else if (!completed && idx !== -1) {
			oidsCompleted.splice(idx, 1);
		}
	};
});

afterEach(() => {
	localStorage.clear();
	delete (globalThis as any).isOidMarkedAsCompleted;
	delete (globalThis as any).setCompletionToggle;
});

describe('Sequential group: Netracells', () => {
	test('checking box 3 checks boxes 1 and 2', () => {
		applyCheckboxLinking(elementFor(NETRACELLS[2]), true);
		expect(isChecked(NETRACELLS[0])).toBe(true);
		expect(isChecked(NETRACELLS[1])).toBe(true);
		expect(isChecked(NETRACELLS[2])).toBe(false); // User's click handled externally
	});

	test('unchecking box 3 unchecks boxes 4 and 5', () => {
		setChecked(NETRACELLS[3], true);
		setChecked(NETRACELLS[4], true);
		applyCheckboxLinking(elementFor(NETRACELLS[2]), false);
		expect(isChecked(NETRACELLS[3])).toBe(false);
		expect(isChecked(NETRACELLS[4])).toBe(false);
	});

	test('checking box 1 (leftmost) does not change others', () => {
		applyCheckboxLinking(elementFor(NETRACELLS[0]), true);
		for (let i = 1; i < 5; i++) {
			expect(isChecked(NETRACELLS[i])).toBe(false);
		}
	});

	test('unchecking box 5 (rightmost) does not change others', () => {
		for (const oid of NETRACELLS.slice(0, 4)) {
			setChecked(oid, true);
		}

		applyCheckboxLinking(elementFor(NETRACELLS[4]), false);
		for (let i = 0; i < 4; i++) {
			expect(isChecked(NETRACELLS[i])).toBe(true);
		}
	});

	test('checking box 5 checks all others', () => {
		applyCheckboxLinking(elementFor(NETRACELLS[4]), true);
		for (let i = 0; i < 4; i++) {
			expect(isChecked(NETRACELLS[i])).toBe(true);
		}
	});

	test('unchecking box 1 unchecks all others', () => {
		for (const oid of NETRACELLS) {
			setChecked(oid, true);
		}

		applyCheckboxLinking(elementFor(NETRACELLS[0]), false);
		for (let i = 1; i < 5; i++) {
			expect(isChecked(NETRACELLS[i])).toBe(false);
		}
	});
});

describe('Sequential group: Narmer', () => {
	test('checking kahlb3 checks kahl, kahlb1, kahlb2', () => {
		applyCheckboxLinking(elementFor(NARMER[3]), true);
		expect(isChecked(NARMER[0])).toBe(true);
		expect(isChecked(NARMER[1])).toBe(true);
		expect(isChecked(NARMER[2])).toBe(true);
		expect(isChecked(NARMER[4])).toBe(false);
	});

	test('unchecking kahl unchecks all kahlb', () => {
		for (const oid of NARMER) {
			setChecked(oid, true);
		}

		applyCheckboxLinking(elementFor(NARMER[0]), false);
		for (let i = 1; i < NARMER.length; i++) {
			expect(isChecked(NARMER[i])).toBe(false);
		}
	});

	test('checking kahl does not affect kahlb', () => {
		applyCheckboxLinking(elementFor(NARMER[0]), true);
		for (let i = 1; i < NARMER.length; i++) {
			expect(isChecked(NARMER[i])).toBe(false);
		}
	});
});

describe('Archimedea → Netracells linking', () => {
	test('checking Deep Archimedea with 0 checked adds 2: netracells 1 and 2 become checked', () => {
		applyCheckboxLinking(elementFor(DEEP_ARCH), true);
		expect(isChecked(NETRACELLS[0])).toBe(true);
		expect(isChecked(NETRACELLS[1])).toBe(true);
		expect(isChecked(NETRACELLS[2])).toBe(false);
		expect(isChecked(NETRACELLS[3])).toBe(false);
		expect(isChecked(NETRACELLS[4])).toBe(false);
	});

	test('checking Archimedea with 2 already checked adds 2 more: netracells 1-4 checked', () => {
		setChecked(NETRACELLS[0], true);
		setChecked(NETRACELLS[1], true);
		applyCheckboxLinking(elementFor(DEEP_ARCH), true);
		expect(isChecked(NETRACELLS[0])).toBe(true);
		expect(isChecked(NETRACELLS[1])).toBe(true);
		expect(isChecked(NETRACELLS[2])).toBe(true);
		expect(isChecked(NETRACELLS[3])).toBe(true);
		expect(isChecked(NETRACELLS[4])).toBe(false);
	});

	test('checking Archimedea with 4 already checked adds only 1 (capped at group size)', () => {
		for (let i = 0; i < 4; i++) {
			setChecked(NETRACELLS[i], true);
		}

		applyCheckboxLinking(elementFor(DEEP_ARCH), true);
		for (const oid of NETRACELLS) {
			expect(isChecked(oid)).toBe(true);
		}
	});

	test('checking Archimedea with 5 already checked changes nothing', () => {
		for (const oid of NETRACELLS) {
			setChecked(oid, true);
		}

		applyCheckboxLinking(elementFor(DEEP_ARCH), true);
		for (const oid of NETRACELLS) {
			expect(isChecked(oid)).toBe(true);
		}
	});

	test('unchecking Archimedea with 4 checked removes 2: netracells 1-2 remain', () => {
		for (let i = 0; i < 4; i++) {
			setChecked(NETRACELLS[i], true);
		}

		applyCheckboxLinking(elementFor(DEEP_ARCH), false);
		expect(isChecked(NETRACELLS[0])).toBe(true);
		expect(isChecked(NETRACELLS[1])).toBe(true);
		expect(isChecked(NETRACELLS[2])).toBe(false);
		expect(isChecked(NETRACELLS[3])).toBe(false);
		expect(isChecked(NETRACELLS[4])).toBe(false);
	});

	test('unchecking Archimedea with 1 checked removes 2 (clamped): all unchecked', () => {
		setChecked(NETRACELLS[0], true);
		applyCheckboxLinking(elementFor(DEEP_ARCH), false);
		for (const oid of NETRACELLS) {
			expect(isChecked(oid)).toBe(false);
		}
	});

	test('unchecking Archimedea with 0 checked changes nothing', () => {
		applyCheckboxLinking(elementFor(DEEP_ARCH), false);
		for (const oid of NETRACELLS) {
			expect(isChecked(oid)).toBe(false);
		}
	});

	test('Netracell changes do NOT affect Archimedea', () => {
		setChecked(DEEP_ARCH, true);
		setChecked(TEMP_ARCH, true);
		applyCheckboxLinking(elementFor(NETRACELLS[2]), false);
		expect(isChecked(DEEP_ARCH)).toBe(true);
		expect(isChecked(TEMP_ARCH)).toBe(true);
	});
});
