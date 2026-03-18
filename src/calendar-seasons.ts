/**
 * Calendar Seasons rendering for the live page and weekly-forecast page.
 * Displays the 1999 in-game calendar days with challenges, rewards, and upgrades.
 */

import {getSeasonLabel, formatSeasonDay, resolveCalendarSeasonDays} from './calendar-seasons-data.js';

function makeIcon(iconPath: string): HTMLImageElement {
	const img = document.createElement('img');
	img.style.height = '24px';
	img.style.width = '24px';
	img.style.objectFit = 'contain';
	img.alt = '';
	setImageSource(img, iconPath);
	return img;
}

/**
 * Cache for prepared calendar season data.
 * Shared across all calls to avoid resolving promises multiple times.
 */
let preparedData: Promise<{
	dict: Record<string, string>;
	exportChallenges: Record<string, any>;
	exportResources: Record<string, any>;
	exportBundles: Record<string, any>;
	exportBoosterPacks: Record<string, any>;
	exportBoosters: Record<string, any>;
}> | undefined = null;

/**
 * Resolves and caches all export promises needed for rendering calendar seasons.
 * Private helper - not exposed globally.
 */
async function prepareCalendarSeasonData(
	exportResources: Promise<Record<string, any>>,
	exportBundles: Promise<Record<string, any>>,
	exportBoosterPacks: Promise<Record<string, any>>,
	exportBoosters: Promise<Record<string, any>>,
	exportImages: Promise<Record<string, any>>,
): Promise<{
	dict: Record<string, string>;
	exportChallenges: Record<string, any>;
	exportResources: Record<string, any>;
	exportBundles: Record<string, any>;
	exportBoosterPacks: Record<string, any>;
	exportBoosters: Record<string, any>;
}> {
	if (preparedData !== undefined && preparedData !== null) {
		return preparedData;
	}

	preparedData = (async () => {
		const [dict, resolvedResources, resolvedBundles, resolvedBoosterPacks, resolvedBoosters, resolvedImages] = await Promise.all([
			getDictPromise(),
			exportResources,
			exportBundles,
			exportBoosterPacks,
			exportBoosters,
			exportImages,
		]);

		// Required for common.js' setImageSource
		(globalThis as any).ExportImages = resolvedImages;

		return {
			dict,
			exportChallenges: (globalThis as any).ExportChallenges ?? {},
			exportResources: resolvedResources,
			exportBundles: resolvedBundles,
			exportBoosterPacks: resolvedBoosterPacks,
			exportBoosters: resolvedBoosters,
		};
	})();

	return preparedData;
}

/**
 * Renders the content pane for a single calendar season.
 * Returns a div containing day rows for each day with events.
 */
export async function renderCalendarSeasonPane(
	season: any,
	exportResources: Promise<Record<string, any>>,
	exportBundles: Promise<Record<string, any>>,
	exportBoosterPacks: Promise<Record<string, any>>,
	exportBoosters: Promise<Record<string, any>>,
	exportImages: Promise<Record<string, any>>,
): Promise<HTMLDivElement> {
	const {
		dict, exportChallenges,
		exportResources: resolvedResources, exportBundles: resolvedBundles,
		exportBoosterPacks: resolvedBoosterPacks, exportBoosters: resolvedBoosters,
	} = await prepareCalendarSeasonData(
		exportResources,
		exportBundles,
		exportBoosterPacks,
		exportBoosters,
		exportImages,
	);

	const resolvedDays = resolveCalendarSeasonDays(season, dict, exportChallenges, resolvedResources, resolvedBundles, resolvedBoosterPacks, resolvedBoosters);

	const container = document.createElement('div');

	for (const dayData of resolvedDays) {
		// Two-column layout on md+: date label on left, events stacked on right
		const row = document.createElement('div');
		row.className = 'd-md-flex mb-3';

		const dateCol = document.createElement('div');
		dateCol.className = 'fw-bold small me-3 calendar-season-date';
		dateCol.textContent = `${dayData.events[0]?.emoji ?? ''} ${formatSeasonDay(dayData.day)}`;
		row.append(dateCol);

		const eventsCol = document.createElement('div');
		eventsCol.className = 'flex-grow-1';

		for (const event of dayData.events) {
			const eventRow = document.createElement('div');
			eventRow.className = 'd-flex align-items-start gap-2 mb-1';

			if (event.iconPath) {
				eventRow.append(makeIcon(event.iconPath));
			} else if (event.type === 'CET_UPGRADE') {
				const icon = document.createElement('span');
				icon.textContent = '✨';
				eventRow.append(icon);
			}

			const span = document.createElement('span');
			span.textContent = event.text;
			eventRow.append(span);

			eventsCol.append(eventRow);
		}

		row.append(eventsCol);
		container.append(row);
	}

	return container;
}

/**
 * Updates the Calendar Seasons card on the live page.
 * Reads worldState.KnownCalendarSeasons, renders the active season, and injects a completion toggle.
 */
export async function updateCalendarSeason(
	exportResources: Promise<Record<string, any>>,
	exportBundles: Promise<Record<string, any>>,
	exportBoosterPacks: Promise<Record<string, any>>,
	exportBoosters: Promise<Record<string, any>>,
	exportImages: Promise<Record<string, any>>,
): Promise<void> {
	const seasons: any[] = (globalThis as any).worldState?.KnownCalendarSeasons ?? [];
	if (seasons.length === 0) {
		return;
	}

	const now = Date.now();
	const activeSeason = seasons.find(s =>
		Number.parseInt(s.Activation.$date.$numberLong, 10) <= now && now < Number.parseInt(s.Expiry.$date.$numberLong, 10));

	if (activeSeason) {
		// Schedule re-render when the active season expires
		const expiry = Number.parseInt(activeSeason.Expiry.$date.$numberLong, 10);
		setTimeout(() => {
			void updateCalendarSeason(exportResources, exportBundles, exportBoosterPacks, exportBoosters, exportImages);
		}, expiry - Date.now());
	} else {
		// No active season yet — worldState may be stale; retry shortly
		setTimeout(() => {
			void updateCalendarSeason(exportResources, exportBundles, exportBoosterPacks, exportBoosters, exportImages);
		}, 5000);
		return;
	}

	const seasonToRender = activeSeason ?? seasons[0];

	// Inject expiry badge into header
	const expirySpan = document.querySelector('#calendar-season-expiry');
	if (expirySpan) {
		expirySpan.innerHTML = '';
		expirySpan.append(createExpiryBadge(Number.parseInt(activeSeason.Expiry.$date.$numberLong, 10)));
	}

	// Inject completion toggle into header span
	const checksSpan = document.querySelector('#calendar-season-checks');
	if (checksSpan) {
		const oid = `calendarseason-${String(seasonToRender.Activation.$date.$numberLong)}`;
		checksSpan.innerHTML = '';
		checksSpan.append(createCompletionToggle(oid));
	}

	const body = document.querySelector('#calendar-season-body');
	if (body) {
		body.innerHTML = '';
		body.append(await renderCalendarSeasonPane(seasonToRender, exportResources, exportBundles, exportBoosterPacks, exportBoosters, exportImages));
	}
}

(globalThis as any).renderCalendarSeasonPane = renderCalendarSeasonPane;
(globalThis as any).updateCalendarSeason = updateCalendarSeason;
