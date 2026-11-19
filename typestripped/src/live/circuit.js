/**
 Circuit card functionality for browse.wf

 Renders the two "The Circuit" entries in the Weekly Missions card using
 the EndlessXpSchedule array from worldState: wait for worldState, find the
 active entry by Activation/Expiry, re-schedule at expiry.
 */
import { pascalToTitleCase } from '../helpers/string-helpers.js';
import { scheduleAt } from '../timer-registry.js';
import { filterWeeklyMissions } from './weekly.js';
const STALE_DATA_RETRY_MS = 5000;
function choiceToDisplay(choice) {
    return pascalToTitleCase(choice).replaceAll(' And ', ' & ');
}
export function updateCircuitChoices() {
    const schedule = window.worldState?.EndlessXpSchedule;
    if (!schedule || schedule.length === 0) {
        setTimeout(updateCircuitChoices, STALE_DATA_RETRY_MS);
        return;
    }
    const now = Date.now();
    const active = schedule.find((entry) => Number(entry.Activation.$date.$numberLong) <= now && Number(entry.Expiry.$date.$numberLong) > now);
    if (!active) {
        setTimeout(updateCircuitChoices, STALE_DATA_RETRY_MS);
        return;
    }
    const expiry = Number(active.Expiry.$date.$numberLong);
    window.setDatum('circuit-header', 'Weekly Missions', expiry);
    const clearAndSet = (id, key) => {
        const element = document.querySelector(`#${id}`);
        for (const node of element.querySelectorAll('[data-bs-toggle=tooltip]')) {
            window.bootstrap?.Tooltip.getInstance(node)?.dispose();
        }
        element.replaceChildren(window.createCompletionToggle(key));
    };
    clearAndSet('circuit-frames-check', `circuit-normal-${expiry}`);
    clearAndSet('circuit-weapons-check', `circuit-hard-${expiry}`);
    scheduleAt(expiry, updateCircuitChoices);
    const normalChoices = active.CategoryChoices.find(c => c.Category === 'EXC_NORMAL')?.Choices ?? [];
    const hardChoices = active.CategoryChoices.find(c => c.Category === 'EXC_HARD')?.Choices ?? [];
    document.querySelector('#circuit-frames').textContent = normalChoices.map(c => choiceToDisplay(c)).join('\u{A0}\u{B7} ') + ' ';
    document.querySelector('#circuit-weapons').textContent = hardChoices.map(c => choiceToDisplay(c)).join('\u{A0}\u{B7} ') + ' ';
    filterWeeklyMissions();
}
window.updateCircuitChoices = updateCircuitChoices;
//# sourceMappingURL=circuit.js.map