export function setCompletionToggle(elm: HTMLAnchorElement, completed: boolean): void {
	const {oid} = elm.dataset;
	if (!oid) {
		return;
	}

	if ((globalThis as any).isOidMarkedAsCompleted(oid) !== completed) {
		(globalThis as any).toggleOidCompletion(oid);
	}

	elm.innerHTML = completed ? '<i class="bi bi-check-square"></i>' : '<i class="bi bi-square"></i>';
	const tooltip = (globalThis as any).bootstrap?.Tooltip.getInstance(elm);
	if (tooltip) {
		tooltip.setContent({'.tooltip-inner': (completed ? 'Unmark as ' : 'Mark as ') + 'completed'});
	}
}

export function refreshAllCompletionToggles(): void {
	for (const elm of document.querySelectorAll<HTMLAnchorElement>('.completion-check')) {
		const {oid} = elm.dataset;
		if (oid) {
			setCompletionToggle(elm, (globalThis as any).isOidMarkedAsCompleted(oid));
		}
	}
}

(globalThis as any).setCompletionToggle = setCompletionToggle;
(globalThis as any).refreshAllCompletionToggles = refreshAllCompletionToggles;
