/**
 What this repo expects from worldState.

 The test fails (errors) in two situations:
 1. worldState breaks an assumption the app makes, or that we make from how the game works:
 a field the app reads is missing or has the wrong type, a value isn't in a set the app
 looks up (e.g. a new fissure tier), a fixed count changes (e.g. sorties stop having
 3 missions), or nothing is active right now for a card that needs it.
 2. worldState has information we don't know about yet: a new top-level key, or a new field
 inside anything the app reads. Fields we know about but don't read are listed under
 `unusedFields` (or as `unused()` at the top level) so they don't trigger this.

 Warnings are informational and never fail the test.

 Known values, counts and fields come from the warframe-worldstate-history repo
 (897 snapshots, 2024-06-10 → 2026-11-13).

 Run against the live API with `npm run test:api-validation`.
 */
/* eslint-disable unicorn/max-nested-calls -- The schema is nested by design */
import {
	anything,
	array,
	boolean,
	someEntryActive,
	integer,
	isActiveAtWorldStateTime,
	mongoDate,
	object,
	oid,
	optional,
	shapes,
	string,
	unused,
	type Rule,
} from './rules';

const countedItem = object({ItemType: string(), ItemCount: integer()});

const invasionReward = shapes([
	// Infested attackers give nothing, serialized as an empty array
	array(anything(), {count: {max: 0}}),
	object({countedItems: optional(array(countedItem))}),
]);

const staleMinutes = 30;

