/**
 * Daily completion checkboxes for Cavia and The Hex bounty headings.
 * Resets at midnight UTC, matching the Steel Path Incursions timer.
 */

import {getNextDailyResetMs} from '../helpers/time-helpers.js';

let dailyResetTimer: ReturnType<typeof setTimeout> | undefined;

export function updateBountyCheckboxes(): void {
	// Next daily reset in milliseconds — used as the OID suffix so pruning can compare directly to Date.now()
	const nextDailyReset = getNextDailyResetMs();

	for (const headingId of ['EntratiLabSyndicate-name', 'HexSyndicate-name']) {
		const heading = document.querySelector<HTMLElement>(`#${headingId}`);
		if (!heading) {
			continue;
		}

		const spanId = headingId.replace('-name', '-check');
		let span = document.querySelector<HTMLElement>(`#${spanId}`);
		if (span) {
			for (const x of span.querySelectorAll('[data-bs-toggle=tooltip]')) {
				window.bootstrap?.Tooltip.getInstance(x)?.dispose();
			}

			span.innerHTML = '';
		} else {
			heading.classList.add('d-flex', 'align-items-center');
			span = document.createElement('span');
			span.id = spanId;
			span.className = 'ms-2';
			heading.append(span);
		}

		span.append(createCompletionToggle(`${spanId}-${nextDailyReset}`));
	}

	// Schedule reset at next daily reset (UTC) — memoized so multiple calls don't stack timers
	dailyResetTimer ||= setTimeout(() => {
		dailyResetTimer = undefined;
		updateBountyCheckboxes();
	}, nextDailyReset - Date.now());
}

window.updateBountyCheckboxes = updateBountyCheckboxes;
