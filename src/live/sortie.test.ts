import {
	describe, test, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {appendSortieLocation} from './sortie';

describe('appendSortieLocation', () => {
	beforeEach(() => {
		(globalThis as any).dict = {
			'/Lotus/Language/Locations/Mercury': 'Mercury',
			'/Lotus/Language/Locations/SolarSystem': 'Inner Terminus',
		};
		(globalThis as any).addTooltip = vi.fn((elm: HTMLElement, title: string) => {
			elm.dataset.bsTitle = title;
		});
		(globalThis as any).formatTileset = vi.fn((tileset: string) => `${tileset} Formatted`);
	});

	afterEach(() => {
		delete (globalThis as any).dict;
		delete (globalThis as any).addTooltip;
		delete (globalThis as any).formatTileset;
	});

	function makeNode() {
		return {
			name: '/Lotus/Language/Locations/Mercury',
			systemName: '/Lotus/Language/Locations/SolarSystem',
		};
	}

	test('appends a <br> followed by an <abbr> to the td', () => {
		const td = document.createElement('td');
		appendSortieLocation(td, makeNode(), 'SomeTileset');
		expect(td.querySelector('br')).toBeTruthy();
		expect(td.querySelector('abbr')).toBeTruthy();
	});

	test('abbr text is "NodeName, SystemName"', () => {
		const td = document.createElement('td');
		appendSortieLocation(td, makeNode(), 'SomeTileset');
		expect(td.querySelector('abbr')!.textContent).toBe('Mercury, Inner Terminus');
	});

	test('tileset is passed to formatTileset and set as tooltip', () => {
		const td = document.createElement('td');
		appendSortieLocation(td, makeNode(), 'GrineerGalleonTileset');
		expect((globalThis as any).formatTileset).toHaveBeenCalledWith('GrineerGalleonTileset');
		expect(td.querySelector('abbr')!.dataset.bsTitle).toBe('GrineerGalleonTileset Formatted');
	});
});
