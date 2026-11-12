/**
 Short timer badge: countdown badge showing only two units (e.g., "1h 23m" instead of "1h 23m 45s")
 */

import {SECONDS_PER_DAY, SECONDS_PER_HOUR} from './helpers/time-helpers.js';
import {registerTimerBadge, setTimerText} from './timer-registry.js';

/**
 Converts seconds to a human-readable format with only TWO units
 Examples:
 - 90,061s → ["1d", "1h"]     (not "1d 1h 1m 01s")
 - 3,661s  → ["1h", "1m"]     (not "1h 1m 01s")
 - 61s     → ["1m", "01s"]    (not "1m 01s" alone)
 */
function deltaToTwoUnits(deltaSeconds: number): string[] {
	deltaSeconds = Math.abs(deltaSeconds);

	const units: string[] = [];

	// Days
	if (deltaSeconds >= SECONDS_PER_DAY) {
		units.push(Math.trunc(deltaSeconds / SECONDS_PER_DAY) + 'd');
		deltaSeconds %= SECONDS_PER_DAY;
	}

	// Hours
	if (deltaSeconds >= SECONDS_PER_HOUR || units.length > 0) {
		units.push(Math.trunc(deltaSeconds / SECONDS_PER_HOUR) + 'h');
		if (units.length >= 2) {
			return units;
		}

		deltaSeconds %= SECONDS_PER_HOUR;
	}

	// Minutes (always show when showing seconds to maintain two units)
	units.push(Math.trunc(deltaSeconds / 60) + 'm');
	if (units.length >= 2) {
		return units;
	}

	deltaSeconds %= 60;

	// Seconds
	units.push(Math.trunc(deltaSeconds).toString().padStart(2, '0') + 's');
	return units;
}

/**
 Sets a badge's text to its countdown with two units or its expired label.
 Returns false once the expired label is showing.
 */
function updateShortTimer(elm: HTMLElement): boolean {
	const timestamp = Number.parseInt(elm.dataset.shortTimerExpiry ?? '', 10);
	const deltaSeconds = timestamp - Math.floor(Date.now() / 1000);

	if (deltaSeconds <= 0) {
		setTimerText(elm, elm.dataset.shortTimerExpiredLabel ?? 'Started');
		return false;
	}

	setTimerText(elm, deltaToTwoUnits(deltaSeconds).join(' '));
	return true;
}

/**
 Renders the badge, then schedules its next update based on which units are showing: a timeout for
 days + hours and hours + minutes, handing over to the shared ticker once seconds are showing
 */
function scheduleShortTimerUpdate(elm: HTMLElement): void {
	const timestamp = Number.parseInt(elm.dataset.shortTimerExpiry ?? '', 10);
	if (Number.isNaN(timestamp)) {
		return;
	}

	const deltaSeconds = timestamp - Math.floor(Date.now() / 1000);
	if (deltaSeconds < SECONDS_PER_HOUR) {
		// Showing minutes + seconds (or already expired): the ticker updates it now, and drops it once it returns false
		registerTimerBadge(elm, () => updateShortTimer(elm));
		return;
	}

	updateShortTimer(elm);

	// Days + hours: next change is at the top of the next hour; hours + minutes: at the top of the next minute
	const stepSeconds = deltaSeconds >= SECONDS_PER_DAY ? SECONDS_PER_HOUR : 60;
	setTimeout(() => {
		// Stop if the badge has been removed
		if (elm.isConnected) {
			scheduleShortTimerUpdate(elm);
		}
	}, (stepSeconds - (deltaSeconds % stepSeconds)) * 1000);
}

/**
 Creates a countdown badge element for a given timestamp
 */
export function createShortTimerBadge(timestamp: number, expiredLabel: string, extraClasses?: string): HTMLSpanElement {
	const span = document.createElement('span');
	span.dataset.shortTimerExpiry = timestamp.toString();
	span.dataset.shortTimerExpiredLabel = expiredLabel;
	span.className = `badge text-bg-secondary ${extraClasses ?? ''}`;
	span.style.display = 'inline-block';
	span.style.minWidth = '5.5em'; // Wide enough for "99d 99h"
	span.style.textAlign = 'center';
	// Renders the first update and schedules the rest
	scheduleShortTimerUpdate(span);
	return span;
}

/**
 Initializes short timer badges already present in the DOM
 */
export function initializeShortTimerBadges(): void {
	// Schedule updates for any existing badges
	for (const elm of document.querySelectorAll<HTMLElement>('[data-short-timer-expiry]')) {
		scheduleShortTimerUpdate(elm);
	}
}

window.createShortTimerBadge = createShortTimerBadge;
window.initializeShortTimerBadges = initializeShortTimerBadges;
