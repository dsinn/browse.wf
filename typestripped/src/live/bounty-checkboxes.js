/**
 Daily completion checkboxes for Cavia and The Hex bounty headings.
 Resets at midnight UTC, matching the Steel Path Incursions timer.
 */
import { getNextDailyResetMs } from '../helpers/time-helpers.js';
import { scheduleAt } from '../timer-registry.js';
import { createDataWarning } from './data-warning.js';
let dailyResetTimer;
export function updateBountyCheckboxes() {
    // Next daily reset in milliseconds — used as the OID suffix so pruning can compare directly to Date.now()
    const nextDailyReset = getNextDailyResetMs();
    for (const headingId of ['EntratiLabSyndicate-name', 'HexSyndicate-name']) {
        const heading = document.querySelector(`#${headingId}`);
        if (!heading) {
            continue;
        }
        const spanId = headingId.replace('-name', '-check');
        let span = document.querySelector(`#${spanId}`);
        if (span) {
            for (const x of span.querySelectorAll('[data-bs-toggle=tooltip]')) {
                window.bootstrap?.Tooltip.getInstance(x)?.dispose();
            }
            span.replaceChildren();
        }
        else {
            heading.classList.add('d-flex', 'align-items-center');
            if (headingId === 'EntratiLabSyndicate-name') {
                heading.append(createDataWarning('EntratiLabSyndicate-warning', 'Bounty objectives may be incorrect.'));
            }
            span = document.createElement('span');
            span.id = spanId;
            span.className = 'ms-2';
            heading.append(span);
        }
        span.append(createCompletionToggle(`${spanId}-${nextDailyReset}`));
    }
    // Schedule reset at next daily reset (UTC) — memoized so multiple calls don't stack timers
    dailyResetTimer ||= scheduleAt(nextDailyReset, () => {
        dailyResetTimer = undefined;
        updateBountyCheckboxes();
    });
}
window.updateBountyCheckboxes = updateBountyCheckboxes;
//# sourceMappingURL=bounty-checkboxes.js.map