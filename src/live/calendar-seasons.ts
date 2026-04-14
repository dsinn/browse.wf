/**
 * Calendar Seasons card lifecycle for the /live page.
 * Handles active season detection, expiry-triggered re-renders,
 * and injection of the expiry badge and completion toggle.
 *
 * Depends on globals from common.js: createExpiryBadge, createCompletionToggle, setImageSource
 * Depends on globals from calendar-seasons.ts: renderCalendarSeasonPane
 */

import {fetchExport} from '../public-export-fetcher.js';
import {renderCalendarSeasonPane} from '../calendar-seasons/index.js';

declare function createExpiryBadge(expiryMs: number): Node;
declare function createCompletionToggle(oid: string): Node;

export async function updateCalendarSeason(): Promise<void> {
	const seasons: any[] = (window as any).worldState?.KnownCalendarSeasons ?? [];
	if (seasons.length === 0) {
		setTimeout(() => {
			void updateCalendarSeason();
		}, 5000);
		return;
	}

	const now = Date.now();
	const activeSeason = seasons.find(s =>
		Number.parseInt(s.Activation.$date.$numberLong, 10) <= now && now < Number.parseInt(s.Expiry.$date.$numberLong, 10));

	if (activeSeason) {
		// Schedule re-render when the active season expires
		const expiry = Number.parseInt(activeSeason.Expiry.$date.$numberLong, 10);
		setTimeout(() => {
			void updateCalendarSeason();
		}, expiry - Date.now());
	} else {
		// No active season yet — worldState may be stale; retry shortly
		setTimeout(() => {
			void updateCalendarSeason();
		}, 5000);
		return;
	}

	// Required for common.js' setImageSource, must be set before renderCalendarSeasonPane runs
	window.ExportImages = await fetchExport('ExportImages');

	// Inject expiry badge into header
	const expirySpan = document.querySelector('#calendar-season-expiry');
	if (expirySpan) {
		expirySpan.innerHTML = '';
		expirySpan.append(createExpiryBadge(Number.parseInt(activeSeason.Expiry.$date.$numberLong, 10)));
	}

	// Inject completion toggle into header span
	const checksSpan = document.querySelector('#calendar-season-checks');
	if (checksSpan) {
		const oid = `calendarseason-${String(activeSeason.Expiry.$date.$numberLong)}`;
		checksSpan.innerHTML = '';
		checksSpan.append(createCompletionToggle(oid));
	}

	const body = document.querySelector('#calendar-season-body');
	if (body) {
		body.innerHTML = '';
		body.append(await renderCalendarSeasonPane(activeSeason));
	}
}

window.updateCalendarSeason = updateCalendarSeason;
