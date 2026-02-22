/**
 * Calendar Seasons rendering for the live page and weekly-forecast page.
 * Displays the 1999 in-game calendar days with challenges, rewards, and upgrades.
 */

// Globals available on the live page from live.ts
declare function getDictPromise(): Promise<Record<string, string>>;
declare function createCompletionToggle(oid: string): HTMLAnchorElement;
declare function setImageSource(img: HTMLImageElement, icon: string): void;

const SEASON_LABELS: Record<string, string> = {
	CST_SPRING: "🌸 Spring",
	CST_SUMMER: "🌻 Summer",
	CST_FALL:   "🍁 Autumn",
	CST_WINTER: "❄️ Winter",
};

function getSeasonLabel(season: string): string
{
	return SEASON_LABELS[season] ?? season;
}

/**
 * Converts a 1-indexed day of the 1999 in-game calendar to a short date string.
 * Day 1 = Jan 1, Day 101 = Apr 11, etc.
 */
function formatSeasonDay(day: number): string
{
	return new Date(1999, 0, day).toLocaleDateString("en", { month: "short", day: "numeric" });
}

/**
 * Converts a camelCase identifier to words: "GasChanceToPrimary" → "Gas Chance To Primary"
 */
function camelToWords(s: string): string
{
	return s.replace(/(?<=.)(?=[A-Z])/g, " ");
}

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
 * Shared across all calls to avoid rebuilding item maps multiple times.
 */
let preparedData: Promise<{
	dict: Record<string, string>;
	ExportChallenges: Record<string, any>;
	itemIconMap: Record<string, string>;
	itemNameMap: Record<string, string>;
}> | null = null;

/**
 * Prepares all data needed for rendering calendar seasons.
 * Awaits export promises, builds item maps, and returns everything needed.
 * Results are cached to avoid rebuilding maps on subsequent calls.
 * Private helper - not exposed globally.
 */
async function prepareCalendarSeasonData(
	ExportResources: Promise<Record<string, any>>,
	ExportBundles: Promise<Record<string, any>>,
	ExportBoosterPacks: Promise<Record<string, any>>,
	ExportBoosters: Promise<Record<string, any>>
): Promise<{
	dict: Record<string, string>;
	ExportChallenges: Record<string, any>;
	itemIconMap: Record<string, string>;
	itemNameMap: Record<string, string>;
}>
{
	if (preparedData)
	{
		return preparedData;
	}

	// Build the data (only happens once)
	preparedData = (async () =>
	{
		// Await all export data
		const [dict, resolvedResources, resolvedBundles, resolvedBoosterPacks, resolvedBoosters] = await Promise.all([
			getDictPromise(),
			ExportResources,
			ExportBundles,
			ExportBoosterPacks,
			ExportBoosters
		]);

		const ExportChallenges: Record<string, any> = (window as any).ExportChallenges ?? {};

		const { itemIconMap, itemNameMap } = buildItemMaps(resolvedResources, resolvedBundles, resolvedBoosterPacks, resolvedBoosters);

		return {
			dict,
			ExportChallenges,
			itemIconMap,
			itemNameMap
		};
	})();

	return preparedData;
}

/**
 * Builds itemIconMap and itemNameMap from export data.
 * Private helper used internally by calendar season rendering.
 */
function buildItemMaps(
	ExportResources: Record<string, any>,
	ExportBundles: Record<string, any>,
	ExportBoosterPacks: Record<string, any>,
	ExportBoosters: Record<string, any>
): { itemIconMap: Record<string, string>; itemNameMap: Record<string, string> }
{
	const itemIconMap: Record<string, string> = {};
	const itemNameMap: Record<string, string> = {};
	for (const exportData of [ExportResources, ExportBundles, ExportBoosterPacks, ExportBoosters])
	{
		for (const [key, val] of Object.entries(exportData) as [string, any][])
		{
			const normalized = key.replace("/Lotus/StoreItems/", "/Lotus/");
			if (val.icon) itemIconMap[normalized] = val.icon;
			if (val.name) itemNameMap[normalized] = val.name;
		}
	}
	return { itemIconMap, itemNameMap };
}

/**
 * Renders the content pane for a single calendar season.
 * Returns a div containing day rows for each day with events.
 */
