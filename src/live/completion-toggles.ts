export function setCompletionToggle(elm: HTMLAnchorElement, completed: boolean): void {
	const {oid} = elm.dataset;
	if (!oid) {
		return;
	}

	if (window.isOidMarkedAsCompleted!(oid) !== completed) {
		window.toggleOidCompletion!(oid);
	}

	elm.innerHTML = completed ? '<i class="bi bi-check-square"></i>' : '<i class="bi bi-square"></i>';
	const tooltip = window.bootstrap?.Tooltip.getInstance(elm);
	if (tooltip) {
		tooltip.setContent({'.tooltip-inner': (completed ? 'Unmark as ' : 'Mark as ') + 'completed'});
	}
}

export function refreshAllCompletionToggles(): void {
	for (const elm of document.querySelectorAll<HTMLAnchorElement>('.completion-check')) {
		const {oid} = elm.dataset;
		if (oid) {
			setCompletionToggle(elm, window.isOidMarkedAsCompleted!(oid));
		}
	}
}

window.setCompletionToggle = setCompletionToggle;
window.refreshAllCompletionToggles = refreshAllCompletionToggles;
