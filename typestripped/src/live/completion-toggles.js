export function setCompletionToggle(elm, completed) {
    const { oid } = elm.dataset;
    if (!oid) {
        return;
    }
    if (window.isOidMarkedAsCompleted(oid) !== completed) {
        window.toggleOidCompletion(oid);
    }
    elm.innerHTML = completed ? '<i class="bi bi-check-square"></i>' : '<i class="bi bi-square"></i>';
    const tooltip = window.bootstrap?.Tooltip.getInstance(elm);
    if (tooltip) {
        tooltip.setContent({ '.tooltip-inner': (completed ? 'Unmark as ' : 'Mark as ') + 'completed' });
    }
}
export function refreshAllCompletionToggles() {
    for (const elm of document.querySelectorAll('.completion-check')) {
        const { oid } = elm.dataset;
        if (oid) {
            setCompletionToggle(elm, window.isOidMarkedAsCompleted(oid));
        }
    }
}
window.setCompletionToggle = setCompletionToggle;
window.refreshAllCompletionToggles = refreshAllCompletionToggles;
//# sourceMappingURL=completion-toggles.js.map