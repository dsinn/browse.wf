/**
 Helpers for judging how fresh the stored profile snapshot is.

 Some profile fields (such as the daily standing and focus allowances) reset at 00:00 UTC, so they only
 mean something if the snapshot was taken during the current UTC day.
 */

import {getNextDailyResetMs, MILLIS_PER_DAY} from '../helpers/time-helpers.js';

export const PROFILE_TIMESTAMP_STORAGE_KEY = 'profile.dataFetchedAt';

/**
 Returns the time (ms since epoch) at which the stored profile data was fetched, or undefined if unknown.
 */
export function getProfileFetchedAt(): number | undefined {
	const stored = localStorage.getItem(PROFILE_TIMESTAMP_STORAGE_KEY);
	if (!stored) {
		return undefined;
	}

	const fetchedAt = Number(stored);
	return Number.isFinite(fetchedAt) ? fetchedAt : undefined;
}

/**
 Describes when the daily allowances next reset, as a time of day in the viewer's local time zone, e.g.
 "Resets daily at 4:00 PM PST." The reset itself is at 00:00 UTC.
 */
export function describeDailyReset(): string {
	const time = new Date(getNextDailyResetMs()).toLocaleTimeString(undefined, {
		hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
	});
	return `Resets daily at ${time}.`;
}

/**
 Returns true if the stored profile was fetched since the most recent 00:00 UTC.
 */
export function isProfileFromToday(now = Date.now()): boolean {
	const fetchedAt = getProfileFetchedAt();
	if (fetchedAt === undefined) {
		return false;
	}

	const startOfUtcDay = Math.floor(now / MILLIS_PER_DAY) * MILLIS_PER_DAY;
	return fetchedAt >= startOfUtcDay;
}
