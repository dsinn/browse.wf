import {describe, test, expect} from 'vitest';
import {formatAlertRewards} from './alerts';

describe('formatAlertRewards', () => {
	test('credits-only reward has no delimiter', () => {
		expect(formatAlertRewards([], 15_000)).toBe('15,000 Credits');
	});

	test('puts credits after a single reward', () => {
		expect(formatAlertRewards(['Rifle Riven Mod'], 10_000)).toBe('Rifle Riven Mod, 10,000 Credits');
	});

	test('keeps reward order and puts credits last with several rewards', () => {
		expect(formatAlertRewards(['Forma Blueprint', '50X Moonflesh', 'Orokin Catalyst'], 17_000))
			.toBe('Forma Blueprint, 50X Moonflesh, Orokin Catalyst, 17,000 Credits');
	});

	test('does not mutate the input list', () => {
		const names = ['50X Moonflesh'];
		formatAlertRewards(names, 17_000);
		expect(names).toEqual(['50X Moonflesh']);
	});

	test('formats zero credits', () => {
		expect(formatAlertRewards(['50X Moonflesh'], 0)).toBe('50X Moonflesh, 0 Credits');
	});

	test('registers itself on window for live.ts', () => {
		expect((window as any).formatAlertRewards).toBe(formatAlertRewards);
	});
});
