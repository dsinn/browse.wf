/**
 Unit tests for the hand-maintained tables in src/riven-calc/data.ts.

 Their numbers come from the wiki, so these guard against typos.
 */
import {describe, expect, test} from 'vitest';
import {
	ARCHGUN,
	EXTRA_STATS,
	KITGUN,
	MELEE,
	PISTOL,
	RIFLE,
	RIVEN_CLASSES,
	SHOTGUN,
	SHOTGUN_ZOOM,
	SPLICED_STATS,
	ZAW,
} from './data.js';

function splicedTagsFor(rivenClassKey: string): string[] {
	return SPLICED_STATS.filter(stat => stat.classes.includes(rivenClassKey)).map(stat => stat.tag);
}

describe('RIVEN_CLASSES', () => {
	test('has the seven Riven types, each with a unique key', () => {
		expect(RIVEN_CLASSES.map(rivenClass => rivenClass.label)).toEqual([
			'Archgun', 'Kitgun', 'Melee', 'Pistol', 'Rifle', 'Shotgun', 'Zaw',
		]);
		expect(new Set(RIVEN_CLASSES.map(rivenClass => rivenClass.key)).size).toBe(7);
	});
});

describe('SPLICED_STATS', () => {
	test('has the 18 spliced traits, each with a unique tag', () => {
		expect(SPLICED_STATS).toHaveLength(18);
		expect(new Set(SPLICED_STATS.map(stat => stat.tag)).size).toBe(18);
	});

	test('every spliced trait is a positive-only trait', () => {
		for (const stat of SPLICED_STATS) {
			expect(stat.spliced).toBe(true);
			expect(stat.canBeBuff).toBe(true);
			expect(stat.canBeCurse).toBe(false);
		}
	});

	test('only Ammo Efficiency has a negative base value and a reversed display', () => {
		const negative = SPLICED_STATS.filter(stat => stat.baseValue < 0);
		expect(negative.map(stat => stat.tag)).toEqual(['SplicedAmmoEfficiency']);
		expect(negative[0].reverseDisplay).toBe(true);
		expect(SPLICED_STATS.filter(stat => stat.reverseDisplay)).toHaveLength(1);
	});

	test('the faction damage traits are shown as multipliers', () => {
		const multipliers = SPLICED_STATS.filter(stat => stat.displayKind === 'multiplier').map(stat => stat.tag);
		expect(multipliers).toEqual(['SplicedOrokinDamage', 'SplicedScaldraDamage', 'SplicedTechrotDamage']);
	});

	test.each([
		['Rifle', RIFLE, 14],
		['Shotgun', SHOTGUN, 14],
		['Pistol', PISTOL, 14],
		['Kitgun', KITGUN, 14],
		['Archgun', ARCHGUN, 13],
		['Melee', MELEE, 14],
		['Zaw', ZAW, 14],
	])('%s can roll %i spliced traits', (_label, key, count) => {
		expect(splicedTagsFor(key)).toHaveLength(count);
	});

	test('the Weak Point and ammo traits are ranged-only, and the heavy attack, slam and parry traits melee-only', () => {
		for (const tag of ['SplicedWeakpointDamage', 'SplicedWeakpointCriticalChance', 'SplicedAmmoEfficiency']) {
			expect(splicedTagsFor(RIFLE)).toContain(tag);
			expect(splicedTagsFor(MELEE)).not.toContain(tag);
		}

		for (const tag of ['SplicedHeavyAttackDamage', 'SplicedHeavyAttackWindupSpeed', 'SplicedSlamDamage', 'SplicedParryAngle']) {
			expect(splicedTagsFor(MELEE)).toContain(tag);
			expect(splicedTagsFor(RIFLE)).not.toContain(tag);
		}
	});

	test('Archguns cannot roll Reload While Holstered', () => {
		expect(splicedTagsFor(ARCHGUN)).not.toContain('SplicedReloadWhileHolstered');
		expect(splicedTagsFor(PISTOL)).toContain('SplicedReloadWhileHolstered');
	});
});

describe('SHOTGUN_ZOOM', () => {
	test('is the only non-spliced extra, and only for shotguns', () => {
		expect(EXTRA_STATS.filter(stat => !stat.spliced)).toEqual([SHOTGUN_ZOOM]);
		expect(SHOTGUN_ZOOM.classes).toEqual([SHOTGUN]);
	});

	test('reuses the in-game name of the Zoom trait on other weapons', () => {
		expect(SHOTGUN_ZOOM.labelKey).toBe('/Lotus/Language/Upgrades/WeaponZoomModDesc');
	});
});
