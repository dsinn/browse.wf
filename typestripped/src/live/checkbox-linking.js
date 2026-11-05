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
function applySequentialGroup(element, nowChecked) {
    const container = element.closest('[data-checkbox-group]');
    if (!container) {
        return;
    }
    const siblings = [...container.querySelectorAll('.completion-check')];
    const idx = siblings.indexOf(element);
    if (idx === -1) {
        return;
    }
    if (nowChecked) {
        for (let i = 0; i < idx; i++) {
            window.setCompletionToggle(siblings[i], true);
        }
    }
    else {
        for (let i = idx + 1; i < siblings.length; i++) {
            window.setCompletionToggle(siblings[i], false);
        }
    }
}
function autocheckLinkedBoxes(element, nowChecked) {
    const source = element.closest('[data-autocheck-target]');
    if (!source) {
        return;
    }
    const targetSelector = source.dataset.autocheckTarget;
    if (!targetSelector) {
        return;
    }
    const count = Number.parseInt(source.dataset.autocheckCount ?? '1', 10);
    const target = document.querySelector(targetSelector);
    if (!target) {
        return;
    }
    const checkboxes = [...target.querySelectorAll('.completion-check')];
    const currentCount = checkboxes.filter(checkbox => window.isOidMarkedAsCompleted(checkbox.dataset.oid)).length;
    const targetCount = Math.min(Math.max(currentCount + (nowChecked ? count : -count), 0), checkboxes.length);
    for (const [i, checkbox] of checkboxes.entries()) {
        window.setCompletionToggle(checkbox, i < targetCount);
    }
}
export function applyCheckboxLinking(element, nowChecked) {
    applySequentialGroup(element, nowChecked);
    autocheckLinkedBoxes(element, nowChecked);
}
window.applyCheckboxLinking = applyCheckboxLinking;
//# sourceMappingURL=checkbox-linking.js.map