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

// Warframe weekly reset epoch, sourced from the upstream invigorations implementation
const WEEK_EPOCH_MS = 1_391_990_400_000; // 2014-02-10T00:00:00Z

/** Returns the Warframe week index for a given millisecond timestamp. */
export function getWeekIndex(timestamp: number): number {
	return Math.trunc((timestamp - WEEK_EPOCH_MS) / MILLIS_PER_WEEK);
}
