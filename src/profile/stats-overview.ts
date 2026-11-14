/**
 Fills the extra sections of the profile Stats > Overview panel: combat and collection totals, a table each for the
 Eidolons and the old trials (called raids in the game's data), and event scores. Also adds the daily focus allowance under the upstream stat lines.

 Called via (window as any).renderStatsOverview() from the profile extras hook in profile.ts.
 */

import {addTooltip} from '../tooltip.js';
import {lastPathSegment} from '../helpers/path-helpers.js';
import {describeDailyReset, isProfileFromToday} from './profile-freshness.js';
import {createTable} from './small-table.js';

const RAID_KEY_PREFIX = '/Lotus/Types/Keys/RaidKeys/';
const RAIDS = [
	{tag: 'Raid01Stage03KeyItem', name: 'Law of Retribution'},
	{tag: 'Raid01Stage03NightmareKeyItem', name: 'Law of Retribution (Nightmare)'},
	{tag: 'RaidGolemStage03KeyItem', name: 'Jordas Verdict'},
];

const EVENT_SCORE_KEYS = [
	'FomorianEventScore',
	'ProjectSinisterEventScore',
	'KelaEventBonusScoreMax',
	'ColonistRescueEventScoreMax',
	'AmbulasEventScoreMax',
	'AmalgamEventScoreMax',
	'Halloween16',
	'Halloween19ScoreMax',
	'HiveEventScore',
	'HiveEventScoreSum',
	'FlotillaEventScore',
	'FlotillaGroundBadgesTier1',
	'FlotillaGroundBadgesTier2',
	'FlotillaGroundBadgesTier3',
	'FlotillaSpaceBadgesTier1',
	'FlotillaSpaceBadgesTier2',
	'FlotillaSpaceBadgesTier3',
	'MechSurvivalScoreMax',
	'OlliesCrashCourseScore',
	'CaliberChicksScore',
	'ZephyrScore',
	'SentinelGameScore',
	'DojoObstacleScore',
];

// The Eidolons that can be captured, in the order they are listed. The Gantulyst and Hydrolyst share the Teralyst's
// internal name prefix. The Vomvalyst can't be captured, and its kills are in the Enemies tab.
const EIDOLON_TYPES = [
	'/Lotus/Types/Enemies/Sentients/Eidolon/SentientTeralystAvatar',
	'/Lotus/Types/Enemies/Sentients/Eidolon/SentientTeralystBigAvatar',
	'/Lotus/Types/Enemies/Sentients/Eidolon/SentientTeralystRainAvatar',
];

// The events and minigames the stats are for, as the game names them (the stat keys use internal names, such as
// "ProjectSinister" for the Shadow Debt event). A key ending in Sum gets "(Total)" added.
const EVENT_NAMES: Record<string, string> = {
	FomorianEventScore: 'Eyes of Blight',
	ProjectSinisterEventScore: 'Shadow Debt',
	KelaEventBonusScoreMax: 'Rathuum',
	ColonistRescueEventScoreMax: 'The Pacifism Defect',
	AmbulasEventScoreMax: 'Ambulas Reborn',
	AmalgamEventScoreMax: 'Hostile Mergers',
	Halloween16: 'Hallowed Nightmares',
	Halloween19ScoreMax: 'Hallowed Flame',
	HiveEventScore: 'Breeding Grounds',
	HiveEventScoreSum: 'Breeding Grounds',
	FlotillaEventScore: 'Scarlet Spear',
	FlotillaGroundBadgesTier1: 'Scarlet Spear Ground Badges Tier 1',
	FlotillaGroundBadgesTier2: 'Scarlet Spear Ground Badges Tier 2',
	FlotillaGroundBadgesTier3: 'Scarlet Spear Ground Badges Tier 3',
	FlotillaSpaceBadgesTier1: 'Scarlet Spear Space Badges Tier 1',
	FlotillaSpaceBadgesTier2: 'Scarlet Spear Space Badges Tier 2',
	FlotillaSpaceBadgesTier3: 'Scarlet Spear Space Badges Tier 3',
	MechSurvivalScoreMax: 'Orphix Venom',
	OlliesCrashCourseScore: 'Ollie\'s Crash Course',
	CaliberChicksScore: 'Caliber Chicks 2',
	ZephyrScore: 'Happy Zephyr',
	SentinelGameScore: 'Wyrmius',
	DojoObstacleScore: 'Dojo Obstacle Course',
};

