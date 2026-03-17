/**
 * Calendar Seasons rendering for the live page and weekly-forecast page.
 * Displays the 1999 in-game calendar days with challenges, rewards, and upgrades.
 */

import { getSeasonLabel, formatSeasonDay, resolveCalendarSeasonDays } from './calendar-seasons-data.js';

function makeIcon(iconPath: string): HTMLImageElement
{
	const img = document.createElement("img");
	img.style.height = "24px";
	img.style.width = "24px";
	img.style.objectFit = "contain";
	img.alt = "";
	setImageSource(img, iconPath);
	return img;
}

/**
 * Cache for prepared calendar season data.
 * Shared across all calls to avoid resolving promises multiple times.
 */
let preparedData: Promise<{
	dict: Record<string, string>;
	ExportChallenges: Record<string, any>;
	ExportResources: Record<string, any>;
	ExportBundles: Record<string, any>;
	ExportBoosterPacks: Record<string, any>;
	ExportBoosters: Record<string, any>;
}> | null = null;

/**
 * Resolves and caches all export promises needed for rendering calendar seasons.
 * Private helper - not exposed globally.
 */
async function prepareCalendarSeasonData(
	ExportResources: Promise<Record<string, any>>,
	ExportBundles: Promise<Record<string, any>>,
	ExportBoosterPacks: Promise<Record<string, any>>,
	ExportBoosters: Promise<Record<string, any>>,
	ExportImages: Promise<Record<string, any>>
): Promise<{
	dict: Record<string, string>;
	ExportChallenges: Record<string, any>;
	ExportResources: Record<string, any>;
	ExportBundles: Record<string, any>;
	ExportBoosterPacks: Record<string, any>;
	ExportBoosters: Record<string, any>;
}>
{
	if (preparedData)
	{
		return preparedData;
	}

	preparedData = (async () =>
	{
		const [dict, resolvedResources, resolvedBundles, resolvedBoosterPacks, resolvedBoosters, resolvedImages] = await Promise.all([
			getDictPromise(),
			ExportResources,
			ExportBundles,
			ExportBoosterPacks,
			ExportBoosters,
			ExportImages
		]);

		// Required for common.js' setImageSource
		(window as any).ExportImages = resolvedImages;

		return {
			dict,
			ExportChallenges: (window as any).ExportChallenges ?? {},
			ExportResources: resolvedResources,
			ExportBundles: resolvedBundles,
			ExportBoosterPacks: resolvedBoosterPacks,
			ExportBoosters: resolvedBoosters,
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
	ExportResources: Promise<Record<string, any>>,
	ExportBundles: Promise<Record<string, any>>,
	ExportBoosterPacks: Promise<Record<string, any>>,
	ExportBoosters: Promise<Record<string, any>>,
	ExportImages: Promise<Record<string, any>>
): Promise<HTMLDivElement>
{
	const { dict, ExportChallenges, ExportResources: resolvedResources, ExportBundles: resolvedBundles, ExportBoosterPacks: resolvedBoosterPacks, ExportBoosters: resolvedBoosters } = await prepareCalendarSeasonData(
		ExportResources,
		ExportBundles,
		ExportBoosterPacks,
		ExportBoosters,
		ExportImages
	);

	const resolvedDays = resolveCalendarSeasonDays(
		season, dict, ExportChallenges, resolvedResources, resolvedBundles, resolvedBoosterPacks, resolvedBoosters
	);

	const container = document.createElement("div");

	for (const dayData of resolvedDays)
	{
		// Two-column layout on md+: date label on left, events stacked on right
		const row = document.createElement("div");
		row.className = "d-md-flex mb-3";

		const dateCol = document.createElement("div");
		dateCol.className = "fw-bold small me-3 calendar-season-date";
		dateCol.textContent = (dayData.events[0]?.emoji ?? "") + " " + formatSeasonDay(dayData.day);
		row.appendChild(dateCol);

		const eventsCol = document.createElement("div");
		eventsCol.className = "flex-grow-1";

		for (const event of dayData.events)
		{
			const eventRow = document.createElement("div");
			eventRow.className = "d-flex align-items-start gap-2 mb-1";

			if (event.iconPath)
			{
				eventRow.appendChild(makeIcon(event.iconPath));
			}
			else if (event.type === "CET_UPGRADE")
			{
				const icon = document.createElement("span");
				icon.textContent = "✨";
				eventRow.appendChild(icon);
			}

			const span = document.createElement("span");
			span.textContent = event.text;
			eventRow.appendChild(span);

			eventsCol.appendChild(eventRow);
		}

		row.appendChild(eventsCol);
		container.appendChild(row);
	}

	return container;
}

/**
 * Updates the Calendar Seasons card on the live page.
 * Reads worldState.KnownCalendarSeasons, renders the active season, and injects a completion toggle.
 */
export async function updateCalendarSeason(
	ExportResources: Promise<Record<string, any>>,
	ExportBundles: Promise<Record<string, any>>,
	ExportBoosterPacks: Promise<Record<string, any>>,
	ExportBoosters: Promise<Record<string, any>>,
	ExportImages: Promise<Record<string, any>>
): Promise<void>
{
	const seasons: any[] = (window as any).worldState?.KnownCalendarSeasons ?? [];
	if (seasons.length === 0) return;

	const now = Date.now();
	const activeSeason = seasons.find(s =>
		parseInt(s.Activation.$date.$numberLong) <= now && now < parseInt(s.Expiry.$date.$numberLong)
	);

	if (activeSeason)
	{
		// Schedule re-render when the active season expires
		const expiry = parseInt(activeSeason.Expiry.$date.$numberLong);
		setTimeout(() => updateCalendarSeason(ExportResources, ExportBundles, ExportBoosterPacks, ExportBoosters, ExportImages), expiry - Date.now());
	}
	else
	{
		// No active season yet — worldState may be stale; retry shortly
		setTimeout(() => updateCalendarSeason(ExportResources, ExportBundles, ExportBoosterPacks, ExportBoosters, ExportImages), 5_000);
		return;
	}

	const seasonToRender = activeSeason ?? seasons[0];

	// Inject expiry badge into header
	const expirySpan = document.getElementById("calendar-season-expiry");
	if (expirySpan)
	{
		expirySpan.innerHTML = "";
		expirySpan.appendChild(createExpiryBadge(parseInt(activeSeason.Expiry.$date.$numberLong)));
	}

	// Inject completion toggle into header span
	const checksSpan = document.getElementById("calendar-season-checks");
	if (checksSpan)
	{
		const oid = "calendarseason-" + seasonToRender.Activation.$date.$numberLong;
		checksSpan.innerHTML = "";
		checksSpan.appendChild(createCompletionToggle(oid));
	}

	const body = document.getElementById("calendar-season-body");
	if (body)
	{
		body.innerHTML = "";
		body.appendChild(await renderCalendarSeasonPane(seasonToRender, ExportResources, ExportBundles, ExportBoosterPacks, ExportBoosters, ExportImages));
	}
}

(window as any).renderCalendarSeasonPane = renderCalendarSeasonPane;
(window as any).updateCalendarSeason = updateCalendarSeason;
