/**
 * Daily completion checkboxes for Cavia and The Hex bounty headings.
 * Resets at midnight UTC, matching the Steel Path Incursions timer.
 */

let dailyResetTimer: ReturnType<typeof setTimeout> | undefined;

export function updateBountyCheckboxes(): void {
	// LastDailyReset in seconds since epoch at start of UTC day — matches incursions_expiry calculation
	const lastDailyReset = Math.trunc(Date.now() / 86_400_000) * 86_400;

	for (const headingId of ['EntratiLabSyndicate-name', 'HexSyndicate-name']) {
		const heading = document.querySelector<HTMLElement>(`#${headingId}`);
		if (!heading) {
			continue;
		}

		const spanId = headingId.replace('-name', '-check');
		let span = document.querySelector<HTMLElement>(`#${spanId}`);
		if (span) {
			for (const x of span.querySelectorAll('[data-bs-toggle=tooltip]')) {
				globalThis.bootstrap?.Tooltip.getInstance(x)?.dispose();
			}

			span.innerHTML = '';
		} else {
			heading.classList.add('d-flex', 'align-items-center');
			span = document.createElement('span');
			span.id = spanId;
			span.className = 'ms-2';
			heading.append(span);
		}

		span.append(createCompletionToggle(`${spanId}-${lastDailyReset}`));
	}

	// Schedule reset at next daily reset (UTC) — memoized so multiple calls don't stack timers
	if (!dailyResetTimer) {
		const nextDailyReset = (lastDailyReset + 86_400) * 1000;
		dailyResetTimer = setTimeout(() => {
			dailyResetTimer = undefined;
			updateBountyCheckboxes();
		}, nextDailyReset - Date.now());
	}
}

(globalThis as any).updateBountyCheckboxes = updateBountyCheckboxes;
