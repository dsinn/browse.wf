import { totwo } from './helpers/time-helpers.js';
/**
 * Cetus/Deimos bounty-cycle constants. No network fetch is used to compute these - the cycle
 * is a fixed period with no detectable drift, measured against real `worldState` data over a
 * large (multi-year) time interval. `EPOCH_EXPIRY` is a real, verified `CetusSyndicate.Expiry`
 * timestamp, used only to anchor the projection's phase.
 */
export const PERIOD_MS = 8_998_874.803_232_359;
export const NIGHT_MS = 3_000_000; // 50 min
export const EPOCH_EXPIRY = 1_684_177_115_703;
const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * A safe upper bound on how many cycle windows (of either phase) a single calendar day can
 * contain: `ceil(day length / period length)` already accounts for a day catching a partial
 * window at each end, since that's the maximum number of period-length intervals (complete or
 * partial) that can fit within a fixed-length span. Verified empirically against 10 years of
 * real day boundaries (max observed: 10, matching this formula exactly). Used to size a fixed
 * pool of table rows/cells so they can be pre-created once and reused across re-renders
 * instead of created/destroyed each time.
 */
export const MAX_WINDOWS_PER_DAY = Math.ceil(DAY_MS / PERIOD_MS);
const DAY_HEADING_FORMAT_UTC = new Intl.DateTimeFormat(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
});
const DAY_HEADING_FORMAT_LOCAL = new Intl.DateTimeFormat(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
});
/**
 * Returns the `cycleExpiry` timestamp (ms) of the cycle whose expiry is at or after `from`.
 * Computed directly via modular arithmetic (`from` rounded up to the next `PERIOD_MS`
 * boundary relative to `EPOCH_EXPIRY`) rather than via a floor-to-index-then-multiply-back
 * step, since the index itself is never otherwise needed here. The inner `% PERIOD_MS` makes
 * this branch-free: it collapses the "already on a boundary" case (offset === 0) to a 0
 * distance-to-next-boundary instead of a full extra period.
 */
function getCycleExpiryAtOrAfter(from) {
    const offsetFromLastBoundary = (from - EPOCH_EXPIRY) % PERIOD_MS;
    const distanceToNextBoundary = (PERIOD_MS - offsetFromLastBoundary) % PERIOD_MS;
    return from + distanceToNextBoundary;
}
/**
 * Returns every cycle-window (of the given phase) whose start falls within
 * `[from, from + spanMs]`. Windows are returned in chronological order.
 */
export function getCycleWindows(phase, from, spanMs) {
    const windows = [];
    const until = from + spanMs;
    // Start one cycle early so a window that starts before `from` but ends after it isn't missed.
    let cycleExpiry = getCycleExpiryAtOrAfter(from) - PERIOD_MS;
    while (cycleExpiry < until + PERIOD_MS) {
        const window = phase === 'night'
            ? { start: cycleExpiry - NIGHT_MS, end: cycleExpiry }
            : { start: cycleExpiry - PERIOD_MS, end: cycleExpiry - NIGHT_MS };
        if (window.start >= from && window.start <= until) {
            windows.push(window);
        }
        cycleExpiry += PERIOD_MS;
    }
    return windows;
}
/** Formats a cycle window as "start–end" (en dash) in the given timezone and hour format. */
export function formatWindow(window, timeZone, hourFormat = '24') {
    return `${formatTime(window.start, timeZone, hourFormat)}–${formatTime(window.end, timeZone, hourFormat)}`;
}
function formatTime(timestamp, timeZone, hourFormat) {
    const date = new Date(timestamp);
    const hours = timeZone === 'utc' ? date.getUTCHours() : date.getHours();
    const minutes = timeZone === 'utc' ? date.getUTCMinutes() : date.getMinutes();
    switch (hourFormat) {
        case 'mil': {
            return totwo(hours) + totwo(minutes) + (timeZone === 'utc' ? 'Z' : '');
        }
        case '12': {
            const hour12 = (hours % 12) === 0 ? 12 : hours % 12;
            return `${totwo(hour12)}:${totwo(minutes)}${hours >= 12 ? 'pm' : 'am'}`;
        }
        case '24': {
            return `${totwo(hours)}:${totwo(minutes)}`;
        }
    }
}
/** Returns the calendar-day timestamp (local midnight or UTC midnight) that `timestamp` falls on. */
export function getDayBucket(timestamp, timeZone) {
    const date = new Date(timestamp);
    if (timeZone === 'utc') {
        return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    }
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
/**
 * Returns the calendar-day timestamp `dayOffset` calendar days after `dayBucket` (in the given
 * timezone). Unlike adding `dayOffset * DAY_MS`, this correctly lands on the next calendar
 * midnight across a DST transition, where a "day" isn't always exactly 24 hours of wall-clock
 * time in local mode.
 */
export function addCalendarDays(dayBucket, dayOffset, timeZone) {
    if (timeZone === 'utc') {
        return dayBucket + (dayOffset * DAY_MS);
    }
    const date = new Date(dayBucket);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + dayOffset).getTime();
}
/** Formats a day-bucket timestamp as e.g. "Fri, Aug 7". */
export function formatDayHeading(dayBucket, timeZone) {
    const format = timeZone === 'utc' ? DAY_HEADING_FORMAT_UTC : DAY_HEADING_FORMAT_LOCAL;
    return format.format(new Date(dayBucket));
}
/**
 * Groups cycle windows into one bucket per calendar day (in the given timezone),
 * covering exactly `dayCount` days starting from `startDayBucket`. Days with no
 * windows still get an entry (empty array).
 */
export function groupWindowsByDay(windows, startDayBucket, dayCount, timeZone) {
    const days = new Map();
    for (let i = 0; i < dayCount; i++) {
        days.set(addCalendarDays(startDayBucket, i, timeZone), []);
    }
    for (const window of windows) {
        const bucket = getDayBucket(window.start, timeZone);
        days.get(bucket)?.push(window);
    }
    return days;
}
/** True if the window has already ended as of `now`. */
export function isWindowPast(window, now) {
    return window.end < now;
}
/** True if `now` falls within the window (it's the currently in-progress cycle). */
export function isWindowActive(window, now) {
    return window.start <= now && now < window.end;
}
/**
 * Returns the timestamp (ms) of the next moment the rendered schedule could visibly change:
 * either a day/night (Fass/Vome) phase transition, or the calendar day rolling over in the
 * given timezone — whichever comes first. Two phase transitions occur per cycle (start and
 * end of the night window), so this is finer-grained than the cycle period itself.
 */
export function getNextBoundary(now, timeZone) {
    const cycleExpiry = getCycleExpiryAtOrAfter(now);
    const nightStart = cycleExpiry - NIGHT_MS;
    const phaseBoundary = now < nightStart ? nightStart : cycleExpiry;
    const todayBucket = getDayBucket(now, timeZone);
    const nextDayBucket = addCalendarDays(todayBucket, 1, timeZone);
    return Math.min(phaseBoundary, nextDayBucket);
}
//# sourceMappingURL=bounty-cycle-schedule.js.map