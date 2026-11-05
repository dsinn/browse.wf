import {describe, test, expect} from 'vitest';
import fallback from './translation-fallback-data.json';
import {getItemDataFallback, withTranslationFallback} from './translation-fallback';

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

	describe('withTranslationFallback', () => {
		test('adds Hallowed Nightmares and Epoch Operation: Taubound when the dict lacks them', () => {
			const result = withTranslationFallback({});
			expect(result['/Lotus/Language/G1Quests/TacAlertHalloweenTitle']).toBe('Hallowed Nightmares');
			expect(result['/Lotus/Language/TauPrologue/RoadToTauEventName']).toBe('Epoch Operation: Taubound');
		});

		test('preserves unrelated entries', () => {
			expect(withTranslationFallback({'/Lotus/Foo': 'Foo'})['/Lotus/Foo']).toBe('Foo');
		});

		test('entries already in the dict take precedence over the fallback', () => {
			const key = '/Lotus/Language/TauPrologue/RoadToTauEventName';
			expect(withTranslationFallback({[key]: 'Upstream Name'})[key]).toBe('Upstream Name');
		});

		test('does not mutate the input dict or the fallback data', () => {
			const dict: Record<string, string> = {};
			const before = {...fallback};
			withTranslationFallback(dict);
			expect(dict).toEqual({});
			expect(fallback).toEqual(before);
		});

		test('registers itself on window for common.js', () => {
			expect((window as any).withTranslationFallback).toBe(withTranslationFallback);
		});

		test.todo('also merge into getDictPromise() so direct dict[key] lookups find the fallback entries');
	});

	test('only contains non-empty string translations keyed by internal string', () => {
		for (const [key, value] of Object.entries(fallback)) {
			expect(key).toMatch(/^\/Lotus\//u);
			expect(typeof value).toBe('string');
			expect(value.length).toBeGreaterThan(0);
		}
	});
});
