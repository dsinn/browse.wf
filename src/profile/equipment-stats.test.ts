import {
	describe, it, expect, beforeEach,
} from 'vitest';
import {mockBootstrapTooltip, loadCommonJsFunctions} from '@test/helpers/dom-helpers';
import {loadExportJson} from '@test/helpers/api-mocks';
import {exportCache} from '../public-export-fetcher';
import {augmentEquipmentStats} from './equipment-stats';

const ExportImages = loadExportJson('ExportImages.json');

const mockExportWarframes: Record<string, any> = {
	'/Lotus/Powersuits/Excalibur/Excalibur': {name: '/Lotus/Language/Items/ExcaliburName', productCategory: 'Suits'},
};
const mockExportWeapons: Record<string, any> = {
	'/Lotus/Weapons/Tenno/LongGuns/Braton/Braton': {name: '/Lotus/Language/Items/BratonName', productCategory: 'LongGuns'},
	'/Lotus/Weapons/Tenno/Melee/Skana/Skana': {name: '/Lotus/Language/Items/SkanaName', productCategory: 'Melee'},
};
const mockExportSentinels: Record<string, any> = {};

const mockProfile = {
	Stats: {
		Weapons: [
			{
				type: '/Lotus/Weapons/Tenno/LongGuns/Braton/Braton', equipTime: 7200, kills: 500, headshots: 100, assists: 20, xp: 30_000,
			},
			{
				type: '/Lotus/Powersuits/Excalibur/Excalibur', equipTime: 3600, kills: 200, headshots: 0, assists: 10, xp: 50_000,
			},
			{
				type: '/Lotus/Weapons/Tenno/Melee/Skana/Skana', equipTime: 1800, kills: 100, headshots: 0, assists: 5, xp: 10_000,
			},
		],
	},
};

// Simulate the upstream-rendered tbody: one row per weapon in array order,
// no rank cell, no data-category. Upstream renders: name | hours | kills | headshots | assists | xp
function setupDOM(weapons: Array<{type: string; equipTime?: number; kills: number; headshots: number; assists: number; xp: number}> = mockProfile.Stats.Weapons) {
	const rows = weapons.map(w =>
		`<tr><td>Name</td><td>${((w.equipTime ?? 0) / 3600).toFixed(1)}</td><td>${w.kills ?? 0}</td><td>${w.headshots ?? 0}</td><td>${w.assists ?? 0}</td><td>${w.xp ?? 0}</td></tr>`).join('');
	document.body.innerHTML = `
		<div id="equipment-filter-bar"></div>
		<table><tbody id="equipment-stats">${rows}</tbody></table>
	`;
}

describe('augmentEquipmentStats', () => {
	beforeEach(() => {
		mockBootstrapTooltip();
		(globalThis as any).ExportImages = ExportImages;
		exportCache.set('ExportWarframes', Promise.resolve(mockExportWarframes));
		exportCache.set('ExportWeapons', Promise.resolve(mockExportWeapons));
		exportCache.set('ExportSentinels', Promise.resolve(mockExportSentinels));
		loadCommonJsFunctions(['setImageSource', 'addTooltip']);
	});

	it('prepends a rank cell to each row', async () => {
		setupDOM();
		await augmentEquipmentStats(mockProfile);
		const rows = document.querySelectorAll<HTMLTableRowElement>('#equipment-stats tr');
		expect(rows[0].cells).toHaveLength(8); // 6 upstream + rank + Used%
	});

	it('assigns sequential ranks starting at 1', async () => {
		setupDOM();
		await augmentEquipmentStats(mockProfile);
		const rows = document.querySelectorAll<HTMLTableRowElement>('#equipment-stats tr');
		for (const [i, tr] of rows.entries()) {
			expect(tr.cells[0].textContent).toBe(String(i + 1));
		}
	});

	it('assigns data-category from productCategory', async () => {
		setupDOM();
		await augmentEquipmentStats(mockProfile);
		const rows = document.querySelectorAll<HTMLTableRowElement>('#equipment-stats tr');
		// Sorted by equipTime: Braton=LongGuns, Excalibur=Suits, Skana=Melee
		expect(rows[0].dataset.category).toBe('LongGuns');
		expect(rows[1].dataset.category).toBe('Suits');
		expect(rows[2].dataset.category).toBe('Melee');
	});

	it('inserts a Used% cell after the rank cell', async () => {
		setupDOM();
		await augmentEquipmentStats(mockProfile);
		// Cells after augment: [rank, name, used%, hours, kills, headshots, assists, xp]
		const bratonRow = document.querySelectorAll<HTMLTableRowElement>('#equipment-stats tr')[0];
		expect(bratonRow.cells[2].textContent).toMatch(/^\d+\.\d{2}%$/u);
	});

	it('"Used" is 100% when a category has only one item', async () => {
		setupDOM();
		await augmentEquipmentStats(mockProfile);
		// LongGuns has only Braton — should be 100%
		const bratonRow = document.querySelectorAll<HTMLTableRowElement>('#equipment-stats tr')[0];
		expect(bratonRow.cells[2].textContent).toBe('100.00%');
	});

	it('reformats the hours cell to locale string with 1 decimal', async () => {
		setupDOM();
		await augmentEquipmentStats(mockProfile);
		// Braton: 7200s / 3600 = 2.0h
		const bratonRow = document.querySelectorAll<HTMLTableRowElement>('#equipment-stats tr')[0];
		expect(bratonRow.cells[3].textContent).toBe((2).toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1}));
	});

	it('initialises a filter bar with an "All" button', async () => {
		setupDOM();
		await augmentEquipmentStats(mockProfile);
		expect(document.querySelector('#equipment-filter-bar button[data-filter=""]')).not.toBeNull();
	});

	it('applies category in the same order as upstream, including items with no equipTime', async () => {
		// Item with undefined equipTime sorts differently under b.equipTime - a.equipTime (NaN)
		// vs (b.equipTime ?? 0) - (a.equipTime ?? 0). The augmenter must not re-sort independently.
		const weapons = [
			{
				type: '/Lotus/Weapons/Tenno/LongGuns/Braton/Braton', equipTime: 7200, kills: 0, headshots: 0, assists: 0, xp: 0,
			},
			{
				type: '/Lotus/Weapons/Tenno/Melee/Skana/Skana', equipTime: undefined, kills: 0, headshots: 0, assists: 0, xp: 0,
			},
			{
				type: '/Lotus/Powersuits/Excalibur/Excalibur', equipTime: 3600, kills: 0, headshots: 0, assists: 0, xp: 0,
			},
		];
		setupDOM(weapons);

		await augmentEquipmentStats({Stats: {Weapons: weapons}});

		const rows = document.querySelectorAll<HTMLTableRowElement>('#equipment-stats tr');
		let rowIndex = 0;
		for (const item of weapons) {
			const type = mockExportWarframes[item.type]
				?? mockExportWeapons[item.type]
				?? mockExportSentinels[item.type];
			if (!type) {
				continue;
			}

			expect(rows[rowIndex++].dataset.category).toBe(type.productCategory ?? 'SpecialItems');
		}
	});

	it('does nothing when tbody is empty', async () => {
		document.body.innerHTML = `
			<div id="equipment-filter-bar"></div>
			<table><tbody id="equipment-stats"></tbody></table>
		`;
		await augmentEquipmentStats(mockProfile);
		expect(document.querySelector('#equipment-filter-bar button')).toBeNull();
	});
});
