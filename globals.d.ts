/**
 * Global type declarations for libraries that extend the window object
 */

type IMongoDate = {
	$date: {
		$numberLong: string;
	};
};

type IConquestMission = {
	type: string;
	variant: string;
	conditions: string[];
};

type IWorldStateInvasion = {
	_id: {$oid: string};
	Node: string;
	Count: number;
	Goal: number;
	Faction: string;
	DefenderFaction: string;
	Completed: boolean;
	Activation: IMongoDate;
	AttackerReward: {countedItems: Array<{ItemType: string; ItemCount: number}>} | never[];
	DefenderReward: {countedItems: Array<{ItemType: string; ItemCount: number}>} | never[];
};

type IDescent = {
	Activation: IMongoDate;
	Expiry: IMongoDate;
	Challenges: Array<{challenge: string}>;
	Hard?: boolean;
};

type IWorldState = {
	Invasions?: IWorldStateInvasion[];
	Descents?: IDescent[];
	KnownCalendarSeasons?: any[];
};

type IRegion = {
	name: string;
	systemName: string;
	missionType: string;
};

// Upstream functions from common.js / live.ts used by fork modules
declare function getDictPromise(): Promise<Record<string, string>>;
declare function createExpiryBadge(expiry: number): HTMLSpanElement;
declare function createCompletionToggle(oid: string): HTMLAnchorElement;
declare function setImageSource(img: HTMLImageElement, icon: string): void;
declare function toTitleCase(string_: string): string;

