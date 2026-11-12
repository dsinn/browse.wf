/**
 * Riven data that warframe-public-export-plus does not provide (yet): the spliced traits introduced by
 * Riven Splicing in Update 44.1, and Zoom on shotguns (Hotfix 44.0.2).
 *
 * Base coefficients are from the Warframe Wiki's "Riven Mods" page. Once the export gains real entries for
 * these, they take precedence over this table (see {@link getRivenStats}).
 *
 * The tags below are internal to this page. The real in-game tags are unknown, and nothing here needs them
 * because the calculator works from displayed values rather than Riven fingerprints.
 */
import {type DisplayKind} from './formula.js';

export type RivenClass = {
	/** Key of the class in ExportUpgrades, after /Lotus/Upgrades/Mods/Randomized/ */
	key: string;
	label: string;
};

export const ARCHGUN = 'LotusArchgunRandomModRare';
export const KITGUN = 'LotusModularPistolRandomModRare';
export const MELEE = 'PlayerMeleeWeaponRandomModRare';
export const PISTOL = 'LotusPistolRandomModRare';
export const RIFLE = 'LotusRifleRandomModRare';
export const SHOTGUN = 'LotusShotgunRandomModRare';
export const ZAW = 'LotusModularMeleeRandomModRare';

/** In the order they are listed in the class selector, which is also the order compatibility is checked in. */
export const RIVEN_CLASSES: readonly RivenClass[] = [
	{key: ARCHGUN, label: 'Archgun'},
	{key: KITGUN, label: 'Kitgun'},
	{key: MELEE, label: 'Melee'},
	{key: PISTOL, label: 'Pistol'},
	{key: RIFLE, label: 'Rifle'},
	{key: SHOTGUN, label: 'Shotgun'},
	{key: ZAW, label: 'Zaw'},
];

export const DEFAULT_RIVEN_CLASS = RIFLE;

const ALL_CLASSES = RIVEN_CLASSES.map(rivenClass => rivenClass.key);
const RANGED = [ARCHGUN, KITGUN, PISTOL, RIFLE, SHOTGUN];
const RANGED_WITH_HOLSTER = [KITGUN, PISTOL, RIFLE, SHOTGUN];
const MELEE_CLASSES = [MELEE, ZAW];

/** A stat that the page adds to the ones in the export. */
export type ExtraStat = {
	tag: string;
	baseValue: number;
	/** Dictionary key of the display template, e.g. "|val|% Zoom". */
	labelKey: string;
	displayKind: DisplayKind;
	reverseDisplay: boolean;
	canBeBuff: boolean;
	canBeCurse: boolean;
	spliced: boolean;
	/** Keys of the Riven classes (see {@link RIVEN_CLASSES}) that can roll the stat. */
	classes: readonly string[];
};

function splicedStat(
	name: string,
	baseValue: number,
	classes: readonly string[],
	options: {displayKind?: DisplayKind; reverseDisplay?: boolean} = {},
): ExtraStat {
	return {
		tag: `Spliced${name}`,
		baseValue,
		// Resolved through src/translation-fallback-data.json
		labelKey: `/Lotus/Language/Upgrades/Spliced/${name}Desc`,
		displayKind: options.displayKind ?? 'percent',
		reverseDisplay: options.reverseDisplay ?? false,
		canBeBuff: true,
		canBeCurse: false,
		spliced: true,
		classes,
	};
}

export const SPLICED_STATS: readonly ExtraStat[] = [
	splicedStat('AmmoEfficiency', -0.005, RANGED, {reverseDisplay: true}),
	splicedStat('BlastDamage', 0.01, ALL_CLASSES),
	splicedStat('CorrosiveDamage', 0.01, ALL_CLASSES),
	splicedStat('GasDamage', 0.01, ALL_CLASSES),
	splicedStat('MagneticDamage', 0.01, ALL_CLASSES),
	splicedStat('RadiationDamage', 0.01, ALL_CLASSES),
	splicedStat('ViralDamage', 0.01, ALL_CLASSES),
	splicedStat('StatusDamage', 0.01, ALL_CLASSES),
	splicedStat('OrokinDamage', 0.005, ALL_CLASSES, {displayKind: 'multiplier'}),
	splicedStat('ScaldraDamage', 0.005, ALL_CLASSES, {displayKind: 'multiplier'}),
	splicedStat('TechrotDamage', 0.005, ALL_CLASSES, {displayKind: 'multiplier'}),
	splicedStat('ReloadWhileHolstered', 0.01, RANGED_WITH_HOLSTER),
	splicedStat('WeakpointDamage', 0.025, RANGED),
	splicedStat('WeakpointCriticalChance', 0.0275, RANGED),
	splicedStat('HeavyAttackDamage', 0.0133, MELEE_CLASSES),
	splicedStat('HeavyAttackWindupSpeed', 0.0133, MELEE_CLASSES),
	splicedStat('SlamDamage', 0.0133, MELEE_CLASSES),
	splicedStat('ParryAngle', 0.009, MELEE_CLASSES),
];

/** Shotguns gained Zoom in Hotfix 44.0.2 so that they can be spliced into Weak Point traits. */
export const SHOTGUN_ZOOM: ExtraStat = {
	tag: 'WeaponZoomFovMod',
	baseValue: 0.004666,
	labelKey: '/Lotus/Language/Upgrades/WeaponZoomModDesc',
	displayKind: 'percent',
	reverseDisplay: false,
	canBeBuff: true,
	canBeCurse: true,
	spliced: false,
	classes: [SHOTGUN],
};

export const EXTRA_STATS: readonly ExtraStat[] = [...SPLICED_STATS, SHOTGUN_ZOOM];
