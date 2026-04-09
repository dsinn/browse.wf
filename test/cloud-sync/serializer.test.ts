/**
 * Tests for CloudSyncSerializer
 * Pure data transforms between localStorage and nested objects
 */
import {
	describe, test, expect, beforeEach, afterEach,
} from 'vitest';
import {
	localStorageToData, dataToLocalStorage, setNestedValue, flattenObject,
} from '../../src/cloud-sync/serializer';

describe('CloudSyncSerializer', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	describe('localStorageToData', () => {
		test('should convert localStorage to nested object', () => {
			localStorage.setItem('lang', 'fr');
			localStorage.setItem('live.notif.alert1', 'true');
			localStorage.setItem('live.notif.alert2', 'true');
			localStorage.setItem('live.collapse.section1', 'true');
			localStorage.setItem('oids_completed', '["obj1","obj2"]');

			const data = localStorageToData();

			expect(data).toEqual({
				lang: 'fr',
				live: {
					notif: {
						alert1: 'true',
						alert2: 'true',
					},
					collapse: {
						section1: 'true',
					},
				},
				oids_completed: '["obj1","obj2"]',
			});
		});

		test('should return empty object for empty localStorage', () => {
			expect(localStorageToData()).toEqual({});
		});

		test('should exclude auth token from sync (security)', () => {
			localStorage.setItem('lang', 'en');
			localStorage.setItem('sb-test-project-auth-token', 'sensitive-value');
			localStorage.setItem('live.collapse.news', '1');

			const data = localStorageToData();

			expect(data.lang).toBe('en');
			expect(data.live.collapse.news).toBe('1');
			expect(data.sb).toBeUndefined();
			expect(data['sb-test-project-auth-token']).toBeUndefined();
			// Auth token still in localStorage (not removed)
			expect(localStorage.getItem('sb-test-project-auth-token')).toBe('sensitive-value');
		});

		test('should exclude profile.data* keys from sync', () => {
			localStorage.setItem('lang', 'en');
			localStorage.setItem('profile.platform', 'pc');
			localStorage.setItem('profile.accountId', 'SomeName');
			localStorage.setItem('profile.data', '{"items":[]}');
			localStorage.setItem('profile.dataFetchedAt', '1234567890');
			localStorage.setItem('profile.nextFetchAvailableAt', '9999999999');

			const data = localStorageToData();

			expect(data.lang).toBe('en');
			expect(data.profile.platform).toBe('pc');
			expect(data.profile.accountId).toBe('SomeName');
			expect(data.profile.nextFetchAvailableAt).toBe('9999999999');
			expect(data.profile.data).toBeUndefined();
			expect(data.profile.dataFetchedAt).toBeUndefined();
		});
	});

	describe('dataToLocalStorage', () => {
		test('should convert nested object to localStorage', () => {
			dataToLocalStorage({
				lang: 'fr',
				live: {
					notif: {alert1: 'true'},
					collapse: {section1: 'true'},
				},
				oids_completed: '["obj1","obj2"]',
			});

			expect(localStorage.getItem('lang')).toBe('fr');
			expect(localStorage.getItem('live.notif.alert1')).toBe('true');
			expect(localStorage.getItem('live.collapse.section1')).toBe('true');
			expect(localStorage.getItem('oids_completed')).toBe('["obj1","obj2"]');
		});

		test('should clear existing localStorage keys not in data', () => {
			localStorage.setItem('live.notif.alert1', 'true');

			dataToLocalStorage({lang: 'en'});

			expect(localStorage.getItem('lang')).toBe('en');
			expect(localStorage.getItem('live.notif.alert1')).toBeNull();
		});

		test('should preserve auth token when writing data', () => {
			localStorage.setItem('sb-test-project-auth-token', 'sensitive-value');
			localStorage.setItem('live.notif.alert1', 'true');

			dataToLocalStorage({lang: 'en'});

			expect(localStorage.getItem('lang')).toBe('en');
			expect(localStorage.getItem('live.notif.alert1')).toBeNull();
			expect(localStorage.getItem('sb-test-project-auth-token')).toBe('sensitive-value');
		});
	});

	describe('setNestedValue', () => {
		test('sets a top-level key', () => {
			const object: Record<string, any> = {};
			setNestedValue(object, 'lang', 'en');
			expect(object).toEqual({lang: 'en'});
		});

		test('sets a deeply nested key', () => {
			const object: Record<string, any> = {};
			setNestedValue(object, 'live.filter.news.danger', '0');
			expect(object).toEqual({live: {filter: {news: {danger: '0'}}}});
		});

		test('merges into existing nested structure', () => {
			const object: Record<string, any> = {live: {collapse: {news: '1'}}};
			setNestedValue(object, 'live.filter.news.danger', '0');
			expect(object.live.collapse.news).toBe('1');
			expect(object.live.filter.news.danger).toBe('0');
		});
	});

	describe('flattenObject', () => {
		test('flattens nested object to dot-separated keys', () => {
			const object = {live: {collapse: {news: '1'}}};
			expect(flattenObject(object)).toEqual({'live.collapse.news': '1'});
		});

		test('handles top-level keys', () => {
			expect(flattenObject({lang: 'en'})).toEqual({lang: 'en'});
		});

		test('does not flatten arrays', () => {
			const object = {oids_completed: ['a', 'b']};
			expect(flattenObject(object)).toEqual({oids_completed: ['a', 'b']});
		});

		test('handles prefix parameter', () => {
			expect(flattenObject({news: '1'}, 'live.collapse')).toEqual({'live.collapse.news': '1'});
		});
	});

	describe('Round Trip', () => {
		test('collapse state round-trips correctly', () => {
			localStorage.setItem('live.collapse.news', '1');

			const serialized = localStorageToData();
			expect(serialized.live.collapse.news).toBe('1');

			localStorage.clear();
			dataToLocalStorage(serialized);

			expect(localStorage.getItem('live.collapse.news')).toBe('1');
		});

		test('expanding card (removing key) round-trips correctly', () => {
			localStorage.clear();

			const serialized = localStorageToData();
			expect(serialized.live?.collapse?.news).toBeUndefined();

			localStorage.setItem('live.collapse.news', '1');
			dataToLocalStorage(serialized);

			expect(localStorage.getItem('live.collapse.news')).toBeNull();
		});

		test('filter states round-trip correctly', () => {
			localStorage.setItem('live.filter.news.danger', '0');
			localStorage.setItem('live.filter.bounties.ZarimanSyndicate.minTier', '3');
			localStorage.setItem('live.filter.bounties.HexSyndicate.minTier', '-1');

			const serialized = localStorageToData();
			localStorage.clear();
			dataToLocalStorage(serialized);

			expect(localStorage.getItem('live.filter.news.danger')).toBe('0');
			expect(localStorage.getItem('live.filter.bounties.ZarimanSyndicate.minTier')).toBe('3');
			expect(localStorage.getItem('live.filter.bounties.HexSyndicate.minTier')).toBe('-1');
		});
	});
});