const BASE_DAILY_FOCUS = 250_000;
const DAILY_FOCUS_PER_RANK = 5000;

/**
 Labels an event score: the event's name if it's known, otherwise the stat key split into words. Either way, a
 score that is a total (a key ending in Sum) has " (Total)" added.
 */
export function describeEventStat(key: string): string {
	const name = EVENT_NAMES[key];
	if (name === undefined) {
		return humanizeStatKey(key);
	}

	return key.endsWith('Sum') ? `${name} (Total)` : name;
}

/**
 Turns a stat key like "KelaEventBonusScoreMax" into "Kela Event Bonus". The word "Score" is dropped, since
 these are listed under a heading that already says they are scores.
 */
export function humanizeStatKey(key: string): string {
	let label = key
		.replaceAll(/(?<=[\da-z])(?=[A-Z])/gu, ' ')
		.replaceAll(/(?<=[A-Za-z])(?=\d)/gu, ' ');

	let suffix = '';
	if (label.endsWith(' Max')) {
		label = label.slice(0, -' Max'.length);
	} else if (label.endsWith(' Sum')) {
		label = label.slice(0, -' Sum'.length);
		suffix = ' (Total)';
	}

	return label.replace(/ Score$/u, '') + suffix;
}

/**
 Overall hit rate across every weapon that recorded both shots fired and hits (a weapon with shots but no hits
 key usually just doesn't track hits). Returns undefined if there are none.
 */
export function calculateAccuracy(weapons: any[] | undefined): {hits: number; fired: number} | undefined {
	let hits = 0;
	let fired = 0;
	for (const weapon of weapons ?? []) {
		const weaponFired = Number(weapon.fired) || 0;
		if (!(weaponFired > 0) || typeof weapon.hits !== 'number') {
			continue;
		}

		fired += weaponFired;
		hits += Number(weapon.hits);
	}

	return fired > 0 ? {hits, fired} : undefined;
}

function createLine(label: string, value: string, tooltip?: string): HTMLSpanElement {
	const line = document.createElement('span');
	line.className = 'd-block';
	line.append(`${label}: `);

	const valueSpan = document.createElement('span');
	valueSpan.textContent = value;
	if (tooltip) {
		valueSpan.classList.add('has-tooltip');
		addTooltip(valueSpan, tooltip);
	}

	line.append(valueSpan);
	return line;
}

function createSection(title: string, content: HTMLElement[]): HTMLDivElement | undefined {
	if (content.length === 0) {
		return undefined;
	}

	const column = document.createElement('div');
	column.className = 'col-md-4 mb-3';
	const heading = document.createElement('h6');
	heading.className = 'text-body-secondary';
	heading.textContent = title;
	column.append(heading, ...content);
	return column;
}

const TRIALS_WIKI_URL = 'https://wiki.warframe.com/w/Trial';

/**
 A link that opens in a new tab, with an external link icon (see src/external-link.css, which profile.php includes).
 */
function createWikiLink(text: string, url: string): HTMLAnchorElement {
	const link = document.createElement('a');
	link.href = url;
	link.target = '_blank';
	link.rel = 'noopener';

	const icon = document.createElement('span');
	icon.className = 'external-link-icon';
	icon.setAttribute('aria-hidden', 'true');
	link.append(text, icon);
	return link;
}

function formatUtcDate(timestamp: number): string {
	return new Date(timestamp).toLocaleDateString(undefined, {
		year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
	});
}

function describeEnemy(type: string): string {
	const {dict, ExportEnemies} = (globalThis as any);
	const name = dict?.[ExportEnemies?.avatars?.[type]?.name];
	return name ?? lastPathSegment(type);
}

function formatCount(value: unknown): string | undefined {
	return typeof value === 'number' ? value.toLocaleString() : undefined;
}

/**
 A row for each Eidolon that appears in the enemy stats: its name (without the "Eidolon" prefix, which the table
 heading already says), captures (if the game records any) and kills.
 */
function buildEidolonTable(enemies: any[] | undefined): HTMLElement[] {
	const rows: Array<Array<string | undefined>> = [];
	for (const type of EIDOLON_TYPES) {
		const enemy = (enemies ?? []).find(entry => entry.type === type);
		if (typeof enemy?.captures === 'number' || typeof enemy?.kills === 'number') {
			rows.push([
				describeEnemy(type).replace(/^Eidolon /u, ''),
				formatCount(enemy.captures),
				formatCount(enemy.kills),
			]);
		}
	}

	return rows.length > 0 ? [createTable(['Eidolon', 'Captured', 'Killed'], rows)] : [];
}

