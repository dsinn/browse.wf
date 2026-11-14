/**
 Arbys page title indicator
 */
import {SECONDS_PER_HOUR} from '../helpers/time-helpers.js';

export const BASE_TITLE = 'Arbitration Schedule | browse.wf';

/**
 Prepends an emoji to the document title based on filters and the timing of the next arbitration:

 🔴 = a matching arbitration is live
 ⏳ = one starts within the hour
 None otherwise.

 `firstArbyTimestamp` is the start time (in seconds) of the first arbitration that matches the filters,
 or undefined if none does.
 */
export function updateArbyTitle(firstArbyTimestamp: number | undefined): void {
	let prefix = '';
	if (firstArbyTimestamp !== undefined) {
		const secondsUntilStart = firstArbyTimestamp - (Date.now() / 1000);
		if (secondsUntilStart <= 0) {
			prefix = '🔴 ';
		} else if (secondsUntilStart <= SECONDS_PER_HOUR) {
			prefix = '⏳ ';
		}
	}

	document.title = prefix + BASE_TITLE;
}

window.updateArbyTitle = updateArbyTitle;
