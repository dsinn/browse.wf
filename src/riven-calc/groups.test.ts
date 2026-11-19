/**
 Unit tests for src/riven-calc/groups.ts, using the real ExportUpgrades from warframe-public-export-plus.
 */
import {describe, expect, test} from 'vitest';
import {loadExportJson} from '../../test/helpers/api-mocks';
import {
	ARCHGUN,
	KITGUN,
	MELEE,
	PISTOL,
	RIFLE,
	RIVEN_CLASSES,
	SHOTGUN,
	ZAW,
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