function sumEnemyStat(enemies: any[] | undefined, key: string): number | undefined {
	const values = (enemies ?? []).map(enemy => enemy[key]).filter(value => typeof value === 'number');
	return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : undefined;
}

function buildCombatLines(stats: any): HTMLElement[] {
	const accuracy = calculateAccuracy(stats.Weapons);
	const totals = [
		['DestroyCount', 'Objects Destroyed'],
		['PickupCount', 'Items Picked Up'],
		['FishCount', 'Fish Caught'],
	] as const;

	return [
		...([['kills', 'Total Kills'], ['assists', 'Kill Assists'], ['headshots', 'Headshot Kills']] as const).map(([key, label]) => {
			const total = sumEnemyStat(stats.Enemies, key);
			return total === undefined ? undefined : createLine(label, total.toLocaleString());
		}),
		typeof stats.MeleeKills === 'number' ? createLine('Melee Kills', stats.MeleeKills.toLocaleString()) : undefined,
		accuracy
			? createLine(
				'Overall Accuracy',
				`${(accuracy.hits / accuracy.fired * 100).toFixed(1)}%`,
				`${accuracy.hits.toLocaleString()} hits / ${accuracy.fired.toLocaleString()} fired`,
			)
			: undefined,
		...totals.map(([key, label]) => (typeof stats[key] === 'number' ? createLine(label, stats[key].toLocaleString()) : undefined)),
	].filter((line): line is HTMLElement => line !== undefined);
}

/**
 Puts the focus allowance left today on its own line under the upstream "Average Cipher Time" line, or removes it
 when the profile isn't from today.
 */
function renderDailyFocus(result: any): void {
	document.querySelector('#stat-DailyFocus')?.remove();
	if (!isProfileFromToday() || typeof result.DailyFocus !== 'number') {
		return;
	}

	const anchor = document.querySelector('#stat-CipherTimeAvg')?.closest('.d-block');
	if (!anchor) {
		return;
	}

	const cap = BASE_DAILY_FOCUS + ((result.PlayerLevel ?? 0) * DAILY_FOCUS_PER_RANK);
	const line = createLine(
		'Focus Left Today',
		`${result.DailyFocus.toLocaleString()} / ${cap.toLocaleString()}`,
		`As of when the profile was fetched. ${describeDailyReset()}`,
	);
	line.id = 'stat-DailyFocus';
	anchor.after(line);
}

// Called "raids" in the game's data, but trials everywhere a player can see them
function buildRaidTable(result: any): HTMLElement[] {
	const rows: Array<Array<string | undefined>> = [];
	for (const raid of RAIDS) {
		const mission = (result.Missions ?? []).find((entry: any) => entry.Tag === RAID_KEY_PREFIX + raid.tag);
		if (!mission || !(mission.Completes > 0)) {
			continue;
		}

		const cooldown = Number(mission.RewardsCooldownTime?.$date?.$numberLong);
		rows.push([
			raid.name,
			mission.Completes.toLocaleString(),
			Number.isFinite(cooldown) ? formatUtcDate(cooldown) : undefined,
		]);
	}

	if (rows.length === 0) {
		return [];
	}

	const footnote = document.createElement('small');
	footnote.className = 'd-block text-body-secondary';
	footnote.append('* ', createWikiLink('Trials', TRIALS_WIKI_URL), ' were removed from the game on 2018-03-01.');
	return [createTable(['Trial', 'Completions', 'Last completed'], rows), footnote];
}

function buildEventLines(stats: any): HTMLElement[] {
	return EVENT_SCORE_KEYS
		.filter(key => typeof stats[key] === 'number')
		.map(key => createLine(describeEventStat(key), stats[key].toLocaleString()));
}

export function renderStatsOverview(profile: any): void {
	const container = document.querySelector<HTMLElement>('#stats-overview-extra');
	if (!container) {
		return;
	}

	const stats = profile?.Stats ?? {};
	const result = profile?.Results?.[0] ?? {};
	renderDailyFocus(result);
	const sections = [
		createSection('Combat & Collection', buildCombatLines(stats)),
		createSection('Eidolons', buildEidolonTable(stats.Enemies)),
		createSection('Trials*', buildRaidTable(result)),
		createSection('Event Scores & Minigames', buildEventLines(stats)),
	];
	container.replaceChildren(...sections.filter(section => section !== undefined));
}

window.renderStatsOverview = renderStatsOverview;
