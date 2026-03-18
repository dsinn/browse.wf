/**
 * Pure data transformation layer for the 1999 Calendar Seasons.
 * No DOM dependencies — usable in both browser and Node.js environments.
 *
 * Consumed by:
 *   - src/calendar-seasons.ts          (browser DOM rendering, via globals)
 *   - src/calendar-seasons-data.mts    (ES module re-export for Node/tests)
 */

type IResolvedCalendarEvent = {
	type: string; // E.g. "CET_CHALLENGE", "CET_REWARD", "CET_UPGRADE"
	emoji: string; // E.g. "📋", "🎁", "🔧"
	dateStr: string; // E.g. "Jan 5"
	text: string; // Fully resolved display text
	iconPath?: string; // Item/challenge icon path, if available
};

type IResolvedCalendarDay = {
	day: number;
	events: IResolvedCalendarEvent[];
};

export const SEASON_LABELS: Record<string, string> = {
	CST_SPRING: '🌸 Spring',
	CST_SUMMER: '🌻 Summer',
	CST_FALL: '🍁 Autumn',
	CST_WINTER: '❄️ Winter',
};

const EVENT_EMOJI: Record<string, string> = {
	CET_CHALLENGE: '📋',
	CET_REWARD: '🎁',
	CET_UPGRADE: '🔧',
};

export function getSeasonLabel(season: string): string {
	return SEASON_LABELS[season] ?? season;
}

/**
 * Converts a 1-indexed day of the 1999 in-game calendar to a short date string.
 * Day 1 = Jan 1, Day 101 = Apr 11, etc.
 */
export function formatSeasonDay(day: number): string {
	return new Date(1999, 0, day).toLocaleDateString('en', {month: 'short', day: 'numeric'});
}

export function camelToWords(s: string): string {
	return s.replaceAll(/(?<=.)(?=[A-Z])/gu, ' ');
}

function lastSegment(path: string): string {
	return path.split('/').pop() ?? path;
}

/**
 * Builds itemNameMap from export data.
 * Keys are normalized (StoreItems prefix stripped).
 */
export function buildItemMaps(
	exportResources: Record<string, any>,
	exportBundles: Record<string, any>,
	exportBoosterPacks: Record<string, any>,
	exportBoosters: Record<string, any>,
): {itemIconMap: Record<string, string>; itemNameMap: Record<string, string>} {
	const itemIconMap: Record<string, string> = {};
	const itemNameMap: Record<string, string> = {};
	for (const exportData of [exportResources, exportBundles, exportBoosterPacks, exportBoosters]) {
		for (const [key, value] of Object.entries(exportData)) {
			const normalized = key.replace('/Lotus/StoreItems/', '/Lotus/');
			if (value.icon) {
				itemIconMap[normalized] = value.icon;
			}

			if (value.name) {
				itemNameMap[normalized] = value.name;
			}
		}
	}

	return {itemIconMap, itemNameMap};
}

/**
 * Resolves a calendar season's days into display-ready rows.
 * Returns one IResolvedCalendarDay per day that has events, in order.
 */
export function resolveCalendarSeasonDays(
	season: any,
	dict: Record<string, string>,
	exportChallenges: Record<string, any>,
	exportResources: Record<string, any>,
	exportBundles: Record<string, any>,
	exportBoosterPacks: Record<string, any>,
	exportBoosters: Record<string, any>,
): IResolvedCalendarDay[] {
	const {itemIconMap, itemNameMap} = buildItemMaps(exportResources, exportBundles, exportBoosterPacks, exportBoosters);
	const daysWithEvents = (season.Days as any[]).filter((d: any) => d.events.length > 0);
	const result: IResolvedCalendarDay[] = [];

	for (const dayEntry of daysWithEvents) {
		const dateString = formatSeasonDay(dayEntry.day);
		const resolvedEvents: IResolvedCalendarEvent[] = [];

		for (const event of dayEntry.events as any[]) {
			const emoji = EVENT_EMOJI[event.type] ?? event.type;
			let text = '';

			let iconPath: string | undefined;

			switch (event.type) {
				case 'CET_CHALLENGE': {
					const challengeData = exportChallenges[event.challenge];
					if (challengeData) {
						iconPath = challengeData.icon || undefined;
						const desc = challengeData.description ? dict[challengeData.description] : null;
						const count = challengeData.requiredCount;
						if (desc && count) {
							text = desc.replace('|COUNT|', String(count));
						} else if (count) {
							text = `${camelToWords(lastSegment(event.challenge))} \u00D7${String(count)}`;
						} else {
							text = camelToWords(lastSegment(event.challenge));
						}
					} else {
						text = camelToWords(lastSegment(event.challenge));
					}

					break;
				}

				case 'CET_REWARD': {
					const normalized = event.reward.replace('/Lotus/StoreItems/', '/Lotus/');
					iconPath = itemIconMap[normalized];
					const nameKey = itemNameMap[normalized];
					const rawName = (nameKey && dict[nameKey]) ?? camelToWords(lastSegment(event.reward));
					text = rawName.replaceAll(/<[^>]+>\s*/gu, '').trim();

					break;
				}

				case 'CET_UPGRADE': {
					text = camelToWords(lastSegment(event.upgrade));

					break;
				}
			// No default
			}

			if (text) {
				resolvedEvents.push({
					type: event.type, emoji, dateStr: dateString, text, iconPath,
				});
			}
		}

		if (resolvedEvents.length > 0) {
			result.push({day: dayEntry.day, events: resolvedEvents});
		}
	}

	return result;
}

// Expose globals for browser classic scripts; guard allows this file to run in Node.js too
if (globalThis.window !== undefined) {
	(globalThis as any).getSeasonLabel = getSeasonLabel;
	(globalThis as any).resolveCalendarSeasonDays = resolveCalendarSeasonDays;
	(globalThis as any).buildItemMaps = buildItemMaps;
	(globalThis as any).formatSeasonDay = formatSeasonDay;
	(globalThis as any).camelToWords = camelToWords;
	(globalThis as any).SEASON_LABELS = SEASON_LABELS;
}
