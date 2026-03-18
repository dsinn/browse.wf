/**
 * Checkbox linking: cross-card completion checkbox relationships
 *
 * Behaviour is declared in the HTML via data-* attributes — no registration needed:
 *
 * Sequential groups: containers with [data-checkbox-group] treat their .completion-check
 * children as an ordered sequence. Checking any box checks all to its left; unchecking
 * unchecks all to its right.
 *
 * Autocheck links: elements with [data-autocheck-target] and [data-autocheck-count]
 * drive an automatic relationship. When a .completion-check inside such an element is
 * toggled, the checked count of the target group adjusts by ±count.
 */

function applySequentialGroup(element: HTMLElement, nowChecked: boolean): void {
	const container = element.closest<HTMLElement>('[data-checkbox-group]');
	if (!container) {
		return;
	}

	const siblings = [...container.querySelectorAll<HTMLAnchorElement>('.completion-check')];
	const idx = siblings.indexOf(element as HTMLAnchorElement);
	if (idx === -1) {
		return;
	}

	if (nowChecked) {
		for (let i = 0; i < idx; i++) {
			(globalThis as any).setCompletionToggle(siblings[i], true);
		}
	} else {
		for (let i = idx + 1; i < siblings.length; i++) {
			(globalThis as any).setCompletionToggle(siblings[i], false);
		}
	}
}

function autocheckLinkedBoxes(element: HTMLElement, nowChecked: boolean): void {
	const source = element.closest<HTMLElement>('[data-autocheck-target]');
	if (!source) {
		return;
	}

	const targetSelector = source.dataset.autocheckTarget;
	const count = Number.parseInt(source.dataset.autocheckCount ?? '1', 10);
	const target = document.querySelector<HTMLElement>(targetSelector);
	if (!target) {
		return;
	}

	const checkboxes = [...target.querySelectorAll<HTMLAnchorElement>('.completion-check')];
	const currentCount = checkboxes.filter(checkbox => (globalThis as any).isOidMarkedAsCompleted(checkbox.dataset.oid)).length;
	const targetCount = Math.min(Math.max(currentCount + (nowChecked ? count : -count), 0), checkboxes.length);

	for (const [i, checkbox] of checkboxes.entries()) {
		(globalThis as any).setCompletionToggle(checkbox, i < targetCount);
	}
}

export function applyCheckboxLinking(element: HTMLElement, nowChecked: boolean): void {
	applySequentialGroup(element, nowChecked);
	autocheckLinkedBoxes(element, nowChecked);
}

(globalThis as any).applyCheckboxLinking = applyCheckboxLinking;
