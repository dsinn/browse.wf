import {
	describe, test, expect, beforeEach,
} from 'vitest';
import {FACTION_ICON_PATHS, getFactionIconPath} from '../src/faction-icons';
import {loadExportJson} from './helpers/api-mocks';
import {loadCommonJsFunctions} from './helpers/dom-helpers';

const ExportImages = loadExportJson('ExportImages.json');

beforeEach(() => {
	(globalThis as any).ExportImages = ExportImages;
	loadCommonJsFunctions(['setImageSource']);
});

describe('FACTION_ICON_PATHS', () => {
	test('every path resolves to content.warframe.com via setImageSource', () => {
		for (const [faction, path] of Object.entries(FACTION_ICON_PATHS)) {
			const img = document.createElement('img');
			(globalThis as any).setImageSource(img, path);
			expect(img.src, faction).not.toContain('browse.wf');
		}
	});
});

describe('getFactionIconPath', () => {
	test('returns a non-empty path for all known faction aliases', () => {
		expect(getFactionIconPath('Corpus')).toBeTruthy();
		expect(getFactionIconPath('Duviri')).toBeTruthy();
		expect(getFactionIconPath('Grineer')).toBeTruthy();
		expect(getFactionIconPath('Infested')).toBeTruthy();
		expect(getFactionIconPath('Infestation')).toBeTruthy();
		expect(getFactionIconPath('MITW')).toBeTruthy();
		expect(getFactionIconPath('Narmer')).toBeTruthy();
		expect(getFactionIconPath('NarmerVeil')).toBeTruthy();
		expect(getFactionIconPath('Orokin')).toBeTruthy();
		expect(getFactionIconPath('Orokin Empire')).toBeTruthy();
		expect(getFactionIconPath('OrokinEmpire')).toBeTruthy();
		expect(getFactionIconPath('Scaldra')).toBeTruthy();
		expect(getFactionIconPath('Sentient')).toBeTruthy();
		expect(getFactionIconPath('Techrot')).toBeTruthy();
	});

	test('returns undefined for an unrecognised faction string', () => {
		expect(getFactionIconPath('Unknown')).toBeUndefined();
		expect(getFactionIconPath('')).toBeUndefined();
	});
});