export const worldStateSchema: Rule = object({
	WorldSeed: unused(),
	Version: unused(),
	MobileVersion: unused(),
	BuildLabel: unused(),
	// Not read by the site; the checks below use it as the snapshot's clock
	Time: integer({
		severity: 'warning',
		invariants: [{
			expected: `a value within ${staleMinutes} minutes of now (is the proxy serving stale data?)`,
			holds: (time: number, {now}) => Math.abs((now / 1000) - time) < staleMinutes * 60,
			severity: 'warning',
		}],
	}),

	Events: array(object({
		Messages: optional(array(object({LanguageCode: string(), Message: string()}))),
		Msg: optional(string()),
		Date: optional(mongoDate()),
		Prop: optional(string()),
		Community: optional(boolean()),
	}, {
		unusedFields: [
			'_id',
			'EventEndDate',
			'EventLiveUrl',
			'EventStartDate',
			'GameOnly',
			'HideEndDateModifier',
			'Icon',
			'ImageUrl',
			'Links',
			'MobileOnly',
			'Priority',
		],
	}), {usedBy: 'src/live/news.ts (news ticker)'}),

	Goals: array(object({
		Desc: string(),
		ClanGoal: optional(array(integer(), {count: {min: 5, max: 5}, usedBy: 'src/live/goals.ts (one score per clan tier)'})),
	}, {
		unusedFields: [
			'_id',
			'Activation',
			'ArchwingDrops',
			'Best',
			'BonusGoal',
			'BonusReward',
			'Bounty',
			'ClampNodeScores',
			'Community',
			'ConcurrentMissionKeyNames',
			'ConcurrentNodeReqs',
			'ConcurrentNodes',
			'ContinuousHubEvent',
			'Count',
			'Expiry',
			'Faction',
			'Fomorian',
			'Goal',
			'GracePeriod',
			'HealthPct',
			'Icon',
			'InstructionalItem',
			'InterimGoals',
			'InterimRewards',
			'ItemType',
			'JobAffiliationTag',
			'JobCurrentVersion',
			'JobPreviousVersion',
			'Jobs',
			'MissionInfo',
			'MissionKeyName',
			'NightLevel',
			'Node',
			'OptionalInMission',
			'Personal',
			'PrereqGoalTags',
			'PreviousJobs',
			'RegionDrops',
			'RegionIdx',
			'Regions',
			'Reward',
			'ScoreLocTag',
			'ScoreMaxTag',
			'ScoreTagBlocksGuildTierChanges',
			'ScoreVar',
			'Success',
			'Tag',
			'ToolTip',
			'Transmission',
			'UpgradeIds',
			'VictimNode',
		],
	}), {usedBy: 'live.ts updateGoals()'}),

	Alerts: array(object({
		_id: oid(),
		Activation: mongoDate(),
		Expiry: mongoDate(),
		MissionInfo: object({
			missionType: string(),
			faction: string(),
			location: string(),
			minEnemyLevel: integer(),
			maxEnemyLevel: integer(),
			missionReward: object({
				credits: integer(),
				items: optional(array(string())),
				countedItems: optional(array(countedItem)),
			}),
			questReq: optional(string({usedBy: 'src/live/alerts.ts (quest lock)'})),
			archwingRequired: optional(boolean({usedBy: 'src/live/alerts.ts (Archwing icon)'})),
			isSharkwingMission: optional(boolean({usedBy: 'src/live/alerts.ts (Archwing icon)'})),
			nightmare: optional(boolean({usedBy: 'src/live/alerts.ts (Nightmare icon)'})),
		}, {
			unusedFields: [
				'advancedSpawners',
				'customAdvancedSpawners',
				'descText',
				'difficulty',
				'enemySpec',
				'exclusiveWeapon',
				'extraEnemySpec',
				'forceAllyFaction',
				// Sic: DE's spelling
				'invasionAllyFactio',
				'leadersAlwaysAllowed',
				'levelOverride',
				'maxWaveNum',
				'seed',
				'vipAgent',
			],
		}),
	}, {unusedFields: ['ForceUnlock', 'Icon', 'Tag']}), {usedBy: 'live.ts updateAlerts()'}),

	Sorties: array(object({
		_id: oid(),
		Activation: mongoDate(),
		Expiry: mongoDate(),
		Variants: array(object({
			missionType: string(),
			modifierType: string(),
			node: string(),
			tileset: string(),
		}), {count: {min: 3, max: 3}}),
	}, {unusedFields: ['Boss', 'ExtraDrops', 'Reward', 'Seed', 'Twitter']}), {
		usedBy: 'live.ts updateSorties()',
		invariants: [someEntryActive],
	}),

	LiteSorties: array(object({
		_id: oid(),
		Activation: mongoDate(),
		Expiry: mongoDate(),
		Boss: string({oneOf: ['SORTIE_BOSS_AMAR', 'SORTIE_BOSS_NIRA', 'SORTIE_BOSS_BOREAL']}),
		Missions: array(object({missionType: string(), node: string()}), {count: {min: 3, max: 3}}),
	}, {unusedFields: ['Reward', 'Seed']}), {
		// The current week, plus the next one shortly before the weekly reset
		count: {min: 1, max: 2},
		usedBy: 'live.ts updateArchonHunt()',
		invariants: [someEntryActive],
	}),

	// Typed in live.ts but not read; bounties come from oracle.browse.wf/bounty-cycle instead
	SyndicateMissions: unused(),

	ActiveMissions: array(object({
		Activation: mongoDate(),
		Expiry: mongoDate(),
		Node: string(),
		Modifier: string({oneOf: ['VoidT1', 'VoidT2', 'VoidT3', 'VoidT4', 'VoidT5', 'VoidT6']}),
		Hard: optional(boolean()),
	}, {unusedFields: ['_id', 'MissionType', 'Region', 'Seed']}), {usedBy: 'src/live/fissures.ts'}),

	GlobalUpgrades: unused(),
	FlashSales: unused(),
	SkuSales: unused(),
	InGameMarket: unused(),

	Invasions: array(object({
		_id: oid(),
		Faction: string({oneOf: ['FC_INFESTATION', 'FC_CORPUS', 'FC_GRINEER']}),
		DefenderFaction: string({oneOf: ['FC_CORPUS', 'FC_GRINEER']}),
		Node: string(),
		Count: integer(),
		Goal: integer(),
		Completed: boolean(),
		Activation: mongoDate(),
		AttackerReward: invasionReward,
		DefenderReward: invasionReward,
	}, {
		unusedFields: ['AttackerMissionInfo', 'ChainID', 'DefenderMissionInfo', 'LocTag'],
	}), {usedBy: 'src/live/invasions.ts'}),

	HubEvents: unused(),
	NodeOverrides: unused(),

	VoidTraders: array(object({
		Activation: mongoDate(),
		Expiry: mongoDate(),
		Node: string(),
		// Only present while Baro is visiting
		Manifest: optional(array(object({
			ItemType: string(),
			PrimePrice: integer(),
			RegularPrice: integer(),
		}, {unusedFields: ['Limit']}))),
	}, {unusedFields: ['_id', 'Character', 'Id']}), {
		// The site reads VoidTraders[0] unconditionally
		count: {min: 1},
		usedBy: 'live.ts updateBaro()',
	}),

	PrimeVaultTraders: array(object({
		Manifest: array(object({ItemType: string()}, {
			unusedFields: ['EndDate', 'Limit', 'PrimePrice', 'RegularPrice', 'StartDate'],
		}), {count: {min: 1}}),
	}, {
		unusedFields: [
			'_id', 'Activation', 'Completed', 'EvergreenManifest', 'Expiry', 'InitialStartDate', 'Node', 'ScheduleInfo',
		],
	}), {count: {min: 1, max: 1}, usedBy: 'prime-vault.ts (reads PrimeVaultTraders[0])'}),

	VoidStorms: array(object({
		Node: string(),
		Activation: mongoDate(),
		Expiry: mongoDate(),
		ActiveMissionTier: string({oneOf: ['VoidT1', 'VoidT2', 'VoidT3', 'VoidT4']}),
	}, {unusedFields: ['_id']}), {usedBy: 'src/live/fissures.ts (Railjack fissures)'}),

	PrimeAccessAvailability: unused(),

	DailyDeals: array(object({
		StoreItem: string(),
		Activation: mongoDate(),
		Expiry: mongoDate(),
		Discount: integer(),
		OriginalPrice: integer(),
		SalePrice: integer(),
		AmountTotal: integer(),
		AmountSold: integer(),
	}), {
		usedBy: 'live.ts updateDarvosDeal()',
		invariants: [someEntryActive],
	}),

	LibraryInfo: unused(),
	PVPChallengeInstances: unused(),
	PersistentEnemies: unused(),
	PVPAlternativeModes: unused(),
	PVPActiveTournaments: unused(),
	ProjectPct: unused(),
	ConstructionProjects: unused(),
	TwitchPromos: unused(),
	ExperimentRecommended: unused(),

	EndlessXpSchedule: array(object({
		Activation: mongoDate(),
		Expiry: mongoDate(),
		CategoryChoices: array(object({
			Category: string({oneOf: ['EXC_NORMAL', 'EXC_HARD']}),
			Choices: array(string()),
		}), {
			invariants: [{
				expected: 'one EXC_NORMAL (3 Warframes) and one EXC_HARD (5 weapons) category',
				holds: (choices: any[]) =>
					choices.length === 2
					&& choices.find(choice => choice.Category === 'EXC_NORMAL')?.Choices?.length === 3
					&& choices.find(choice => choice.Category === 'EXC_HARD')?.Choices?.length === 5,
			}],
		}),
	}), {
		// The current week, plus the next one shortly before the weekly reset
		count: {min: 1, max: 2},
		usedBy: 'src/live/circuit.ts (The Circuit)',
		invariants: [someEntryActive],
	}),

	ForceLogoutVersion: unused(),
	FeaturedGuilds: unused(),
	SeasonInfo: unused(),

	KnownCalendarSeasons: optional(array(object({
		Activation: mongoDate(),
		Expiry: mongoDate(),
		Season: string({oneOf: ['CST_WINTER', 'CST_SPRING', 'CST_SUMMER', 'CST_FALL']}),
		Days: array(object({
			day: integer(),
			events: array(object({
				type: string({oneOf: ['CET_CHALLENGE', 'CET_REWARD', 'CET_UPGRADE', 'CET_PLOT']}),
				challenge: optional(string()),
				reward: optional(string()),
				upgrade: optional(string()),
			}, {unusedFields: ['dialogueConvo', 'dialogueName']})),
		})),
	}, {unusedFields: ['UpgradeAvaliabilityRequirements', 'Version', 'YearIteration']}), {
		usedBy: 'src/live/calendar-seasons.ts, src/weekly-forecast.ts',
	})),

	Conquests: array(object({
		Activation: mongoDate(),
		Expiry: mongoDate(),
		Type: string({oneOf: ['CT_LAB', 'CT_HEX']}),
		Missions: array(object({
			faction: string(),
			missionType: string(),
			difficulties: array(object({
				type: string({oneOf: ['CD_NORMAL', 'CD_HARD']}),
				deviation: string(),
				risks: array(string(), {count: {min: 1, max: 2}}),
			}), {count: {min: 2, max: 2}}),
		}), {count: {min: 3, max: 3}}),
		Variables: array(string(), {count: {min: 4, max: 4}}),
	}, {unusedFields: ['RandomSeed']}), {
		usedBy: 'src/live/weekly.ts, src/archimedea/, src/weekly-forecast.ts',
		invariants: [
			{
				// The current week, plus the next one shortly before the weekly reset
				expected: 'one or two CT_LAB (Deep Archimedea) and CT_HEX (Temporal Archimedea) entries each',
				holds: (list: any[]) => ['CT_LAB', 'CT_HEX'].every(type => [1, 2].includes(list.filter(entry => entry.Type === type).length)),
			},
			{
				// The Weekly card shows the earliest unexpired entry of each type
				expected: 'a CT_LAB and a CT_HEX entry active at worldState.Time',
				holds: (list: any[], context) => ['CT_LAB', 'CT_HEX']
					.every(type => list.some(entry => entry.Type === type && isActiveAtWorldStateTime(entry, context))),
			},
		],
	}),

	Descents: array(object({
		Activation: mongoDate(),
		Expiry: mongoDate(),
		Challenges: array(object({
			Index: integer(),
			Type: string(),
			Challenge: string(),
			Level: string(),
			Specs: optional(array(string())),
			Auras: optional(array(string())),
		}), {count: {min: 21, max: 21}}),
	}, {unusedFields: ['RandSeed']}), {
		usedBy: 'src/descendia/, src/weekly-forecast.ts',
		invariants: [someEntryActive],
	}),

	Tmp: unused(),

	WeeklyVaultBonusRewards: array(object({
		WeekCount: integer(),
		BonusRegion: string(),
		Rewards: array(object({
			PointThreshold: integer(),
			ItemCount: integer(),
			Reward: string(),
		}, {unusedFields: ['RewardClaimed']}), {count: {min: 4, max: 4}}),
	}), {usedBy: 'src/clan-weekly/, src/weekly-forecast.ts'}),
});
