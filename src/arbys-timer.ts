/**
 * Timer functionality for /arbys page
 * Displays countdowns with only two units (e.g., "1h 23m" instead of "1h 23m 45s")
 */

/**
 * Converts seconds to a human-readable format with only TWO units
 * Examples:
 *   - 90,061s → ["1d", "1h"]     (not "1d 1h 1m 01s")
 *   - 3,661s  → ["1h", "1m"]     (not "1h 1m 01s")
 *   - 61s     → ["1m", "01s"]    (not "1m 01s" alone)
 */
function deltaToTwoUnits(deltaSeconds: number): string[] {
	deltaSeconds = Math.abs(deltaSeconds);

	const units: string[] = [];

	// Days
	if (deltaSeconds >= 86_400) {
		units.push(Math.trunc(deltaSeconds / 86_400) + 'd');
		deltaSeconds %= 86_400;
	}

	// Hours
	if (deltaSeconds >= 3600 || units.length > 0) {
		units.push(Math.trunc(deltaSeconds / 3600) + 'h');
		if (units.length >= 2) {
			return units;
		}

		deltaSeconds %= 3600;
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
 * Formats a timestamp as a countdown with two units
 */
function formatArbyCountdown(timestamp: number): string {
	const deltaSeconds = timestamp - Math.floor(Date.now() / 1000);

	if (deltaSeconds <= 0) {
		return 'Started';
	}

	return deltaToTwoUnits(deltaSeconds).join(' ');
}

/**
 * Schedules the next update for a countdown badge based on when the display text will change
 */
function scheduleArbyUpdate(elm: HTMLElement): void {
	const timestamp = Number.parseInt(elm.dataset.arbyTimestamp, 10);
	const deltaSeconds = timestamp - Math.floor(Date.now() / 1000);

	if (deltaSeconds <= 0) {
		// Event has started, no more updates needed
		elm.textContent = 'Started';
		return;
	}

	// Update the display
	elm.textContent = formatArbyCountdown(timestamp);

	// Calculate delay until next update based on which units are showing
	if (deltaSeconds >= 86_400) {
		// Showing days + hours: update at top of next hour
		const delayMs = (3600 - (deltaSeconds % 3600)) * 1000;
		setTimeout(() => {
			scheduleArbyUpdate(elm);
		}, delayMs);
	} else if (deltaSeconds >= 3600) {
		// Showing hours + minutes: update at top of next minute
		const delayMs = (60 - (deltaSeconds % 60)) * 1000;
		setTimeout(() => {
			scheduleArbyUpdate(elm);
		}, delayMs);
	} else {
		// Showing minutes + seconds: use setInterval for regular 1-second updates
		const intervalId = setInterval(() => {
			const ts = Number.parseInt(elm.dataset.arbyTimestamp, 10);
			const delta = ts - Math.floor(Date.now() / 1000);

			if (delta <= 0) {
				elm.textContent = 'Started';
				clearInterval(intervalId);
				return;
			}

			elm.textContent = formatArbyCountdown(ts);
		}, 1000);
	}
}

/**
 * Creates a countdown badge element for an arbitration timestamp
 */
export function createArbyCountdownBadge(timestamp: number): HTMLSpanElement {
	const span = document.createElement('span');
	span.dataset.arbyTimestamp = timestamp.toString();
	span.className = 'badge text-bg-secondary me-2';
	// Override the #log span { display: block } CSS rule and set fixed width
	span.style.display = 'inline-block';
	span.style.width = '5.5em'; // Wide enough for "99d 99h"
	span.style.textAlign = 'center';
	span.textContent = formatArbyCountdown(timestamp);
	// Schedule first update
	scheduleArbyUpdate(span);
	return span;
}

/**
 * Initializes the timer system for the /arbys page
 * Each badge schedules its own updates based on when the display text will change
 */
export function initializeArbyTimer(): void {
	// Schedule updates for any existing badges
	for (const elm of document.querySelectorAll<HTMLElement>('[data-arby-timestamp]')) {
		scheduleArbyUpdate(elm);
	}
}

// Expose functions globally for non-module scripts
(globalThis as any).createArbyCountdownBadge = createArbyCountdownBadge;
(globalThis as any).initializeArbyTimer = initializeArbyTimer;
