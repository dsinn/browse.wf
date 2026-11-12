/**
 The order in which the traits are listed. The game's own order is the order of its data file,
 which says nothing about how to assess a Riven, so traits are listed by how much builds tend to care about them,
 with traits that are obviously related (the crits, the elements, the physical types, status) kept together.
 A trait that is not listed here is shown last, in a group of its own, so a stat added to the game is never lost.
 */
import {type StatDef} from './stats.js';

export type TraitGroup = {
	id: string;
	/**
	Names the group for screen readers; the page shows no heading.
	*/
	label: string;
	stats: StatDef[];
};

type GroupDefinition = {
	id: string;
	label: string;
	/**
	Listed in the order to show them. A trait the Riven type cannot roll is skipped.
	*/
	tags: readonly string[];
};

export const OTHER_GROUP_ID = 'other';

/*
 * Spliced traits are placed by the base traits they are made from (the Warframe Wiki's splicing table). Each sits
 * immediately before its "anchor", the earliest of the base traits that every one of its recipes uses (when no base
 * trait is in every recipe, the earliest of any of them). Where several spliced traits share an anchor, the one whose
 * other ingredient comes earlier goes first. So Weak Point Damage, which always needs Damage, goes before Damage, and
 * Gas Damage (Heat + Toxin) goes before Heat. The spliced traits are shown in a card of their own, but in this order.
 */
export const GROUP_DEFINITIONS: readonly GroupDefinition[] = [
	{
		id: 'offence',
		label: 'Offence',
		tags: [
			'SplicedSlamDamage',
			'SplicedWeakpointDamage',
			'SplicedStatusDamage',
			'WeaponDamageAmountMod',
			'WeaponMeleeDamageMod',
			'SplicedWeakpointCriticalChance',
			'WeaponCritChanceMod',
			'WeaponCritDamageMod',
			'SlideAttackCritChanceMod',
			'WeaponFireIterationsMod',
			'SplicedParryAngle',
			'WeaponFireRateMod',
			'WeaponMeleeFinisherDamageMod',
		],
	},
	{
		id: 'melee',
		label: 'Melee only',
		tags: [
			'WeaponMeleeRangeIncMod',
			'WeaponMeleeComboInitialBonusMod',
			'SplicedHeavyAttackWindupSpeed',
			'SplicedHeavyAttackDamage',
			'WeaponMeleeComboEfficiencyMod',
			'ComboDurationMod',
			'WeaponMeleeComboBonusOnHitMod',
			'WeaponMeleeComboPointsOnHitMod',
		],
	},
	{
		id: 'status',
		label: 'Status',
		tags: ['WeaponStunChanceMod', 'WeaponProcTimeMod'],
	},
	{
		id: 'elemental',
		label: 'Elemental damage',
		// Heat, Cold, Electricity, Toxin: the community's usual order
		tags: [
			'SplicedBlastDamage',
			'SplicedRadiationDamage',
			'SplicedGasDamage',
			'WeaponFireDamageMod',
			'SplicedMagneticDamage',
			'SplicedViralDamage',
			'WeaponFreezeDamageMod',
			'SplicedCorrosiveDamage',
			'WeaponElectricityDamageMod',
			'WeaponToxinDamageMod',
		],
	},
	{
		id: 'physical',
		label: 'Physical damage',
		// Impact, Puncture, Slash
		tags: ['WeaponImpactDamageMod', 'WeaponArmorPiercingDamageMod', 'WeaponSlashDamageMod'],
	},
	{
		id: 'faction',
		label: 'Faction damage',
		tags: [
			'SplicedOrokinDamage',
			'SplicedTechrotDamage',
			'WeaponFactionDamageCorpus',
			'WeaponMeleeFactionDamageCorpus',
			'SplicedScaldraDamage',
			'WeaponFactionDamageGrineer',
			'WeaponMeleeFactionDamageGrineer',
			'WeaponFactionDamageInfested',
			'WeaponMeleeFactionDamageInfested',
		],
	},
	{
		id: 'ammo',
		label: 'Ammo and reload',
		// Magazine Capacity and Ammo Maximum are next to each other, as are the two numbers they change in the mission UI
		tags: [
			'SplicedAmmoEfficiency',
			'WeaponReloadSpeedMod',
			'WeaponClipMaxMod',
			'SplicedReloadWhileHolstered',
			'WeaponAmmoMaxMod',
		],
	},
	{
		id: 'handling',
		label: 'Handling',
		tags: [
			'WeaponProjectileSpeedMod',
			'WeaponPunctureDepthMod',
			'WeaponRecoilReductionMod',
			'WeaponZoomFovMod',
		],
	},
];

/**
Sorts the stats into ordered groups, leaving out groups that have none of them.
*/
export function groupStats(stats: readonly StatDef[]): TraitGroup[] {
	const remaining = new Map(stats.map(stat => [stat.tag, stat]));
	const groups: TraitGroup[] = [];

	for (const definition of GROUP_DEFINITIONS) {
		const members: StatDef[] = [];
		for (const tag of definition.tags) {
			const stat = remaining.get(tag);
			if (!stat) {
				continue;
			}

			members.push(stat);
			remaining.delete(tag);
		}

		if (members.length > 0) {
			groups.push({id: definition.id, label: definition.label, stats: members});
		}
	}

	if (remaining.size > 0) {
		groups.push({id: OTHER_GROUP_ID, label: 'Other', stats: [...remaining.values()]});
	}

	return groups;
}
