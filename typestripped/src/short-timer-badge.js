/**
 * Short timer badge: countdown badge showing only two units (e.g., "1h 23m" instead of "1h 23m 45s")
 */
import { SECONDS_PER_DAY, SECONDS_PER_HOUR } from './helpers/time-helpers.js';
/**
 * Converts seconds to a human-readable format with only TWO units
 * Examples:
 *   - 90,061s → ["1d", "1h"]     (not "1d 1h 1m 01s")
 *   - 3,661s  → ["1h", "1m"]     (not "1h 1m 01s")
 *   - 61s     → ["1m", "01s"]    (not "1m 01s" alone)
 */
function deltaToTwoUnits(deltaSeconds) {
    deltaSeconds = Math.abs(deltaSeconds);
    const units = [];
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
 * Formats a timestamp as a countdown with two units
 */
function formatShortTimerCountdown(timestamp, expiredLabel) {
    const deltaSeconds = timestamp - Math.floor(Date.now() / 1000);
    if (deltaSeconds <= 0) {
        return expiredLabel;
    }
    return deltaToTwoUnits(deltaSeconds).join(' ');
}
/**
 * Schedules the next update for a countdown badge based on when the display text will change
 */
function scheduleShortTimerUpdate(elm) {
    const timestamp = Number.parseInt(elm.dataset.shortTimerExpiry ?? '', 10);
    const expiredLabel = elm.dataset.shortTimerExpiredLabel ?? 'Started';
    const deltaSeconds = timestamp - Math.floor(Date.now() / 1000);
    if (deltaSeconds <= 0) {
        // Timer has expired, no more updates needed
        elm.textContent = expiredLabel;
        return;
    }
    // Update the display
    elm.textContent = formatShortTimerCountdown(timestamp, expiredLabel);
    // Calculate delay until next update based on which units are showing
    if (deltaSeconds >= SECONDS_PER_DAY) {
        // Showing days + hours: update at top of next hour
        const delayMs = (SECONDS_PER_HOUR - (deltaSeconds % SECONDS_PER_HOUR)) * 1000;
        setTimeout(() => {
            scheduleShortTimerUpdate(elm);
        }, delayMs);
    }
    else if (deltaSeconds >= SECONDS_PER_HOUR) {
        // Showing hours + minutes: update at top of next minute
        const delayMs = (60 - (deltaSeconds % 60)) * 1000;
        setTimeout(() => {
            scheduleShortTimerUpdate(elm);
        }, delayMs);
    }
    else {
        // Showing minutes + seconds: use setInterval for regular 1-second updates
        const intervalId = setInterval(() => {
            const ts = Number.parseInt(elm.dataset.shortTimerExpiry ?? '', 10);
            const label = elm.dataset.shortTimerExpiredLabel ?? 'Started';
            const delta = ts - Math.floor(Date.now() / 1000);
            if (delta <= 0) {
                elm.textContent = label;
                clearInterval(intervalId);
                return;
            }
            elm.textContent = formatShortTimerCountdown(ts, label);
        }, 1000);
    }
}
/**
 * Creates a countdown badge element for a given timestamp
 */
export function createShortTimerBadge(timestamp, expiredLabel, extraClasses) {
    const span = document.createElement('span');
    span.dataset.shortTimerExpiry = timestamp.toString();
    span.dataset.shortTimerExpiredLabel = expiredLabel;
    span.className = `badge text-bg-secondary ${extraClasses ?? ''}`;
    span.style.display = 'inline-block';
    span.style.minWidth = '5.5em'; // Wide enough for "99d 99h"
    span.style.textAlign = 'center';
    span.textContent = formatShortTimerCountdown(timestamp, expiredLabel);
    // Schedule first update
    scheduleShortTimerUpdate(span);
    return span;
}
/**
 * Initializes short timer badges already present in the DOM
 */
export function initializeShortTimerBadges() {
    // Schedule updates for any existing badges
    for (const elm of document.querySelectorAll('[data-short-timer-expiry]')) {
        scheduleShortTimerUpdate(elm);
    }
}
window.createShortTimerBadge = createShortTimerBadge;
window.initializeShortTimerBadges = initializeShortTimerBadges;
//# sourceMappingURL=short-timer-badge.js.map