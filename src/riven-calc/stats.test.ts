/**
 * Unit tests for src/riven-calc/stats.ts, using the real ExportUpgrades from warframe-public-export-plus.
 */
import {describe, expect, test} from 'vitest';
import {loadExportJson} from '../../test/helpers/api-mocks';
import {
	ARCHGUN, MELEE, RIFLE, SHOTGUN,
} from './data.js';
import {getRivenStats} from './stats.js';

const exportUpgrades = loadExportJson('ExportUpgrades.json');

function upstreamCount(rivenClassKey: string): number {
	return exportUpgrades['/Lotus/Upgrades/Mods/Randomized/' + rivenClassKey].upgradeEntries.length;
}

function find(rivenClassKey: string, tag: string) {
	return getRivenStats(rivenClassKey, exportUpgrades).find(stat => stat.tag === tag);
}

describe('getRivenStats', () => {
	test('includes every stat in the export', () => {
		for (const rivenClassKey of [ARCHGUN, MELEE, RIFLE]) {
			const tags = new Set(getRivenStats(rivenClassKey, exportUpgrades).map(stat => stat.tag));
			for (const entry of exportUpgrades['/Lotus/Upgrades/Mods/Randomized/' + rivenClassKey].upgradeEntries) {
				expect(tags.has(entry.tag), entry.tag).toBe(true);
			}
		}
	});

	test('adds the spliced traits a class can roll to the export stats', () => {
		const stats = getRivenStats(RIFLE, exportUpgrades);
		expect(stats.filter(stat => stat.spliced)).toHaveLength(14);
		expect(stats).toHaveLength(upstreamCount(RIFLE) + 14);
	});

	test('rifles roll Weak Point traits and melee weapons roll Slam Damage, but not the other way round', () => {
		expect(find(RIFLE, 'SplicedWeakpointDamage')).toBeDefined();
		expect(find(RIFLE, 'SplicedSlamDamage')).toBeUndefined();
		expect(find(MELEE, 'SplicedSlamDamage')).toBeDefined();
		expect(find(MELEE, 'SplicedWeakpointDamage')).toBeUndefined();
	});

	test('archguns cannot roll Reload While Holstered', () => {
		expect(find(ARCHGUN, 'SplicedReloadWhileHolstered')).toBeUndefined();
	});

	test('adds Zoom to shotguns, which the export lacks', () => {
		expect(exportUpgrades['/Lotus/Upgrades/Mods/Randomized/' + SHOTGUN].upgradeEntries
			.some((entry: {tag: string}) => entry.tag === 'WeaponZoomFovMod')).toBe(false);
		expect(find(SHOTGUN, 'WeaponZoomFovMod')).toMatchObject({baseValue: 0.004_666, spliced: false});
	});

	test('keeps the export\'s Zoom for rifles rather than adding a second one', () => {
		const zoomStats = getRivenStats(RIFLE, exportUpgrades).filter(stat => stat.tag === 'WeaponZoomFovMod');
		expect(zoomStats).toHaveLength(1);
		expect(zoomStats[0].baseValue).toBe(0.006_666);
	});

	test('a stat in the export wins over an added one with the same tag', () => {
		const customUpgrades = {
			'/Lotus/Upgrades/Mods/Randomized/LotusShotgunRandomModRare': {
				upgradeEntries: [{
					tag: 'WeaponZoomFovMod',
					canBeBuff: true,
					canBeCurse: false,
					upgradeValues: [{value: 0.5, locTag: '/Custom/Zoom'}],
				}],
			},
		};
		const zoomStats = getRivenStats(SHOTGUN, customUpgrades).filter(stat => stat.tag === 'WeaponZoomFovMod');
		expect(zoomStats).toEqual([{
			tag: 'WeaponZoomFovMod',
			baseValue: 0.5,
			labelKey: '/Custom/Zoom',
			displayKind: 'percent',
			reverseDisplay: false,
			canBeBuff: true,
			canBeCurse: false,
			spliced: false,
		}]);
	});

	test('still offers the added stats when the export has no entries for the class', () => {
		const tags = getRivenStats(RIFLE, {}).map(stat => stat.tag);
		expect(tags).toContain('SplicedWeakpointDamage');
		expect(tags).not.toContain('WeaponDamageAmountMod');
	});

	test('offers nothing for an unknown class', () => {
		expect(getRivenStats('NotARivenClass', exportUpgrades)).toEqual([]);
	});

	test('spliced traits can only be positive', () => {
		for (const stat of getRivenStats(RIFLE, exportUpgrades).filter(candidate => candidate.spliced)) {
			expect(stat.canBeBuff).toBe(true);
			expect(stat.canBeCurse).toBe(false);
		}
	});
});

describe('display kinds', () => {
	test.each([
		['WeaponFactionDamageGrineer', 'multiplier'],
		['WeaponFactionDamageCorpus', 'multiplier'],
		['WeaponDamageAmountMod', 'percent'],
		['WeaponCritChanceMod', 'percent'],
	])('%s is shown as %s', (tag, expected) => {
		expect(find(RIFLE, tag)?.displayKind).toBe(expected);
	});

	test('Punch Through is a plain quantity in metres', () => {
		expect(find(RIFLE, 'WeaponPunctureDepthMod')?.displayKind).toBe('decimal');
	});

	test.each([
		'ComboDurationMod',
		'WeaponMeleeComboInitialBonusMod',
		'WeaponMeleeRangeIncMod',
	])('%s is a plain quantity', tag => {
		expect(find(MELEE, tag)?.displayKind).toBe('decimal');
	});

	test('melee faction damage is a multiplier', () => {
		expect(find(MELEE, 'WeaponMeleeFactionDamageGrineer')?.displayKind).toBe('multiplier');
	});
});

describe('which traits can be positive or negative', () => {
	test('elemental damage and Punch Through cannot be negative', () => {
		for (const tag of ['WeaponFireDamageMod', 'WeaponToxinDamageMod', 'WeaponPunctureDepthMod']) {
			expect(find(RIFLE, tag), tag).toMatchObject({canBeBuff: true, canBeCurse: false});
		}
	});

	test('Chance to Gain Combo Count is negative-only, and shown reversed', () => {
		expect(find(MELEE, 'WeaponMeleeComboPointsOnHitMod')).toMatchObject({
			canBeBuff: false,
			canBeCurse: true,
			reverseDisplay: true,
		});
	});

	test('Initial Combo is positive-only', () => {
		expect(find(MELEE, 'WeaponMeleeComboInitialBonusMod')).toMatchObject({canBeBuff: true, canBeCurse: false});
	});

	test('Weapon Recoil has a negative base value', () => {
		expect(find(RIFLE, 'WeaponRecoilReductionMod')?.baseValue).toBeLessThan(0);
	});
});
