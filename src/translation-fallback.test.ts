import {describe, test, expect} from 'vitest';
import fallback from './translation-fallback-data.json';
import {getItemDataFallback} from './translation-fallback';

const MOONFLESH_KEY = '/Lotus/Types/Gameplay/Events/RoadToTauEvent/RoadToTauEventResource';

describe('translation-fallback', () => {
	test('resolves RoadToTauEventResource to Moonflesh item data', async () => {
		await expect(getItemDataFallback(MOONFLESH_KEY)).resolves.toEqual({name: 'Moonflesh'});
	});

	test('returns undefined for unknown items, so the normal request proceeds', () => {
		expect(getItemDataFallback('/Lotus/Unknown/Item')).toBeUndefined();
		expect(getItemDataFallback('toString')).toBeUndefined();
	});

	test('registers itself on window for live.ts', () => {
		expect((window as any).getItemDataFallback).toBe(getItemDataFallback);
	});

	test('only contains non-empty string translations keyed by unique name', () => {
		for (const [key, value] of Object.entries(fallback)) {
			expect(key).toMatch(/^\/Lotus\//u);
			expect(typeof value).toBe('string');
			expect(value.length).toBeGreaterThan(0);
		}
	});
});
