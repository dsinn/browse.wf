/**
 * Global type declarations for libraries that extend the window object
 */

type IMongoDate = {
	$date: {
		$numberLong: string;
	};
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
	Challenges: Array<{
		Index: number;
		Type: string;
		Challenge: string;
		Level: string;
		Specs: string[];
		Auras: string[];
	}>;
	Hard?: boolean;
	RandSeed?: number;
};

// Mirrors the worldState type declared in live.ts — kept in sync to avoid TS2717 redeclaration conflicts
type IWorldState = {
	ActiveMissions?: any[];
	Conquests?: any[];
	Descents?: IDescent[];
	EndlessXpSchedule?: any[];
	Events?: any[];
	Goals?: any[];
	Alerts?: any[];
	Invasions?: IWorldStateInvasion[];
	KnownCalendarSeasons?: any[];
	VoidStorms?: any[];
	Sorties?: any[];
	LiteSorties?: any[];
	DailyDeals?: any[];
	SyndicateMissions?: any[];
	Tmp?: string;
};

type IRegion = {
	[key: string]: any;
	name: string;
	systemIndex: number;
	systemName: string;
	nodeType: number;
	masteryReq: number;
	missionType: string;
};

// Upstream functions from common.js / live.ts used by fork modules
declare function getDictPromise(): Promise<Record<string, string>>;
declare function createExpiryBadge(expiry: number): HTMLSpanElement;
declare function createCompletionToggle(oid: string): HTMLAnchorElement;
declare function setImageSource(img: HTMLImageElement, icon: string): void;
declare function toTitleCase(string_: string): string;

