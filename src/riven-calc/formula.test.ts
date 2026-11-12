/**
 * Unit tests for src/riven-calc/formula.ts.
 *
 * The expected ranges are the rank 8 ranges on the Warframe Wiki's "Riven Mods" page (which uses the fixed
 * 1.2 disposition), so these pin the calculator to the numbers players see in game.
 */
import {describe, expect, test} from 'vitest';
import {
	clampRank,
	computeValue,
	fromDisplayValue,
	getDisplayRange,
	getDisplayStep,
	getLayoutMultiplier,
	getRollFromDisplayValue,
	gradeDisplayValue,
	gradeRoll,
	normalizeLayout,
	rollToFactor,
	toDisplayValue,
	type DisplayKind,
	type Layout,
	type StatMaths,
	type TraitContext,
} from './formula.js';

function stat(baseValue: number, displayKind: DisplayKind = 'percent', reverseDisplay = false): StatMaths {
	return {baseValue, displayKind, reverseDisplay};
}

function layoutOf(buffs: number, curses: number): Layout {
	return {buffs, curses};
}

const DAMAGE = stat(0.018_333);
const CRITICAL_CHANCE = stat(0.016_666);
const CRITICAL_DAMAGE = stat(0.013_333);
const MULTISHOT = stat(0.01);

describe('getLayoutMultiplier', () => {
	test.each([
		[2, 0, 'buff', 0.99],
		[2, 1, 'buff', 1.2375],
		[3, 0, 'buff', 0.75],
		[3, 1, 'buff', 0.9375],
		[2, 1, 'curse', -0.495],
		[3, 1, 'curse', -0.75],
	] as const)('%i positive and %i negative traits: %s is %d', (buffs, curses, kind, expected) => {
		expect(getLayoutMultiplier(layoutOf(buffs, curses), kind)).toBe(expected);
	});

	test('a Riven with no negative trait has no curse multiplier', () => {
		expect(getLayoutMultiplier(layoutOf(3, 0), 'curse')).toBe(0);
	});
});

describe('normalizeLayout', () => {
	test('leaves possible layouts alone', () => {
		expect(normalizeLayout(2, 0)).toEqual({buffs: 2, curses: 0});
		expect(normalizeLayout(3, 1)).toEqual({buffs: 3, curses: 1});
	});

	test('clamps out-of-range trait counts', () => {
		expect(normalizeLayout(1, 5)).toEqual({buffs: 2, curses: 1});
		expect(normalizeLayout(9, -1)).toEqual({buffs: 3, curses: 0});
	});

	test('falls back to the default layout for non-numbers', () => {
		expect(normalizeLayout(NaN, NaN)).toEqual({buffs: 3, curses: 1});
	});
});

describe('clampRank', () => {
	test.each([
		[0, 0],
		[8, 8],
		[-3, 0],
		[12, 8],
		[4.7, 4],
		[NaN, 8],
	])('%d becomes %d', (rank, expected) => {
		expect(clampRank(rank)).toBe(expected);
	});
});

describe('rollToFactor', () => {
	test('maps rolls 0, 0.5 and 1 to 0.9x, 1.0x and 1.1x', () => {
		expect(rollToFactor(0)).toBeCloseTo(0.9, 10);
		expect(rollToFactor(0.5)).toBeCloseTo(1, 10);
		expect(rollToFactor(1)).toBeCloseTo(1.1, 10);
	});
});

