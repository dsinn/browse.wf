/**
 Unit tests for src/riven-calc/groups.ts, using the real ExportUpgrades from warframe-public-export-plus.
 */
import {describe, expect, test} from 'vitest';
import {loadExportJson} from '../../test/helpers/api-mocks';
import {
	ARCHGUN, KITGUN, MELEE, PISTOL, RIFLE, RIVEN_CLASSES, SHOTGUN, ZAW,
} from './data.js';
import {GROUP_DEFINITIONS, groupStats, OTHER_GROUP_ID} from './groups.js';
import {getRivenStats, type StatDef} from './stats.js';

const exportUpgrades = loadExportJson('ExportUpgrades.json');

function baseStats(rivenClassKey: string): StatDef[] {
	return getRivenStats(rivenClassKey, exportUpgrades).filter(stat => !stat.spliced);
}

function groupsOf(rivenClassKey: string): Record<string, string[]> {
	return Object.fromEntries(groupStats(baseStats(rivenClassKey)).map(group => [group.id, group.stats.map(stat => stat.tag)]));
}

describe('groupStats', () => {
	test('lists the groups in order of importance, with Melee only second', () => {
		expect(groupStats(baseStats(MELEE)).map(group => group.id)).toEqual([
			'offence', 'melee', 'status', 'elemental', 'physical', 'faction',
		]);
		expect(groupStats(baseStats(RIFLE)).map(group => group.id)).toEqual([
			'offence', 'status', 'elemental', 'physical', 'faction', 'ammo', 'handling',
		]);
	});

	test('orders the offence traits of a ranged weapon: Damage, the two crits, then Multishot and Fire Rate', () => {
		expect(groupsOf(RIFLE).offence).toEqual([
			'WeaponDamageAmountMod',
			'WeaponCritChanceMod',
			'WeaponCritDamageMod',
			'WeaponFireIterationsMod',
			'WeaponFireRateMod',
		]);
	});

	test('orders the offence traits of a melee weapon, with Attack Speed (Fire Rate) after the crits', () => {
		expect(groupsOf(MELEE).offence).toEqual([
			'WeaponMeleeDamageMod',
			'WeaponCritChanceMod',
			'WeaponCritDamageMod',
			'SlideAttackCritChanceMod',
			'WeaponFireRateMod',
			'WeaponMeleeFinisherDamageMod',
		]);
	});

	test('orders the melee-only traits: Range first, then the combo traits', () => {
		expect(groupsOf(MELEE).melee).toEqual([
			'WeaponMeleeRangeIncMod',
			'WeaponMeleeComboInitialBonusMod',
			'WeaponMeleeComboEfficiencyMod',
			'ComboDurationMod',
			'WeaponMeleeComboBonusOnHitMod',
			'WeaponMeleeComboPointsOnHitMod',
		]);
	});

	test('orders Status Chance before Status Duration', () => {
		expect(groupsOf(RIFLE).status).toEqual(['WeaponStunChanceMod', 'WeaponProcTimeMod']);
	});

	test('orders the elements Heat, Cold, Electricity, Toxin', () => {
		expect(groupsOf(RIFLE).elemental).toEqual([
			'WeaponFireDamageMod',
			'WeaponFreezeDamageMod',
			'WeaponElectricityDamageMod',
			'WeaponToxinDamageMod',
		]);
	});

	test('orders the physical types Impact, Puncture, Slash', () => {
		expect(groupsOf(RIFLE).physical).toEqual(['WeaponImpactDamageMod', 'WeaponArmorPiercingDamageMod', 'WeaponSlashDamageMod']);
	});

	test('orders the factions alphabetically, using the melee stats for melee weapons', () => {
		expect(groupsOf(RIFLE).faction).toEqual(['WeaponFactionDamageCorpus', 'WeaponFactionDamageGrineer', 'WeaponFactionDamageInfested']);
		expect(groupsOf(MELEE).faction).toEqual([
			'WeaponMeleeFactionDamageCorpus', 'WeaponMeleeFactionDamageGrineer', 'WeaponMeleeFactionDamageInfested',
		]);
	});

	test('orders Reload Speed, Magazine Capacity, Ammo Maximum, so the two ammo numbers of the mission UI are adjacent, then handling', () => {
		expect(groupsOf(RIFLE).ammo).toEqual(['WeaponReloadSpeedMod', 'WeaponClipMaxMod', 'WeaponAmmoMaxMod']);
		expect(groupsOf(RIFLE).handling).toEqual([
			'WeaponProjectileSpeedMod', 'WeaponPunctureDepthMod', 'WeaponRecoilReductionMod', 'WeaponZoomFovMod',
		]);
	});

	test('skips what a Riven type cannot roll: archguns have no Projectile Speed, and shotguns have Zoom added', () => {
		expect(groupsOf(ARCHGUN).handling).not.toContain('WeaponProjectileSpeedMod');
		expect(groupsOf(SHOTGUN).handling).toContain('WeaponZoomFovMod');
	});

	test.each(RIVEN_CLASSES.map(rivenClass => [rivenClass.label, rivenClass.key]))(
		'%s: shows every trait of the Riven type, spliced ones included, exactly once, and none of them as "other"',
		(_label, rivenClassKey) => {
			const stats = getRivenStats(rivenClassKey, exportUpgrades);
			const grouped = [...groupStats(stats.filter(stat => !stat.spliced)), ...groupStats(stats.filter(stat => stat.spliced))];

			expect(grouped.flatMap(group => group.stats.map(stat => stat.tag)).sort()).toEqual(stats.map(stat => stat.tag).sort());
			// If this fails, the game has gained a trait: decide which group it belongs in (see GROUP_DEFINITIONS)
			expect(grouped.map(group => group.id)).not.toContain(OTHER_GROUP_ID);
		},
	);

	test('puts a trait that has no group last, in a group of its own, in its original order', () => {
		const newStat: StatDef = {...baseStats(RIFLE)[0], tag: 'WeaponBrandNewMod'};
		const newerStat: StatDef = {...newStat, tag: 'WeaponBrandNewerMod'};

		const grouped = groupStats([newStat, ...baseStats(RIFLE), newerStat]);

		const last = grouped.at(-1)!;
		expect(last.id).toBe(OTHER_GROUP_ID);
		expect(last.stats.map(stat => stat.tag)).toEqual(['WeaponBrandNewMod', 'WeaponBrandNewerMod']);
	});

	test('leaves out groups with no traits, and handles no stats at all', () => {
		expect(groupStats([])).toEqual([]);
	});

	test('lists each trait in only one group definition', () => {
		const tags = GROUP_DEFINITIONS.flatMap(definition => definition.tags);
		expect(new Set(tags).size).toBe(tags.length);
	});

	test('kitguns, pistols and zaws are grouped like the rifles and melee weapons they resemble', () => {
		expect(Object.keys(groupsOf(PISTOL))).toEqual(Object.keys(groupsOf(RIFLE)));
		expect(Object.keys(groupsOf(KITGUN))).toEqual(Object.keys(groupsOf(RIFLE)));
		expect(Object.keys(groupsOf(ZAW))).toEqual(Object.keys(groupsOf(MELEE)));
	});
});