/* eslint-disable capitalized-comments */
declare global {
	// `interface` is required here — `type` aliases cannot augment the global Window
	// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
	interface Window {
		bootstrap?: any;
		showdown?: any;
		onLanguageUpdate?: () => void;
		__ENV__?: {
			VITE_ENV?: string;
			VITE_DATABASE_URL?: string;
			VITE_DATABASE_ANON_KEY?: string;
			WARFRAME_API_FRONT_PROXY_BASE_URL?: string;
			WARFRAME_API_FRONT_PROXY_TOKEN?: string;
		};
	}

	// Allow dict and osdict to be declared with more specific types elsewhere
	var dict: any;
	var osdict: any;

	// Environment config injected by PHP into the page
	// Double-underscore prefix is an intentional convention to signal PHP-injected globals
	// eslint-disable-next-line @typescript-eslint/naming-convention
	var __ENV__: Window['__ENV__'];

	// World state data fetched from Warframe API
	var worldState: IWorldState | undefined;

	// ── Upstream functions (live.ts / common.js) ────────────────────────────────
	// Optional since they are not present on all pages

	var addTooltip: ((element: Element, title: string) => void) | undefined;
	var checkLoadButtonState: (() => void) | undefined;
	var createCompletionToggle: ((oid: string) => HTMLAnchorElement) | undefined;
	var createExpiryBadge: ((expiry: number) => HTMLSpanElement) | undefined;
	// Upstream names — cannot be renamed
	// eslint-disable-next-line @typescript-eslint/naming-convention
	var dicts_promise: Promise<void> | undefined;
	var ExportChallenges: Record<string, any> | undefined;
	var ExportImages: Record<string, any> | undefined;
	var ExportRegions: Record<string, IRegion> | undefined;
	// Upstream names — cannot be renamed
	// eslint-disable-next-line @typescript-eslint/naming-convention
	var ExportRegions_promise: Promise<void> | undefined;
	var getDictPromise: (() => Promise<Record<string, string>>) | undefined;
	var getItemNamePromise: ((itemType: string) => Promise<string>) | undefined;
	var isOidMarkedAsCompleted: ((oid: string) => boolean) | undefined;
	var invigorationNames: Record<string, string> | undefined;
	var baseSuitTypes: string[] | undefined;
	var logger: {debug: (...args: any[]) => void; log: (...args: any[]) => void; info: (...args: any[]) => void; warn: (...args: any[]) => void; error: (...args: any[]) => void} | undefined;
	var refreshAllCompletionToggles: (() => void) | undefined;
	var refreshCollapseStatus: ((elm: HTMLElement) => void) | undefined;
	var refreshNotifStatus: ((elm: HTMLElement) => void) | undefined;
	var setCompletionToggle: ((oid: string, completed: boolean) => void) | undefined;
	var setImageSource: ((img: HTMLImageElement, icon: string) => void) | undefined;
	var toTitleCase: ((string_: string) => string) | undefined;
	var updateBountyCycleLocalised: (() => void) | undefined;
	var updateCircuitLocalised: (() => void) | undefined;
	var updateFissures: ((force?: boolean) => void) | undefined;
	var updateIncursionsLocalised: (() => void) | undefined;
	var updateNewsTicker: ((force?: boolean) => void) | undefined;
	var updateWeekly: (() => void) | undefined;

	// ── Fork-exposed globals (src/ modules) ─────────────────────────────────────

	// src/cloud-sync/trigger.ts
	var triggerCloudSync: (() => void) | undefined;
	var triggerCloudSyncWithDebounce: (() => void) | undefined;
	var __getSupabaseAccessToken: (() => Promise<string | undefined>) | undefined;

	// src/short-timer-badge.ts
	var createShortTimerBadge: ((timestamp: number, expiredLabel: string) => HTMLSpanElement) | undefined;
	var initializeShortTimerBadges: (() => void) | undefined;

	// src/bounty-checkboxes.ts
	var updateBountyCheckboxes: (() => void) | undefined;

	// src/bounty-filters.ts
	var getMinimumTier: ((syndicateTag: string) => number) | undefined;
	var initializeBountyFiltersAll: (() => void) | undefined;

	// src/calendar-seasons.ts
	var renderCalendarSeasonPane: (() => Promise<void>) | undefined;
	var updateCalendarSeason: (() => void) | undefined;

	// src/calendar-seasons-data.ts
	var SEASON_LABELS: Record<string, string> | undefined;
	var camelToWords: ((s: string) => string) | undefined;
	var formatSeasonDay: ((day: number) => string) | undefined;
	var getSeasonLabel: ((season: string) => string) | undefined;
	var resolveCalendarSeasonDays: ((...args: any[]) => any[]) | undefined;

	// src/card-filters.ts
	var getFilterValue: ((cardName: string, filterType: string, defaultValue: string) => string) | undefined;
	var initializeCardFilters: ((cardName: string, onFilterChange: () => void) => void) | undefined;
	var initializeFilterToggles: (() => void) | undefined;
	var isFilterEnabled: ((cardName: string, filterType: string) => boolean) | undefined;
	var redtext: string[] | undefined;
	var refreshFilterStatus: ((elm: HTMLElement) => void) | undefined;

	// src/checkbox-linking.ts
	var applyCheckboxLinking: ((element: HTMLElement, nowChecked: boolean) => void) | undefined;

	// src/conquest-helpers.ts
	var conquestRiskTagToLoc: ((tag: string) => string) | undefined;
	var conquestVariableTagToLoc: ((tag: string) => string) | undefined;
	var createArchimedeaTooltipElement: ((
		keyPrefix: string, rawValue: string, osdict: Record<string, string>,
		descTransform?: (desc: string, rawValue: string) => string,
	) => HTMLElement | Text) | undefined;
	var renderConquestFrameVariables: ((frameVariables: string[], osdict: Record<string, string>) => HTMLTableRowElement) | undefined;
	var renderConquestMissions: ((missions: IConquestMission[], variantKeyPrefix: string, osdict: Record<string, string>, dict: Record<string, string>) => HTMLTableSectionElement) | undefined;
	var transformConquestMissions: ((conquest: any, conquestType: string, ExportMissionTypes: Record<string, {name: string}>) => IConquestMission[]) | undefined;
	var transformFrameVariable: ((desc: string, rawValue: string) => string) | undefined;

	// src/descendia.ts
	var renderDescentChallenges: ((descent: IDescent, dict: Record<string, string>) => HTMLTableSectionElement) | undefined;
	var updateDescendia: (() => void) | undefined;

	// src/descendia-data.ts
	var ARENA_EMOJI: Record<string, string> | undefined;
	var resolveDescentChallenges: ((...args: any[]) => any) | undefined;

	// src/invasions.ts
	var calculatePercentage: ((invasion: IWorldStateInvasion) => number) | undefined;
	var createInvasionProgressBar: ((invasion: IWorldStateInvasion, percentage: number) => HTMLDivElement) | undefined;
	var isInvasionRewardShown: ((itemType: string) => boolean) | undefined;
	var updateInvasions: (() => Promise<void>) | undefined;

	// src/invigorations.ts
	var getWeekIndex: ((timestamp: number) => number) | undefined;
	var loadCache: (() => Record<number, any>) | undefined;
	var populateInvigorationGrid: ((prefix: string, response: any, suits?: string[]) => void) | undefined;
	var preFillForm: ((username: string, peek: boolean, suits: string[]) => void) | undefined;
	var saveToCache: ((request: any, response: any) => void) | undefined;
	var showHistory: ((currentWeek: number, cache: Record<number, any>) => void) | undefined;
	var showResults: ((response: any, request: any) => void) | undefined;

	// src/news-mark-read.ts
	var generateNewsItemKey: ((item: {id: string; link: string}) => string) | undefined;
	var initializeMarkAsRead: (() => void) | undefined;
	var isNewsItemRead: ((key: string) => boolean) | undefined;
	var markAllNewsAsRead: (() => void) | undefined;
	var markNewsItemAsRead: ((key: string, element: HTMLElement) => void) | undefined;
	var pruneStaleNewsRead: (() => void) | undefined;

	// src/profile-stats-filters.ts
	var ENEMY_FACTIONS: Array<{tooltip: string; icon: string; factions: string[]}> | undefined;
	var EQUIPMENT_CATEGORIES: Record<string, {tooltip: string; icon: string; displayText?: string}> | undefined;
	var getEnemyFactionLabel: ((faction: string) => string | undefined) | undefined;
	var getEquipmentCategoryLabel: ((productCategory: string) => string | undefined) | undefined;
	var initStatsFilterBar: ((...args: any[]) => void) | undefined;

	// src/string-helpers.ts
	var pluralize: ((count: number, singular: string, plural?: string) => string) | undefined;

	// src/tileset-helpers.ts
	var formatTileset: ((tileset: string | undefined) => string) | undefined;
	var getTileset: ((node: IRegion) => string | undefined) | undefined;

	// src/warframe-api-proxy-client.ts
	var WarframeApiFrontProxyClient: {
		fetchWorldState(): Promise<any>;
		fetchProfile(platform: string, playerId: string): Promise<{status: number; data: any; nextFetchAvailableAt: number | undefined}>;
	} | undefined;

	// E2e test helpers injected into the browser context
	var getErrors: (() => string[]) | undefined;
}
/* eslint-enable capitalized-comments */