describe('getDisplayRange: ordinary traits at rank 8 (wiki "Riven Mods" overview)', () => {
	const statsByName: Record<string, StatMaths> = {
		Damage: DAMAGE,
		'Critical Chance': CRITICAL_CHANCE,
		'Critical Damage': CRITICAL_DAMAGE,
		Multishot: MULTISHOT,
	};

	function rangeOf(name: string, buffs: number, curses: number, kind: 'buff' | 'curse'): [number, number] {
		const {min, max} = getDisplayRange(statsByName[name], {rank: 8, layout: layoutOf(buffs, curses), kind});
		return [min, max];
	}

	test.each([
		['Damage', 3, 1, [167.1, 204.2]],
		['Damage', 2, 1, [220.5, 269.5]],
		['Damage', 2, 0, [176.4, 215.6]],
		['Critical Chance', 3, 1, [151.9, 185.6]],
		['Critical Chance', 2, 1, [200.5, 245]],
		['Critical Chance', 3, 0, [121.5, 148.5]],
		['Critical Damage', 3, 1, [121.5, 148.5]],
		['Critical Damage', 2, 0, [128.3, 156.8]],
		['Multishot', 3, 1, [91.1, 111.4]],
		['Multishot', 2, 1, [120.3, 147]],
	] as const)('%s with %i positive and %i negative traits is %j', (name, buffs, curses, expected) => {
		expect(rangeOf(name, buffs, curses, 'buff')).toEqual(expected);
	});

	test.each([
		['Damage', 2, 1, [-88.2, -107.8]],
		['Critical Chance', 3, 1, [-121.5, -148.5]],
		['Critical Chance', 2, 1, [-80.2, -98]],
		['Critical Damage', 3, 1, [-97.2, -118.8]],
		['Multishot', 3, 1, [-72.9, -89.1]],
	] as const)('%s curse with %i positive and %i negative traits is %j', (name, buffs, curses, expected) => {
		expect(rangeOf(name, buffs, curses, 'curse')).toEqual(expected);
	});

	test('Damage, whose base value the export rounds to 0.018333, is 0.1 below the wiki at its 3+0 extremes', () => {
		// The wiki uses 0.0183333 and shows 133.7 to 163.4 (and -133.7 to -163.4 for the curse)
		expect(rangeOf('Damage', 3, 0, 'buff')).toEqual([133.6, 163.3]);
		expect(rangeOf('Damage', 3, 1, 'curse')).toEqual([-133.6, -163.3]);
	});

	test('Punch Through is shown in metres with one decimal', () => {
		const punchThrough = stat(0.03, 'decimal');
		const range = (buffs: number, curses: number) => {
			const {min, max} = getDisplayRange(punchThrough, {rank: 8, layout: layoutOf(buffs, curses), kind: 'buff'});
			return [min, max];
		};

		expect(range(3, 1)).toEqual([2.7, 3.3]);
		expect(range(3, 0)).toEqual([2.2, 2.7]);
	});

	test('rank scales values linearly with (rank + 1)', () => {
		const layout = layoutOf(3, 0);
		expect(getDisplayRange(DAMAGE, {rank: 0, layout, kind: 'buff'}).max).toBe(18.1);
		expect(getDisplayRange(DAMAGE, {rank: 3, layout, kind: 'buff'}).max).toBe(72.6);
	});
});

describe('getDisplayRange: spliced traits at rank 8', () => {
	function splicedRange(baseValue: number, buffs: number, curses: number, reverseDisplay = false) {
		return getDisplayRange(stat(baseValue, 'percent', reverseDisplay), {
			rank: 8,
			layout: layoutOf(buffs, curses),
			kind: 'buff',
		});
	}

	test('Weak Point Damage spans 182.3% (3+0, lowest roll) to 367.5% (2+1, highest roll)', () => {
		expect(splicedRange(0.025, 3, 0).min).toBe(182.3);
		expect(splicedRange(0.025, 2, 1).max).toBe(367.5);
	});

	test('Ammo Efficiency has a negative base value but shows as a positive percentage', () => {
		expect(splicedRange(-0.005, 3, 0, true).min).toBe(36.5);
		expect(splicedRange(-0.005, 2, 1, true).max).toBe(73.5);
	});

	test('Weak Point Critical Chance spans 200.5% to 404.3%', () => {
		expect(splicedRange(0.0275, 3, 0).min).toBe(200.5);
		expect(splicedRange(0.0275, 2, 1).max).toBe(404.3);
	});
});

describe('toDisplayValue', () => {
	test('rounds percentages to one decimal', () => {
		expect(toDisplayValue(stat(1), 1.6706)).toBe(167.1);
	});

	test('shows a multiplier as a total, rounded to two decimals', () => {
		expect(toDisplayValue(stat(1, 'multiplier'), 0.4349)).toBe(1.43);
	});

	test('shows a negative multiplier trait as a total below 1', () => {
		expect(toDisplayValue(stat(1, 'multiplier'), -0.3)).toBe(0.7);
	});

	test('rounds plain quantities to one decimal', () => {
		expect(toDisplayValue(stat(1, 'decimal'), 3.649)).toBe(3.6);
	});

	test('flips the sign of stats with a reversed display', () => {
		expect(toDisplayValue(stat(-1, 'percent', true), -0.5)).toBe(50);
	});

	test('never returns negative zero', () => {
		expect(Object.is(toDisplayValue(stat(1), -0.000_01), 0)).toBe(true);
	});
});

