import {describe, it, expect} from 'vitest';
import {lastPathSegment, normalizeStoreItemPath} from './path-helpers';

describe('lastPathSegment', () => {
	it('returns the last segment of an internal path', () => {
		expect(lastPathSegment('/Lotus/Types/Friendly/Pets/BeastWeapons/VascaPetWeapon')).toBe('VascaPetWeapon');
	});

	it('returns a name without slashes unchanged', () => {
		expect(lastPathSegment('SolNode35')).toBe('SolNode35');
	});

	it('returns the whole path when it ends in a slash', () => {
		expect(lastPathSegment('/Lotus/Odd/')).toBe('/Lotus/Odd/');
	});
});

describe('normalizeStoreItemPath', () => {
	it('rewrites the StoreItems prefix to the item type path', () => {
		expect(normalizeStoreItemPath('/Lotus/StoreItems/Types/Items/MiscItems/Kuva')).toBe('/Lotus/Types/Items/MiscItems/Kuva');
	});

	it('leaves other paths unchanged', () => {
		expect(normalizeStoreItemPath('/Lotus/Types/Items/MiscItems/Kuva')).toBe('/Lotus/Types/Items/MiscItems/Kuva');
	});
});
