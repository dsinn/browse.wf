/**
 Unit tests for src/riven-calc/state.ts: the URL hash format.
 */
import {describe, expect, test} from 'vitest';
import {
	ARCHGUN, MELEE, RIFLE, SHOTGUN,
} from './data.js';
import {createDefaultState, parseHash, serializeState} from './state.js';
import {type WeaponOption} from './weapons.js';

const braton: WeaponOption = {
	label: 'Braton', uniqueName: '/Braton', rivenClassKey: RIFLE, isVariant: false,
};
const skana: WeaponOption = {
	label: 'Skana Prime', uniqueName: '/SkanaPrime', rivenClassKey: MELEE, isVariant: true,
};
const weapons = [braton, skana];

describe('createDefaultState', () => {
	test('is a rank 8 rifle Riven with 3 positive and 1 negative trait', () => {
		expect(createDefaultState()).toEqual({
			rivenClassKey: RIFLE,
			rank: 8,
			layout: {buffs: 3, curses: 1},
		});
	});
});

describe('parseHash', () => {
	test('an empty hash gives the default state', () => {
		expect(parseHash('', weapons)).toEqual(createDefaultState());
		expect(parseHash('#', weapons)).toEqual(createDefaultState());
	});

	test('reads a weapon by name, which also decides the class', () => {
		const state = parseHash('#weapon=Skana+Prime&lvl=5&buffs=2&curses=0', weapons);
		expect(state).toEqual({
			rivenClassKey: MELEE,
			weapon: skana,
			rank: 5,
			layout: {buffs: 2, curses: 0},
		});
	});

	test('reads a bare Riven class', () => {
		expect(parseHash(`#weapon=${ARCHGUN}`, weapons).rivenClassKey).toBe(ARCHGUN);
	});

	test('accepts the original calculator\'s "class:disposition" form and ignores the disposition', () => {
		const state = parseHash(`#weapon=${SHOTGUN}%3A0.65&lvl=8&buffs=3&curses=1`, weapons);
		expect(state.rivenClassKey).toBe(SHOTGUN);
		expect(state.weapon).toBeUndefined();
	});

	test('ignores a weapon or class it does not know', () => {
		expect(parseHash('#weapon=Nonsense', weapons)).toEqual(createDefaultState());
	});

	test('clamps rank and trait counts to what a Riven can have', () => {
		const state = parseHash('#lvl=99&buffs=1&curses=4', weapons);
		expect(state.rank).toBe(8);
		expect(state.layout).toEqual({buffs: 2, curses: 1});
	});

	test('falls back to defaults for non-numeric values', () => {
		const state = parseHash('#lvl=abc&buffs=x&curses=y', weapons);
		expect(state.rank).toBe(8);
		expect(state.layout).toEqual({buffs: 3, curses: 1});
	});
});

describe('serializeState', () => {
	test('writes the class when no weapon is picked', () => {
		expect(serializeState(createDefaultState())).toBe(`weapon=${RIFLE}&lvl=8&buffs=3&curses=1`);
	});

	test('writes the weapon name when one is picked', () => {
		const state = {...createDefaultState(), weapon: skana, rivenClassKey: MELEE};
		expect(serializeState(state)).toBe('weapon=Skana+Prime&lvl=8&buffs=3&curses=1');
	});

	test('round-trips through parseHash', () => {
		const state = {
			rivenClassKey: MELEE,
			weapon: skana,
			rank: 3,
			layout: {buffs: 2, curses: 0},
		};
		expect(parseHash('#' + serializeState(state), weapons)).toEqual(state);
	});
});