/* eslint-disable capitalized-comments */
// `interface` augments Window in script .d.ts files when written at the top level (not inside
// `declare global`). The `declare global` wrapper is only needed in module-style .d.ts files;
// since this file has no import/export it is already in script/global scope.
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

	// PHP-injected globals (double-underscore prefix by convention)

	__profileParams?: URLSearchParams;

	__showAutoFetchFlow?: boolean;

	// ── Upstream globals (live.ts / common.js / profile.ts) ─────────────────────
	// Optional since they are not present on all pages
	// Note: arbys, bountyCycle, incursions_expiry, incursions_today, worldState, redtext,
	// dict, and osdict are declared in live.ts/index.ts with specific types and cannot be
	// redeclared here without TS2717 conflicts in the main build (tsconfig.json compiles
	// both live.ts and globals.d.ts together). Fork modules use (window as any).X for those.

	activateTab?: (tab: string) => void;
	addTooltip?: (element: HTMLElement, title: string) => void;
	baseSuitTypes?: string[];
	checkLoadButtonState?: () => void;
	createCompletionToggle?: (oid: string) => HTMLAnchorElement;
	createExpiryBadge?: (expiry: number) => HTMLSpanElement;
	// Upstream names — cannot be renamed

	dicts_promise?: Promise<void>;
	ExportChallenges?: Record<string, any>;
	ExportEnemies?: Record<string, any>;
	ExportFactions?: Record<string, any>;
	ExportImages?: Record<string, any>;
	ExportRegions?: Record<string, any>;
	// Upstream names — cannot be renamed

	ExportMissionTypes_promise?: Promise<void>;

	ExportRegions_promise?: Promise<void>;
	formatActivation?: (timestamp: number) => string;
	getDictPromise?: () => Promise<Record<string, string>>;
	getItemNamePromise?: (itemType: string) => Promise<string>;
	getOSDictPromise?: () => Promise<Record<string, string>>;
	invigorationNames?: Record<string, string>;
	isOidMarkedAsCompleted?: (oid: string) => boolean;
	logger?: {debug: (...args: any[]) => void; log: (...args: any[]) => void; info: (...args: any[]) => void; warn: (...args: any[]) => void; error: (...args: any[]) => void};
	profile?: any;
	refreshCollapseStatus?: (elm: HTMLElement) => void;
	refreshNotifStatus?: (elm: HTMLElement) => void;
	renderProfile?: () => void;
	saveSettings?: () => void;
	sendNotification?: (message: string) => void;
	setDatum?: (name: string, value: string, expiry?: number) => void;
	setImageSource?: (img: HTMLImageElement, icon: string) => void;
	toggleOidCompletion?: (oid: string) => void;
	toTitleCase?: (string_: string) => string;
	updateBountyCycleLocalised?: () => void;
	updateCircuitLocalised?: () => void;
	updateFissures?: (force?: boolean) => Promise<void>;
	updateIncursionsLocalised?: () => Promise<void>;
	updateLog?: () => void;

	// ── Fork-exposed globals (src/ modules) ─────────────────────────────────────

	// src/arbys/settings.ts
	initializeSettingsButtons?: () => void;

	// src/arbys/tilesets.ts
	appendTilesetText?: (span: HTMLElement, node: any) => void;
	isTilesetChecked?: (node: any) => boolean;
	updateTilesetNextOccurrence?: (node: any, timestamp: number, dateText: string, detailText: string) => void;

	// src/archimedea/data.ts
	resolveArchimedea?: (...args: any[]) => Promise<any>;

	// src/archimedea/helpers.ts
	renderArchimedeaTable?: (container: HTMLElement, archimedea: any, archimedeaType: string, variantKeyPrefix: string) => Promise<void>;
	renderArchimedeaMissions?: (missions: Array<{
		type: string; variant: string; variantDesc: string | undefined;
		conditions: Array<{name: string; desc: string | undefined}>;
	}>) => HTMLTableSectionElement;
	renderArchimedeaFrameVariables?: (frameVariables: Array<{name: string; desc: string | undefined}>) => HTMLTableRowElement;

	// src/archwing-icon.ts
	makeArchwingIcon?: (className?: string) => HTMLImageElement;

	// src/calendar-seasons/data.ts
	SEASON_LABELS?: Record<string, string>;
	camelToWords?: (s: string) => string;
	formatSeasonDay?: (day: number) => string;
	getSeasonLabel?: (season: string) => string;
	resolveCalendarSeasonDays?: (season: any, dict: Record<string, string>) => Promise<any[]>;

	// src/calendar-seasons/index.ts
	renderCalendarSeasonPane?: (season: any) => Promise<HTMLDivElement>;
	updateCalendarSeason?: () => Promise<void>;

	// src/card-filters.ts
	getFilterValue?: (cardName: string, filterType: string, defaultValue: string) => string;
	initializeCardFilters?: (cardName: string, onFilterChange: () => void) => void;
	initializeFilterToggles?: () => void;
	isFilterEnabled?: (cardName: string, filterType: string) => boolean;
	refreshFilterStatus?: (elm: HTMLElement) => void;

	// src/cloud-sync/trigger.ts
	triggerCloudSync?: () => void;
	triggerCloudSyncWithDebounce?: () => void;
	// eslint-disable-next-line @typescript-eslint/naming-convention
	__getSupabaseAccessToken?: () => Promise<string | undefined>;

	// src/descendia/data.ts
	ARENA_EMOJI?: Record<string, string>;
	resolveDescentChallenges?: (...args: any[]) => any;

	// src/descendia/index.ts
	renderDescentChallenges?: (descent: IDescent, dict: Record<string, string>) => HTMLTableSectionElement;
	updateDescendia?: () => void;

	// src/helpers/string-helpers.ts
	escapeHtml?: (string_: string) => string;
	pluralize?: (count: number, singular: string, plural?: string) => string;

	// src/helpers/tileset-helpers.ts
	formatTileset?: (tileset: any) => string;
	getTileset?: (node: any) => string | undefined;

	// src/invigorations.ts
	getWeekIndex?: (timestamp: number) => number;
	initInvigorations?: (names: Record<string, string>) => void;
	initInvigorationsFromCache?: (inventoryDataUsed: boolean) => void;
	loadCache?: () => Record<number, any>;
	populateInvigorationGrid?: (prefix: string, response: any, suits?: string[]) => void;
	preFillForm?: (username: string, peek: boolean, suits: string[]) => void;
	saveToCache?: (request: any, response: any) => void;
	showHistory?: (currentWeek: number, cache: Record<number, any>) => void;
	showResults?: (response: any, request: any) => void;

	// src/live/bounties.ts
	applyBountyFilters?: (syndicateTag: string, rows: NodeListOf<Element>) => void;
	renderAllyIcon?: (allyName: string, allyCell: Element) => void;

	// src/live/bounty-checkboxes.ts
	updateBountyCheckboxes?: () => void;

	// src/live/bounty-filters.ts
	isBountyMissionTypeEnabled?: (syndicateTag: string, missionType: string) => boolean;
	getMinimumTier?: (syndicateTag: string) => number;
	initializeBountyFilters?: () => void;
	initializeBountyFiltersAll?: () => void;

	// src/live/checkbox-linking.ts
	applyCheckboxLinking?: (element: HTMLElement, nowChecked: boolean) => void;

	// src/live/circuit.ts
	updateCircuitChoices?: () => void;

	// src/live/completion-toggles.ts
	refreshAllCompletionToggles?: () => void;
	setCompletionToggle?: (elm: HTMLAnchorElement, completed: boolean) => void;

	// src/live/fissures.ts
	fissureTiers?: any;

	// src/live/invasions.ts
	calculatePercentage?: (invasion: IWorldStateInvasion) => number;
	createInvasionProgressBar?: (invasion: IWorldStateInvasion, percentage: number) => HTMLDivElement;
	isInvasionRewardShown?: (itemType: string) => boolean;
	updateInvasions?: () => Promise<void>;

	// src/live/news.ts
	updateNewsTicker?: (force?: boolean) => void;

	// src/live/news-mark-read.ts
	initializeMarkAsRead?: () => void;
	isNewsItemRead?: (item: any) => boolean;
	markAllNewsAsRead?: () => void;
	markNewsItemAsRead?: (item: any, element: HTMLElement) => void;
	pruneStaleNewsRead?: () => void;
	setNewsItemData?: (item: any, element: HTMLElement) => void;

	// src/live/red-text.ts
	updateRedText?: () => void;

	// src/live/sortie.ts
	appendSortieLocation?: (td: HTMLTableCellElement, node: any, tileset: string) => void;

	// src/live/sync.ts
	initLiveSync?: () => void;

	// src/live/weekly.ts
	filterWeeklyMissions?: () => void;
	updateWeekly?: () => void;

	// src/profile/enemy-stats.ts
	augmentEnemyStats?: (...args: any[]) => void;

	// src/profile/equipment-stats.ts
	augmentEquipmentStats?: (profile: any) => Promise<void>;

	// src/profile/stats-filters.ts
	ENEMY_FACTIONS?: Array<{tooltip: string; icon?: string; factions: string[]}>;
	EQUIPMENT_CATEGORIES?: Record<string, {tooltip: string; icon: string; displayText?: string}>;
	getEnemyFactionLabel?: (faction: string) => string | undefined;
	getEquipmentCategoryLabel?: (productCategory: string) => string | undefined;
	initStatsFilterBar?: (...args: any[]) => void;

	// src/profile/stats-tooltips.ts
	addCipherAvgTooltip?: (elm: HTMLElement, profile: any) => void;
	addStatPercentage?: (stat: string, value: number) => void;
	addTimeStatTooltip?: (elm: HTMLElement, stat: string, value: number) => void;

	// src/profile/syndicate-addons.ts
	appendSyndicateProgressBar?: (...args: any[]) => void;

	// src/profile/workflow.ts
	cloudSyncEvent?: Promise<string>;
	copyWarframePath?: (event: Event) => void;
	fetchProfile?: () => void;
	initialProfilePromise?: Promise<void>;
	loadEELog?: (file?: File) => Promise<void>;
	loadProfile?: (file?: File) => Promise<void>;
	onAccountIdManualInput?: () => void;
	onDownloadLinkLeftClick?: (event: Event) => void;
	onDownloadLinkRightClick?: (event: Event) => void;
	onPlatformChange?: () => void;
	profileWorkflowReady?: (syncResult: string, showAutoFetchFlow: boolean) => void;
	updateProfileAge?: () => void;

	// src/public-export-fetcher.ts
	fetchExport?: (name: string) => Promise<any>;

	// src/short-timer-badge.ts
	createShortTimerBadge?: (timestamp: number, expiredLabel: string, extraClasses?: string) => HTMLSpanElement;
	initializeShortTimerBadges?: () => void;

	// src/warframe-api-proxy-client.ts
	WarframeApiFrontProxyClient?: {
		fetchWorldState(): Promise<any>;
		fetchProfile(platform: string, playerId: string): Promise<{status: number; data: any; nextFetchAvailableAt: number | undefined}>;
	};

	// E2e test helpers injected into the browser context
	getErrors?: () => string[];
}

declare global {
	// Environment config injected by PHP into the page
	// Double-underscore prefix is an intentional convention to signal PHP-injected globals
	// eslint-disable-next-line @typescript-eslint/naming-convention
	var __ENV__: Window['__ENV__'];
}
/* eslint-enable capitalized-comments */
