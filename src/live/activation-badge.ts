/**
 * Activation badge: shows how long ago something happened, as a single unit (e.g. "1m", "3h", "4d").
 * Anything under a minute old shows "1m".
 */

import {MILLIS_PER_DAY, MILLIS_PER_HOUR} from '../helpers/time-helpers.js';
import {deltaToUnits} from '../expiry-badge.js';

const MINUTE = 60 * 1000;

// The longest delay setTimeout accepts; anything larger fires immediately
const MAX_TIMEOUT = (2 ** 31) - 1;

/**
 * Sets the badge's text from its data-activation, then schedules the next update for when the unit changes
 */
function updateActivationBadge(badge: HTMLElement): void {
	const activation = Number.parseInt(badge.dataset.activation ?? '', 10);
	if (Number.isNaN(activation)) {
		return;
	}

	const elapsed = Date.now() - activation;
	let delay: number;
	if (elapsed < MINUTE) {
		badge.textContent = '1m';
		delay = (2 * MINUTE) - elapsed;
	} else {
		badge.textContent = deltaToUnits(elapsed)[0];

		// The text changes each time the elapsed time crosses a whole multiple of the unit showing
		let unit = MINUTE;
		if (elapsed >= MILLIS_PER_DAY) {
			unit = MILLIS_PER_DAY;
		} else if (elapsed >= MILLIS_PER_HOUR) {
			unit = MILLIS_PER_HOUR;
		}

		delay = unit - (elapsed % unit);
	}

	setTimeout(() => {
		// Stop if the badge has been removed
		if (badge.isConnected) {
			updateActivationBadge(badge);
		}
	}, Math.min(delay, MAX_TIMEOUT));
}

export function createActivationBadge(activationMs: number): HTMLSpanElement {
	const span = document.createElement('span');
	span.dataset.activation = activationMs.toString();
	span.className = 'badge text-bg-secondary';
	updateActivationBadge(span);
	return span;
}