async function renderCalendarSeasonPane(
	season: any,
	ExportResources: Promise<Record<string, any>>,
	ExportBundles: Promise<Record<string, any>>,
	ExportBoosterPacks: Promise<Record<string, any>>,
	ExportBoosters: Promise<Record<string, any>>
): Promise<HTMLDivElement>
{
	// Prepare all data needed for rendering (cached)
	const { dict, ExportChallenges, itemIconMap, itemNameMap } = await prepareCalendarSeasonData(
		ExportResources,
		ExportBundles,
		ExportBoosterPacks,
		ExportBoosters
	);

	const container = document.createElement("div");

	const EVENT_EMOJI: Record<string, string> = { CET_CHALLENGE: "📋", CET_REWARD: "🎁", CET_UPGRADE: "🔧" };
	const daysWithEvents = (season.Days as any[]).filter(d => d.events.length > 0);

	for (const dayEntry of daysWithEvents)
	{
		// Two-column layout on md+: date label on left, events stacked on right
		const row = document.createElement("div");
		row.className = "d-md-flex mb-3";

		const dateCol = document.createElement("div");
		dateCol.className = "fw-bold small me-3 calendar-season-date";
		dateCol.textContent = (EVENT_EMOJI[dayEntry.events[0].type] ?? "") + " " + formatSeasonDay(dayEntry.day);
		row.appendChild(dateCol);

		const eventsCol = document.createElement("div");
		eventsCol.className = "flex-grow-1";

		for (const event of dayEntry.events as any[])
		{
			const eventRow = document.createElement("div");
			eventRow.className = "d-flex align-items-start gap-2 mb-1";

			if (event.type === "CET_CHALLENGE")
			{
				const challengeData = ExportChallenges[event.challenge];
				if (challengeData)
				{
					eventRow.appendChild(makeIcon(challengeData.icon));

					const span = document.createElement("span");
					const desc = challengeData.description ? dict[challengeData.description] : null;
					const count = challengeData.requiredCount;
					if (desc && count)
					{
						span.textContent = desc.replace("|COUNT|", String(count));
					}
					else if (count)
					{
						span.textContent = camelToWords(event.challenge.split("/").pop() ?? "") + " \u00d7" + count;
					}
					else
					{
						span.textContent = camelToWords(event.challenge.split("/").pop() ?? event.challenge);
					}
					eventRow.appendChild(span);
				}
				else
				{
					const span = document.createElement("span");
					span.textContent = camelToWords(event.challenge.split("/").pop() ?? event.challenge);
					eventRow.appendChild(span);
				}
			}
			else if (event.type === "CET_REWARD")
			{
				const normalized = event.reward.replace("/Lotus/StoreItems/", "/Lotus/");
				const iconPath = itemIconMap[normalized];
				const nameKey = itemNameMap[normalized];

				if (iconPath)
				{
					eventRow.appendChild(makeIcon(iconPath));
				}

				const span = document.createElement("span");
				span.textContent = (nameKey && dict[nameKey]) ?? camelToWords(event.reward.split("/").pop() ?? event.reward);
				eventRow.appendChild(span);
			}
			else if (event.type === "CET_UPGRADE")
			{
				const icon = document.createElement("span");
				icon.textContent = "✨";
				eventRow.appendChild(icon);

				const span = document.createElement("span");
				span.textContent = camelToWords(event.upgrade.split("/").pop() ?? event.upgrade);
				eventRow.appendChild(span);
			}

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
async function updateCalendarSeason(
	ExportResources: Promise<Record<string, any>>,
	ExportBundles: Promise<Record<string, any>>,
	ExportBoosterPacks: Promise<Record<string, any>>,
	ExportBoosters: Promise<Record<string, any>>
): Promise<void>
{
	const seasons: any[] = (window as any).worldState?.KnownCalendarSeasons ?? [];
	if (seasons.length === 0) return;

	const now = Date.now();
	const activeSeason = seasons.find(s =>
		parseInt(s.Activation.$date.$numberLong) <= now && now < parseInt(s.Expiry.$date.$numberLong)
	) ?? seasons[0];

	// Inject completion toggle into header span
	const checksSpan = document.getElementById("calendar-season-checks");
	if (checksSpan)
	{
		const oid = "calendarseason-" + activeSeason.Activation.$date.$numberLong;
		checksSpan.innerHTML = "";
		checksSpan.appendChild(createCompletionToggle(oid));
	}

	const body = document.getElementById("calendar-season-body");
	if (body)
	{
		body.innerHTML = "";
		body.appendChild(await renderCalendarSeasonPane(activeSeason, ExportResources, ExportBundles, ExportBoosterPacks, ExportBoosters));
	}
}

(window as any).getSeasonLabel = getSeasonLabel;
(window as any).renderCalendarSeasonPane = renderCalendarSeasonPane;
(window as any).updateCalendarSeason = updateCalendarSeason;