describe('getDisplayStep', () => {
	test.each([
		['percent', 0.1],
		['decimal', 0.1],
		['multiplier', 0.01],
	] as const)('%s values step by %d', (displayKind, expected) => {
		expect(getDisplayStep(stat(1, displayKind))).toBe(expected);
	});
});

describe('fromDisplayValue', () => {
	test.each([
		['percent', false, 167.1, 1.671],
		['percent', true, 50, -0.5],
		['multiplier', false, 1.43, 0.43],
		['multiplier', false, 0.7, -0.3],
		['decimal', false, 3.6, 3.6],
	] as const)('%s (reversed: %s): %d becomes %d', (displayKind, reverseDisplay, displayValue, expected) => {
		expect(fromDisplayValue(stat(1, displayKind, reverseDisplay), displayValue)).toBeCloseTo(expected, 10);
	});
});

describe('getRollFromDisplayValue', () => {
	const trait: TraitContext = {rank: 8, layout: layoutOf(3, 1), kind: 'buff'};

	test('the lowest and highest displayed values are rolls 0 and 1', () => {
		expect(getRollFromDisplayValue(DAMAGE, trait, 167.1)).toBeCloseTo(0, 2);
		expect(getRollFromDisplayValue(DAMAGE, trait, 204.2)).toBeCloseTo(1, 2);
	});

	test('inverts computeValue for every roll', () => {
		for (const roll of [0, 0.25, 0.5, 0.8, 1]) {
			const displayed = toDisplayValue(DAMAGE, computeValue(DAMAGE, trait, roll));
			expect(getRollFromDisplayValue(DAMAGE, trait, displayed)).toBeCloseTo(roll, 1);
		}
	});

	test('works for curses, whose values are negative', () => {
		const curse: TraitContext = {rank: 8, layout: layoutOf(3, 1), kind: 'curse'};
		expect(getRollFromDisplayValue(DAMAGE, curse, -133.7)).toBeCloseTo(0, 2);
		expect(getRollFromDisplayValue(DAMAGE, curse, -163.4)).toBeCloseTo(1, 2);
	});

	test('works for stats with a reversed display', () => {
		const ammoEfficiency = stat(-0.005, 'percent', true);
		const spliced: TraitContext = {rank: 8, layout: layoutOf(3, 0), kind: 'buff'};
		expect(getRollFromDisplayValue(ammoEfficiency, spliced, 36.5)).toBeCloseTo(0, 1);
		expect(getRollFromDisplayValue(ammoEfficiency, spliced, 44.6)).toBeCloseTo(1, 1);
	});
});

describe('gradeRoll', () => {
	test.each([
		[1, 'S'],
		[0.975, 'S'],
		[0.9, 'A+'],
		[0.8, 'A'],
		[0.7, 'A-'],
		[0.6, 'B+'],
		[0.5, 'B'],
		[0.4, 'B-'],
		[0.3, 'C+'],
		[0.2, 'C'],
		[0.1, 'C-'],
		[0, 'F'],
		[0.03, 'C-'],
		[0.02, 'F'],
		[-0.1, 'X'],
		[1.1, 'X'],
	])('roll %d is graded %s', (roll, expected) => {
		expect(gradeRoll(roll)).toBe(expected);
	});
});

describe('gradeDisplayValue', () => {
	const layout = layoutOf(3, 1);

	test('a maximum roll on a positive trait is an S', () => {
		expect(gradeDisplayValue(DAMAGE, {rank: 8, layout, kind: 'buff'}, 204.2).grade).toBe('S');
	});

	test('a minimum roll on a positive trait is an F', () => {
		expect(gradeDisplayValue(DAMAGE, {rank: 8, layout, kind: 'buff'}, 167.1).grade).toBe('F');
	});

	test('a negative trait is graded by how weak it is: the lowest magnitude is an S', () => {
		expect(gradeDisplayValue(DAMAGE, {rank: 8, layout, kind: 'curse'}, -133.7).grade).toBe('S');
		expect(gradeDisplayValue(DAMAGE, {rank: 8, layout, kind: 'curse'}, -163.4).grade).toBe('F');
	});

	test('reports the roll as a 0.9x to 1.1x multiplier', () => {
		const {factor} = gradeDisplayValue(DAMAGE, {rank: 8, layout, kind: 'buff'}, 204.2);
		expect(factor).toBeCloseTo(1.1, 2);
	});

	test('a value no Riven can have is an X', () => {
		expect(gradeDisplayValue(DAMAGE, {rank: 8, layout, kind: 'buff'}, 400).grade).toBe('X');
	});
});