describe('where the spliced traits go', () => {
	// The Warframe Wiki's splicing table: each spliced trait, and the pairs of base traits that make it
	const damage = ['WeaponDamageAmountMod', 'WeaponMeleeDamageMod'];
	const corpus = ['WeaponFactionDamageCorpus', 'WeaponMeleeFactionDamageCorpus'];
	const grineer = ['WeaponFactionDamageGrineer', 'WeaponMeleeFactionDamageGrineer'];
	const infested = ['WeaponFactionDamageInfested', 'WeaponMeleeFactionDamageInfested'];
	const [critChance, zoom, multishot, magazine, reload] = [
		['WeaponCritChanceMod'], ['WeaponZoomFovMod'], ['WeaponFireIterationsMod'], ['WeaponClipMaxMod'], ['WeaponReloadSpeedMod'],
	];
	const [recoil, ammoMaximum, statusChance, attackSpeed, range] = [
		['WeaponRecoilReductionMod'], ['WeaponAmmoMaxMod'], ['WeaponStunChanceMod'], ['WeaponFireRateMod'], ['WeaponMeleeRangeIncMod'],
	];
	const [efficiency, extraCombo, comboDuration] = [
		['WeaponMeleeComboEfficiencyMod'], ['WeaponMeleeComboBonusOnHitMod'], ['ComboDurationMod'],
	];
	const [heat, cold, electricity, toxin] = [
		['WeaponFireDamageMod'], ['WeaponFreezeDamageMod'], ['WeaponElectricityDamageMod'], ['WeaponToxinDamageMod'],
	];

	const RECIPES: Record<string, string[][][]> = {
		SplicedWeakpointDamage: [[damage, zoom], [damage, multishot]],
		SplicedWeakpointCriticalChance: [[critChance, zoom], [critChance, multishot]],
		SplicedAmmoEfficiency: [[magazine, reload], [recoil, ammoMaximum]],
		SplicedReloadWhileHolstered: [[ammoMaximum, reload], [ammoMaximum, magazine]],
		SplicedStatusDamage: [[damage, statusChance]],
		SplicedHeavyAttackDamage: [[efficiency, extraCombo]],
		SplicedHeavyAttackWindupSpeed: [[efficiency, comboDuration]],
		SplicedParryAngle: [[attackSpeed, range]],
		SplicedSlamDamage: [[damage, attackSpeed]],
		SplicedGasDamage: [[toxin, heat]],
		SplicedCorrosiveDamage: [[toxin, electricity]],
		SplicedViralDamage: [[toxin, cold]],
		SplicedRadiationDamage: [[heat, electricity]],
		SplicedBlastDamage: [[heat, cold]],
		SplicedMagneticDamage: [[electricity, cold]],
		SplicedOrokinDamage: [[corpus, grineer]],
		SplicedTechrotDamage: [[corpus, infested]],
		SplicedScaldraDamage: [[infested, grineer]],
	};

	const order = GROUP_DEFINITIONS.flatMap(definition => definition.tags);
	const positionOf = (ingredient: string[]): number => Math.min(...ingredient.map(tag => order.indexOf(tag)).filter(index => index !== -1));
	const nameOf = (ingredient: string[]): string => ingredient[0];

	/**
	The earliest ingredient that every recipe uses, or failing that the earliest of any.
	*/
	function anchorOf(recipes: string[][][]): string[] {
		const ingredients = recipes.flat();
		const common = ingredients.filter(ingredient => recipes.every(recipe => recipe.some(candidate => nameOf(candidate) === nameOf(ingredient))));
		const candidates = common.length > 0 ? common : ingredients;
		let best = candidates[0];
		for (const candidate of candidates) {
			if (positionOf(candidate) < positionOf(best)) {
				best = candidate;
			}
		}

		return best;
	}

	/**
	The earliest of the ingredients that go with the anchor.
	*/
	function partnerPositionOf(recipes: string[][][], anchor: string[]): number {
		return Math.min(...recipes.flatMap(recipe => recipe.filter(ingredient => nameOf(ingredient) !== nameOf(anchor)).map(ingredient => positionOf(ingredient))));
	}

	test('knows a recipe for every spliced trait the page offers', () => {
		const spliced = new Set([...getRivenStats(RIFLE, exportUpgrades), ...getRivenStats(MELEE, exportUpgrades)]
			.filter(stat => stat.spliced).map(stat => stat.tag));
		expect([...spliced].sort()).toEqual(Object.keys(RECIPES).sort());
	});

	test.each(Object.entries(RECIPES))('%s goes immediately before the base trait it is made from', (tag, recipes) => {
		const anchor = anchorOf(recipes);
		const following = order.slice(order.indexOf(tag) + 1).find(candidate => !candidate.startsWith('Spliced'));
		expect(anchor).toContain(following);
	});

	// Spliced traits that only some weapon types can roll never appear together with those of the other types
	const RANGED_ONLY = new Set(['SplicedWeakpointDamage', 'SplicedWeakpointCriticalChance', 'SplicedAmmoEfficiency', 'SplicedReloadWhileHolstered']);
	const MELEE_ONLY = new Set(['SplicedHeavyAttackDamage', 'SplicedHeavyAttackWindupSpeed', 'SplicedParryAngle', 'SplicedSlamDamage']);

	test.each([
		['ranged weapons', MELEE_ONLY],
		['melee weapons', RANGED_ONLY],
	])('spliced traits sharing a base trait go in order of their other ingredient, for %s', (_weapons, excluded) => {
		const entries = Object.entries(RECIPES).filter(([tag]) => !excluded.has(tag));
		const byAnchor = new Map<string, typeof entries>();
		for (const entry of entries) {
			const anchor = nameOf(anchorOf(entry[1]));
			byAnchor.set(anchor, [...byAnchor.get(anchor) ?? [], entry]);
		}

		for (const sharing of byAnchor.values()) {
			const expected = [...sharing]
				.sort(([, left], [, right]) => partnerPositionOf(left, anchorOf(left)) - partnerPositionOf(right, anchorOf(right)))
				.map(([tag]) => tag);
			const placed = expected.toSorted((left, right) => order.indexOf(left) - order.indexOf(right));
			expect(placed).toEqual(expected);
		}
	});

	test('puts Weak Point Damage first, ahead of Damage itself', () => {
		expect(order.indexOf('SplicedWeakpointDamage')).toBeLessThan(order.indexOf('WeaponDamageAmountMod'));
		expect(groupStats(getRivenStats(RIFLE, exportUpgrades)).find(group => group.id === 'offence')!.stats[0].tag).toBe('SplicedWeakpointDamage');
	});

	test('keeps the elementals in Heat, Cold, Electricity, Toxin order, with each combination before its first ingredient', () => {
		const elements = groupStats(getRivenStats(RIFLE, exportUpgrades).filter(stat => stat.spliced)).find(group => group.id === 'elemental')!;
		expect(elements.stats.map(stat => stat.tag)).toEqual([
			'SplicedBlastDamage',
			'SplicedRadiationDamage',
			'SplicedGasDamage',
			'SplicedMagneticDamage',
			'SplicedViralDamage',
			'SplicedCorrosiveDamage',
		]);
	});
});
