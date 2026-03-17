/**
 * Pure data transformation layer for the 1999 Calendar Seasons.
 * No DOM dependencies — usable in both browser and Node.js environments.
 *
 * Consumed by:
 *   - src/calendar-seasons.ts          (browser DOM rendering, via globals)
 *   - src/calendar-seasons-data.mts    (ES module re-export for Node/tests)
 */

interface IResolvedCalendarEvent
{
	type: string;         // e.g. "CET_CHALLENGE", "CET_REWARD", "CET_UPGRADE"
	emoji: string;        // e.g. "📋", "🎁", "🔧"
	dateStr: string;      // e.g. "Jan 5"
	text: string;         // fully resolved display text
	iconPath?: string;    // item/challenge icon path, if available
}

interface IResolvedCalendarDay
{
	day: number;
	events: IResolvedCalendarEvent[];
}

export const SEASON_LABELS: Record<string, string> = {
	CST_SPRING: "🌸 Spring",
	CST_SUMMER: "🌻 Summer",
	CST_FALL:   "🍁 Autumn",
	CST_WINTER: "❄️ Winter",
};

const EVENT_EMOJI: Record<string, string> = {
	CET_CHALLENGE: "📋",
	CET_REWARD:    "🎁",
	CET_UPGRADE:   "🔧",
};

export function getSeasonLabel(season: string): string
{
	return SEASON_LABELS[season] ?? season;
}

/**
 * Converts a 1-indexed day of the 1999 in-game calendar to a short date string.
 * Day 1 = Jan 1, Day 101 = Apr 11, etc.
 */
export function formatSeasonDay(day: number): string
{
	return new Date(1999, 0, day).toLocaleDateString("en", { month: "short", day: "numeric" });
}

export function camelToWords(s: string): string
{
	return s.replace(/(?<=.)(?=[A-Z])/g, " ");
}

function lastSegment(path: string): string
{
	return path.split("/").pop() ?? path;
}

/**
 * Builds itemNameMap from export data.
 * Keys are normalized (StoreItems prefix stripped).
 */
export function buildItemMaps(
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
 * Resolves a calendar season's days into display-ready rows.
 * Returns one IResolvedCalendarDay per day that has events, in order.
 */
export function resolveCalendarSeasonDays(
	season: any,
	dict: Record<string, string>,
	ExportChallenges: Record<string, any>,
	ExportResources: Record<string, any>,
	ExportBundles: Record<string, any>,
	ExportBoosterPacks: Record<string, any>,
	ExportBoosters: Record<string, any>
): IResolvedCalendarDay[]
{
	const { itemIconMap, itemNameMap } = buildItemMaps(ExportResources, ExportBundles, ExportBoosterPacks, ExportBoosters);
	const daysWithEvents = (season.Days as any[]).filter((d: any) => d.events.length > 0);
	const result: IResolvedCalendarDay[] = [];

	for (const dayEntry of daysWithEvents)
	{
		const dateStr = formatSeasonDay(dayEntry.day);
		const resolvedEvents: IResolvedCalendarEvent[] = [];

		for (const event of dayEntry.events as any[])
		{
			const emoji = EVENT_EMOJI[event.type] ?? event.type;
			let text = "";

			let iconPath: string | undefined;

			if (event.type === "CET_CHALLENGE")
			{
				const challengeData = ExportChallenges[event.challenge];
				if (challengeData)
				{
					iconPath = challengeData.icon || undefined;
					const desc = challengeData.description ? dict[challengeData.description] : null;
					const count = challengeData.requiredCount;
					if (desc && count)
					{
						text = desc.replace("|COUNT|", String(count));
					}
					else if (count)
					{
						text = camelToWords(lastSegment(event.challenge)) + " \u00d7" + count;
					}
					else
					{
						text = camelToWords(lastSegment(event.challenge));
					}
				}
				else
				{
					text = camelToWords(lastSegment(event.challenge));
				}
			}
			else if (event.type === "CET_REWARD")
			{
				const normalized = event.reward.replace("/Lotus/StoreItems/", "/Lotus/");
				iconPath = itemIconMap[normalized];
				const nameKey = itemNameMap[normalized];
				const rawName = (nameKey && dict[nameKey]) ?? camelToWords(lastSegment(event.reward));
				text = rawName.replace(/<[^>]+>\s*/g, "").trim();
			}
			else if (event.type === "CET_UPGRADE")
			{
				text = camelToWords(lastSegment(event.upgrade));
			}

			if (text)
			{
				resolvedEvents.push({ type: event.type, emoji, dateStr, text, iconPath });
			}
		}

		if (resolvedEvents.length > 0)
		{
			result.push({ day: dayEntry.day, events: resolvedEvents });
		}
	}

	return result;
}

// Expose globals for browser classic scripts; guard allows this file to run in Node.js too
if (typeof window !== "undefined")
{
	(window as any).getSeasonLabel = getSeasonLabel;
	(window as any).resolveCalendarSeasonDays = resolveCalendarSeasonDays;
	(window as any).buildItemMaps = buildItemMaps;
	(window as any).formatSeasonDay = formatSeasonDay;
	(window as any).camelToWords = camelToWords;
	(window as any).SEASON_LABELS = SEASON_LABELS;
}
