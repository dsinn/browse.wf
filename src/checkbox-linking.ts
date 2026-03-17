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

function applySequentialGroup(el: HTMLElement, nowChecked: boolean): void {
    const container = el.closest<HTMLElement>("[data-checkbox-group]");
    if (!container) return;

    const siblings = Array.from(container.querySelectorAll<HTMLAnchorElement>(".completion-check"));
    const idx = siblings.indexOf(el as HTMLAnchorElement);
    if (idx === -1) return;

    if (nowChecked) {
        for (let i = 0; i < idx; i++) {
            (window as any).setCompletionToggle(siblings[i], true);
        }
    } else {
        for (let i = idx + 1; i < siblings.length; i++) {
            (window as any).setCompletionToggle(siblings[i], false);
        }
    }
}

function autocheckLinkedBoxes(el: HTMLElement, nowChecked: boolean): void {
    const source = el.closest<HTMLElement>("[data-autocheck-target]");
    if (!source) return;

    const targetSelector = source.getAttribute("data-autocheck-target")!;
    const count = parseInt(source.getAttribute("data-autocheck-count") ?? "1", 10);
    const target = document.querySelector<HTMLElement>(targetSelector);
    if (!target) return;

    const checkboxes = Array.from(target.querySelectorAll<HTMLAnchorElement>(".completion-check"));
    const currentCount = checkboxes.filter(checkbox => (window as any).isOidMarkedAsCompleted(checkbox.getAttribute("data-oid")!)).length;
    const targetCount = Math.min(Math.max(currentCount + (nowChecked ? count : -count), 0), checkboxes.length);

    for (let i = 0; i < checkboxes.length; i++) {
        (window as any).setCompletionToggle(checkboxes[i], i < targetCount);
    }
}

export function applyCheckboxLinking(el: HTMLElement, nowChecked: boolean): void {
    applySequentialGroup(el, nowChecked);
    autocheckLinkedBoxes(el, nowChecked);
}

(window as any).applyCheckboxLinking = applyCheckboxLinking;
