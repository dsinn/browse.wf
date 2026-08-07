export function getDaysInMonth(date: Date): number {
	return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function localDateToUtcDayTimestamp(date: Date): number {
	return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 1000;
}

/** Returns the millisecond timestamp of the next UTC midnight (daily reset). */
export function getNextDailyResetMs(): number {
	return (Math.trunc(Date.now() / MILLIS_PER_DAY) + 1) * MILLIS_PER_DAY;
}

/** Returns the millisecond timestamp of the next Monday 00:00 UTC (weekly reset). */
export function getNextWeeklyResetMs(): number {
	const now = new Date();
	const daysUntilMonday = (8 - now.getUTCDay()) % 7 || 7;
	return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday);
}

/** Returns the second timestamp of the next Monday 00:00 UTC (weekly reset). */
export function getNextWeeklyResetSeconds(): number {
	return getNextWeeklyResetMs() / 1000;
}

export const SECONDS_PER_HOUR = 60 * 60;
export const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;
export const SECONDS_PER_WEEK = 7 * SECONDS_PER_DAY;
export const MILLIS_PER_HOUR = SECONDS_PER_HOUR * 1000;
export const MILLIS_PER_DAY = SECONDS_PER_DAY * 1000;
export const MILLIS_PER_WEEK = SECONDS_PER_WEEK * 1000;

// Warframe weekly reset epoch, sourced from the worldState WeekCount
export const WEEK_EPOCH_MS = 1_391_990_400_000; // 2014-02-10T00:00:00Z

/** Returns the Warframe week index for a given millisecond timestamp. */
export function getWeekIndex(timestamp: number): number {
	return Math.trunc((timestamp - WEEK_EPOCH_MS) / MILLIS_PER_WEEK);
}

/** Zero-pads a number below 10 to two digits, e.g. 3 -> "03", 12 -> "12". */
export function totwo(number_: number): string {
	if (number_ < 10) {
		return '0' + number_;
	}

	return number_.toString();
}

/** Formats a `Date.prototype.getTimezoneOffset()`-style minute offset as "UTC+N"/"UTC-N". */
export function formattz(offsetMinutes: number): string {
	if (offsetMinutes === 0) {
		return 'UTC+0';
	}

	const offsetHours = offsetMinutes / 60;
	if (offsetHours < 0) {
		return 'UTC+' + (offsetHours * -1);
	}

	return 'UTC-' + offsetHours;
}

// Exposed for non-module scripts (e.g. arbys.ts) that can't use `import`.
window.totwo = totwo;
window.formattz = formattz;
