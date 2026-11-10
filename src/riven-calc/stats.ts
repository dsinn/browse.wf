import {EXTRA_STATS} from './data.js';
import {type DisplayKind, type StatMaths} from './formula.js';

export type StatDef = StatMaths & {
	tag: string;
	/** Dictionary key of the display template, e.g. "|val|% Critical Chance". */
	labelKey: string;
	canBeBuff: boolean;
	canBeCurse: boolean;
	/** True for traits made by Riven Splicing. */
	spliced: boolean;
};

const UPGRADES_PREFIX = '/Lotus/Upgrades/Mods/Randomized/';

/** Stats whose in-game number is a multiplier rather than a percentage. */
const MULTIPLIER_TAGS = new Set([
	'WeaponFactionDamageCorpus',
	'WeaponFactionDamageGrineer',
	'WeaponFactionDamageInfested',
	'WeaponMeleeFactionDamageCorpus',
	'WeaponMeleeFactionDamageGrineer',
	'WeaponMeleeFactionDamageInfested',
]);

/** Stats whose in-game number is a plain quantity (seconds, metres, combo count) rather than a percentage. */
const DECIMAL_TAGS = new Set([
	'ComboDurationMod',
	'WeaponMeleeComboInitialBonusMod',
	'WeaponMeleeRangeIncMod',
	'WeaponPunctureDepthMod',
]);

function getDisplayKind(tag: string): DisplayKind {
	if (MULTIPLIER_TAGS.has(tag)) {
		return 'multiplier';
	}

	return DECIMAL_TAGS.has(tag) ? 'decimal' : 'percent';
}

/**
 * Every stat that a Riven of the given class can roll: the ones in ExportUpgrades, plus the ones the page adds
 * (see ./data.ts). A stat in the export always wins over an added one with the same tag.
 */
export function getRivenStats(rivenClassKey: string, exportUpgrades: Record<string, any>): StatDef[] {
	const entries: any[] = exportUpgrades[UPGRADES_PREFIX + rivenClassKey]?.upgradeEntries ?? [];
	const stats = entries.map((entry): StatDef => {
		const upgradeValue = entry.upgradeValues[0];
		return {
			tag: entry.tag,
			baseValue: upgradeValue.value,
			labelKey: upgradeValue.locTag,
			displayKind: getDisplayKind(entry.tag),
			reverseDisplay: upgradeValue.reverseValueSymbol === true,
			canBeBuff: entry.canBeBuff,
			canBeCurse: entry.canBeCurse,
			spliced: false,
		};
	});

	for (const extra of EXTRA_STATS) {
		if (extra.classes.includes(rivenClassKey) && !stats.some(stat => stat.tag === extra.tag)) {
			stats.push({
				tag: extra.tag,
				baseValue: extra.baseValue,
				labelKey: extra.labelKey,
				displayKind: extra.displayKind,
				reverseDisplay: extra.reverseDisplay,
				canBeBuff: extra.canBeBuff,
				canBeCurse: extra.canBeCurse,
				spliced: extra.spliced,
			});
		}
	}

	return stats;
}
