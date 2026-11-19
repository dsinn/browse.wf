import {describe, it, expect} from 'vitest';
import {getDiscriminator} from './discriminator';

const PLATFORM_IDS = [0, 1, 2, 3, 4, 5];

// Captured by running upstream's platform-suffix.pluto in the real PlutoScript runtime
const PLUTO_RESULTS: Array<[string, number[]]> = [
	['AerodynamicHead', [230, 116, 724, 514, 537, 638]],
	['TENNO', [841, 727, 335, 125, 148, 249]],
	['tenno', [841, 727, 335, 125, 148, 249]],
	['Émile', [907, 793, 401, 191, 214, 315]],
	['ÉMILE', [907, 793, 401, 191, 214, 315]],
	['Ünïcödé', [840, 726, 334, 124, 147, 248]],
	['日本語', [190, 76, 684, 474, 497, 598]],
	['😀x', [996, 882, 490, 280, 303, 404]],
];

describe('getDiscriminator', () => {
	it.each(PLUTO_RESULTS)('matches the Pluto original for %s on every platform', (name, expected) => {
		expect(PLATFORM_IDS.map(platformId => getDiscriminator(name, platformId))).toEqual(expected);
	});

	it('only lowercases ASCII letters, like Lua (so É is not folded to é)', () => {
		expect(getDiscriminator('ÉMILE', 0)).toBe(getDiscriminator('Émile', 0));
		expect(getDiscriminator('Émile', 0)).not.toBe(getDiscriminator('émile', 0));
	});

	it.each([6, 7, -1, NaN, 1.5])('returns undefined for the unknown platform id %s', platformId => {
		expect(getDiscriminator('Tenno', platformId)).toBeUndefined();
	});

	it('is exposed on window for the non-module profile script', () => {
		expect(window.getDiscriminator).toBe(getDiscriminator);
	});
});
