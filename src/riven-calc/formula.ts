/**
 Riven stat maths, as documented on the Warframe Wiki's "Riven Mods" page:

 v = b × 10 × (rank + 1) × D × L × W

 b  the stat's base coefficient (signed)
 D  the disposition multiplier; dispositions were retired in Hotfix 44.1.3, so it is always 1.2
 L  the multiplier for the Riven's trait layout (positive/negative trait counts)
 W  the stat's random roll, 0.9 to 1.1

 Everything here is pure so that it can be unit-tested without a DOM.
 */

export const DISPOSITION = 1.2;
export const MAX_RANK = 8;

export const MIN_ROLL_FACTOR = 0.9;
export const MAX_ROLL_FACTOR = 1.1;

export type TraitKind = 'buff' | 'curse';

export type Layout = {
	/**
	Number of positive traits: 2 or 3.
	*/
	buffs: number;
	/**
	Number of negative traits: 0 or 1.
	*/
	curses: number;
};

export type DisplayKind = 'percent' | 'multiplier' | 'decimal';

/**
Which trait of which Riven a value is for.
*/
export type TraitContext = {
	rank: number;
	layout: Layout;
	kind: TraitKind;
};

/**
The parts of a stat definition that the maths needs.
*/
export type StatMaths = {
	baseValue: number;
	displayKind: DisplayKind;
	/**
	True when the in-game number is the negation of the underlying value (e.g. Ammo Efficiency).
	*/
	reverseDisplay: boolean;
};

export const MIN_BUFFS = 2;
export const MAX_BUFFS = 3;
export const MAX_CURSES = 1;

/**
L for each trait layout. A layout with no negative trait has no curse multiplier.
*/
const LAYOUT_MULTIPLIERS: Record<string, {buff: number; curse: number}> = {
	'2/0': {buff: 0.99, curse: 0},
	'2/1': {buff: 1.2375, curse: -0.495},
	'3/0': {buff: 0.75, curse: 0},
	'3/1': {buff: 0.9375, curse: -0.75},
};

/**
Clamps arbitrary trait counts to a layout that a Riven can actually have.
*/
export function normalizeLayout(buffs: number, curses: number): Layout {
	return {
		buffs: Number.isFinite(buffs) ? Math.min(Math.max(Math.trunc(buffs), MIN_BUFFS), MAX_BUFFS) : MAX_BUFFS,
		curses: Number.isFinite(curses) ? Math.min(Math.max(Math.trunc(curses), 0), MAX_CURSES) : MAX_CURSES,
	};
}

export function clampRank(rank: number): number {
	return Number.isFinite(rank) ? Math.min(Math.max(Math.trunc(rank), 0), MAX_RANK) : MAX_RANK;
}

/**
L for the given layout; curse multipliers are negative, so they flip the sign of a positive base value.
*/
export function getLayoutMultiplier(layout: Layout, kind: TraitKind): number {
	return LAYOUT_MULTIPLIERS[`${layout.buffs}/${layout.curses}`][kind];
}

/**
The stat's value (as the game stores it, before display rounding) for a roll between 0 (worst) and 1 (best).
*/
export function computeValue(stat: StatMaths, trait: TraitContext, roll: number): number {
	return stat.baseValue * 10 * (trait.rank + 1) * DISPOSITION * getLayoutMultiplier(trait.layout, trait.kind)
		* rollToFactor(roll);
}

/**
 Rounds a value to the number shown in game, flipping the sign for stats whose display is reversed. A multiplier is
 shown as a total, so a bonus of 0.45 reads x1.45 and a penalty of 0.3 reads x0.7.
 */
export function toDisplayValue(stat: StatMaths, value: number): number {
	const signed = stat.reverseDisplay ? -value : value;
	let rounded = 0;
	switch (stat.displayKind) {
		case 'multiplier': {
			rounded = Math.round((1 + signed) * 100) / 100;
			break;
		}

		case 'decimal': {
			rounded = Math.round(signed * 10) / 10;
			break;
		}

		case 'percent': {
			rounded = Math.round(signed * 1000) / 10;
			break;
		}
	}

	// Avoid displaying "-0"
	return rounded === 0 ? 0 : rounded;
}

/**
The smallest difference between two displayed values: the precision {@link toDisplayValue} rounds to.
*/
export function getDisplayStep(stat: StatMaths): number {
	return stat.displayKind === 'multiplier' ? 0.01 : 0.1;
}

/**
Inverse of {@link toDisplayValue} (ignoring rounding).
*/
export function fromDisplayValue(stat: StatMaths, displayValue: number): number {
	let unscaled = displayValue;
	if (stat.displayKind === 'percent') {
		unscaled = displayValue / 100;
	} else if (stat.displayKind === 'multiplier') {
		unscaled = displayValue - 1;
	}

	return stat.reverseDisplay ? -unscaled : unscaled;
}

/**
The displayed lowest and highest values of a stat (roll 0 and roll 1).
*/
export function getDisplayRange(stat: StatMaths, trait: TraitContext): {min: number; max: number} {
	return {
		min: toDisplayValue(stat, computeValue(stat, trait, 0)),
		max: toDisplayValue(stat, computeValue(stat, trait, 1)),
	};
}

/**
The roll (0 to 1, though out-of-range input gives values outside it) that produces the displayed value.
*/
export function getRollFromDisplayValue(stat: StatMaths, trait: TraitContext, displayValue: number): number {
	const atRollZero = computeValue(stat, trait, 0);
	const atRollOne = computeValue(stat, trait, 1);
	return (fromDisplayValue(stat, displayValue) - atRollZero) / (atRollOne - atRollZero);
}

/**
The roll as a 0.9 to 1.1 multiplier, as shown to the user.
*/
export function rollToFactor(roll: number): number {
	return MIN_ROLL_FACTOR + ((MAX_ROLL_FACTOR - MIN_ROLL_FACTOR) * roll);
}

/**
The lowest score (see {@link gradeRoll}) that earns each grade, best first. Below the last one is an "F".
*/
const GRADE_THRESHOLDS: ReadonlyArray<readonly [number, string]> = [
	[9.5, 'S'],
	[7.5, 'A+'],
	[5.5, 'A'],
	[3.5, 'A-'],
	[1.5, 'B+'],
	[-1.5, 'B'],
	[-3.5, 'B-'],
	[-5.5, 'C+'],
	[-7.5, 'C'],
	[-9.5, 'C-'],
];

/**
Letter grade for a roll where 1 is the best possible. Anything outside the possible rolls is "X".
*/
export function gradeRoll(roll: number): string {
	const score = -10 + (20 * roll);
	if (Math.abs(score) > 11.5) {
		return 'X';
	}

	for (const [threshold, grade] of GRADE_THRESHOLDS) {
		if (score >= threshold) {
			return grade;
		}
	}

	return 'F';
}

/**
Grades a displayed value. A negative trait is better the weaker it is, so its roll is inverted.
*/
export function gradeDisplayValue(
	stat: StatMaths,
	trait: TraitContext,
	displayValue: number,
): {roll: number; factor: number; grade: string} {
	const roll = getRollFromDisplayValue(stat, trait, displayValue);
	return {
		roll,
		factor: rollToFactor(roll),
		grade: gradeRoll(trait.kind === 'curse' ? 1 - roll : roll),
	};
}
