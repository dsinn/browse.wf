import {
	describe,
	it,
	expect,
	beforeEach,
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
const mockExportSentinels: Record<string, any> = {
	'/Lotus/Types/Sentinels/Deth/Dethcube': {name: '/Lotus/Language/Sentinels/DethcubeName', productCategory: 'Sentinels'},
	'/Lotus/Types/Game/KubrowPet/KubrowPetPowerSuit': {name: '/Lotus/Language/Pets/KubrowName', productCategory: 'KubrowPets'},
	'/Lotus/Types/Game/MoaPets/MoaPetPowerSuit': {name: '/Lotus/Language/Pets/MoaName', productCategory: 'MoaPets'},
};

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
// no rank cell, no data-category. Upstream renders: name | hours | kills | assists | headshots | xp
function setupDOM(weapons: Array<{type: string; equipTime?: number; kills: number; headshots: number; assists: number; xp: number}> = mockProfile.Stats.Weapons) {
	const rows = weapons.map(w =>
		`<tr><td>Name</td><td>${((w.equipTime ?? 0) / 3600).toFixed(1)}</td><td>${w.kills ?? 0}</td><td>${w.assists ?? 0}</td><td>${w.headshots ?? 0}</td><td>${w.xp ?? 0}</td></tr>`).join('');
	document.body.innerHTML = `
		<div id="equipment-unnamed-toggle"></div>
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
		expect(rows[0].cells).toHaveLength(10); // 6 upstream + rank + Used% + Fired + Hit%
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
		// Cells after augment: [rank, name, used%, hours, kills, assists, headshots, fired, hit%, xp]
		const bratonRow = document.querySelector<HTMLTableRowElement>('#equipment-stats tr');
		expect(bratonRow?.cells[2].textContent).toMatch(/^\d+\.\d{2}%$/u);
	});

	it('"Used" is 100% when a category has only one item', async () => {
		setupDOM();
		await augmentEquipmentStats(mockProfile);
		// LongGuns has only Braton — should be 100%
		const bratonRow = document.querySelector<HTMLTableRowElement>('#equipment-stats tr');
		expect(bratonRow?.cells[2].textContent).toBe('100.00%');
	});

	it('reformats the hours cell to locale string with 1 decimal', async () => {
		setupDOM();
		await augmentEquipmentStats(mockProfile);
		// Braton: 7200s / 3600 = 2.0h
		const bratonRow = document.querySelector<HTMLTableRowElement>('#equipment-stats tr');
		expect(bratonRow?.cells[3].textContent).toBe((2).toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1}));
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

	describe('Fired and Hit%', () => {
		const shooter = {
			type: '/Lotus/Weapons/Tenno/LongGuns/Braton/Braton', equipTime: 7200, kills: 0, headshots: 0, assists: 0, xp: 0,
		};

		it('shows shots fired and the hit rate, with the raw counts as a tooltip', async () => {
			const weapons = [{...shooter, fired: 1000, hits: 250}];
			setupDOM(weapons);
			await augmentEquipmentStats({Stats: {Weapons: weapons}});

			const row = document.querySelector<HTMLTableRowElement>('#equipment-stats tr');
			expect(row?.cells[7].textContent).toBe((1000).toLocaleString());
			expect(row?.cells[8].textContent).toBe('25.0%');
			expect(row?.cells[8].title).toBe(`${(250).toLocaleString()} hits / ${(1000).toLocaleString()} fired`);
		});

		it('shows 0.0% when hits were recorded as 0', async () => {
			const weapons = [{...shooter, fired: 40, hits: 0}];
			setupDOM(weapons);
			await augmentEquipmentStats({Stats: {Weapons: weapons}});

			expect(document.querySelector<HTMLTableRowElement>('#equipment-stats tr')?.cells[8].textContent).toBe('0.0%');
		});

		it('leaves Hit% blank, but still shows shots fired, when no hits were recorded at all', async () => {
			const weapons = [{...shooter, fired: 40}];
			setupDOM(weapons);
			await augmentEquipmentStats({Stats: {Weapons: weapons}});

			const row = document.querySelector<HTMLTableRowElement>('#equipment-stats tr');
			expect(row?.cells[7].textContent).toBe((40).toLocaleString());
			expect(row?.cells[8].textContent).toBe('—');
		});

		it('gives each cell a numeric sort value, with blanks below every real value so they sort last when descending', async () => {
			const weapons = [
				{...shooter, fired: 40, hits: 10},
				{...shooter, fired: 40},
				{...shooter, hits: 12},
			];
			setupDOM(weapons);
			await augmentEquipmentStats({Stats: {Weapons: weapons}});

			const rows = [...document.querySelectorAll<HTMLTableRowElement>('#equipment-stats tr')];
			expect(rows.map(row => row.cells[7].dataset.sort)).toEqual(['40', '40', '-1']);
			expect(rows.map(row => row.cells[8].dataset.sort)).toEqual(['25', '-1', '-1']);
		});

		it('leaves both cells blank when no shots were recorded, even if hits were', async () => {
			const weapons = [{...shooter, hits: 12}];
			setupDOM(weapons);
			await augmentEquipmentStats({Stats: {Weapons: weapons}});

			const row = document.querySelector<HTMLTableRowElement>('#equipment-stats tr');
			expect(row?.cells[7].textContent).toBe('—');
			expect(row?.cells[8].textContent).toBe('—');
		});
	});

	describe('items without an export entry', () => {
		const unnamedType = '/Lotus/Types/Friendly/Pets/BeastWeapons/VascaPetWeapon';
		const weaponsWithUnnamed = [
			{
				type: unnamedType, equipTime: 9000, kills: 5, headshots: 0, assists: 0, xp: 0,
			},
			...mockProfile.Stats.Weapons,
		];

		it('keeps one augmented row per item, in order', async () => {
			setupDOM(weaponsWithUnnamed);
			await augmentEquipmentStats({Stats: {Weapons: weaponsWithUnnamed}});

			const rows = [...document.querySelectorAll<HTMLTableRowElement>('#equipment-stats tr')];
			expect(rows.map(row => row.dataset.category)).toEqual(['Unnamed', 'LongGuns', 'Suits', 'Melee']);
		});

		it('shows the last segment of the internal name in teletype, with the full path as a tooltip', async () => {
			setupDOM(weaponsWithUnnamed);
			await augmentEquipmentStats({Stats: {Weapons: weaponsWithUnnamed}});

			const code = document.querySelector<HTMLElement>('#equipment-stats tr code.internal-name');
			expect(code?.textContent).toBe('VascaPetWeapon');
			expect(code?.dataset.bsTitle).toBe(unnamedType);
		});

		it('leaves Used% blank and excludes the item from category totals', async () => {
			setupDOM(weaponsWithUnnamed);
			await augmentEquipmentStats({Stats: {Weapons: weaponsWithUnnamed}});

			const rows = document.querySelectorAll<HTMLTableRowElement>('#equipment-stats tr');
			expect(rows[0].cells[2].textContent).toBe('—');
			expect(rows[1].cells[2].textContent).toBe('100.00%'); // Braton is still the only LongGuns item
		});

		it('adds a checkbox, off by default, for showing unnamed items in the All view', async () => {
			setupDOM(weaponsWithUnnamed);
			await augmentEquipmentStats({Stats: {Weapons: weaponsWithUnnamed}});

			const checkbox = document.querySelector<HTMLInputElement>('#equipment-unnamed-toggle input[type="checkbox"]');
			expect(checkbox?.checked).toBe(false);
			expect(checkbox?.closest('label')?.textContent).toBe('Show unnamed items');
			expect(document.querySelector<HTMLElement>('#equipment-stats')?.dataset.showUnnamed).toBeUndefined();
		});

		it('flags the table body when the checkbox is checked, and clears it when unchecked', async () => {
			setupDOM(weaponsWithUnnamed);
			await augmentEquipmentStats({Stats: {Weapons: weaponsWithUnnamed}});

			const checkbox = document.querySelector<HTMLInputElement>('#equipment-unnamed-toggle input[type="checkbox"]')!;
			checkbox.click();
			expect(document.querySelector<HTMLElement>('#equipment-stats')?.dataset.showUnnamed).toBe('true');
			checkbox.click();
			expect(document.querySelector<HTMLElement>('#equipment-stats')?.dataset.showUnnamed).toBeUndefined();
		});

		it('shows the unnamed items in the totals only while the checkbox is checked', async () => {
			setupDOM(weaponsWithUnnamed);
			document.body.insertAdjacentHTML('beforeend', `
				<div id="equipment-aggregates">
					<table>
						<tbody id="equipment-aggregate-rows"></tbody>
						<tfoot id="equipment-aggregate-total"></tfoot>
					</table>
				</div>
			`);
			await augmentEquipmentStats({Stats: {Weapons: weaponsWithUnnamed}});
			const groups = () => [...document.querySelectorAll<HTMLTableRowElement>('#equipment-aggregate-rows tr')].map(row => row.cells[1].textContent);

			expect(groups()).not.toContain('Unnamed');
			const checkbox = document.querySelector<HTMLInputElement>('#equipment-unnamed-toggle input[type="checkbox"]')!;
			checkbox.click();
			expect(groups()).toContain('Unnamed');
			checkbox.click();
			expect(groups()).not.toContain('Unnamed');
		});

		it('gives Used a numeric sort value, with a blank one for unnamed items', async () => {
			setupDOM(weaponsWithUnnamed);
			await augmentEquipmentStats({Stats: {Weapons: weaponsWithUnnamed}});

			const rows = document.querySelectorAll<HTMLTableRowElement>('#equipment-stats tr');
			expect(rows[0].cells[2].dataset.sort).toBe('-1');
			expect(rows[1].cells[2].dataset.sort).toBe('100');
		});

		it('has no checkbox when there are no unnamed items', async () => {
			setupDOM();
			await augmentEquipmentStats(mockProfile);

			expect(document.querySelector('#equipment-unnamed-toggle input[type="checkbox"]')).toBeNull();
		});

		it('adds an "Unnamed" filter button', async () => {
			setupDOM(weaponsWithUnnamed);
			await augmentEquipmentStats({Stats: {Weapons: weaponsWithUnnamed}});

			expect(document.querySelector('#equipment-filter-bar button[data-filter="Unnamed"]')).not.toBeNull();
		});
	});

	it('leaves the table alone when the rows do not match the items, rather than misaligning them', async () => {
		setupDOM(mockProfile.Stats.Weapons.slice(0, 2));
		await augmentEquipmentStats(mockProfile);

		const rows = document.querySelectorAll<HTMLTableRowElement>('#equipment-stats tr');
		expect(rows[0].cells).toHaveLength(6);
		expect(rows[0].dataset.category).toBeUndefined();
	});

	it('does nothing when tbody is empty', async () => {
		document.body.innerHTML = `
			<div id="equipment-unnamed-toggle"></div>
			<div id="equipment-filter-bar"></div>
			<table><tbody id="equipment-stats"></tbody></table>
		`;
		await augmentEquipmentStats(mockProfile);
		expect(document.querySelector('#equipment-filter-bar button')).toBeNull();
	});

	describe('Sentinel/Companion shared denominator', () => {
		// `equipTime` values of 5, 3, and 2 sum to 10, so expected Used% is a clean
		// 50%, 30%, and 20% — easy to verify by inspection.
		const zeroStats = {
			kills: 0, headshots: 0, assists: 0, xp: 0,
		};
		const sentinelWeapon = {type: '/Lotus/Types/Sentinels/Deth/Dethcube', equipTime: 5, ...zeroStats};
		const kubrowWeapon = {type: '/Lotus/Types/Game/KubrowPet/KubrowPetPowerSuit', equipTime: 3, ...zeroStats};
		const moaWeapon = {type: '/Lotus/Types/Game/MoaPets/MoaPetPowerSuit', equipTime: 2, ...zeroStats};

		it('divides Sentinel and Companion Used% by their combined equipTime, not their own category alone', async () => {
			const weapons = [kubrowWeapon, moaWeapon];
			setupDOM(weapons);
			await augmentEquipmentStats({Stats: {Weapons: weapons}});

			const rows = document.querySelectorAll<HTMLTableRowElement>('#equipment-stats tr');
			// Combined total: 3 + 2 = 5, so Kubrow is 3/5 and Moa is 2/5 rather than each being 100%
			expect(rows[0].cells[2].textContent).toBe('60.00%');
			expect(rows[1].cells[2].textContent).toBe('40.00%');
		});

		it('includes MoaPets in the same combined denominator as Sentinels and KubrowPets', async () => {
			const weapons = [sentinelWeapon, kubrowWeapon, moaWeapon];
			setupDOM(weapons);
			await augmentEquipmentStats({Stats: {Weapons: weapons}});

			const rows = document.querySelectorAll<HTMLTableRowElement>('#equipment-stats tr');
			// Combined total: 5 + 3 + 2 = 10
			expect(rows[0].cells[2].textContent).toBe('50.00%');
			expect(rows[1].cells[2].textContent).toBe('30.00%');
			expect(rows[2].cells[2].textContent).toBe('20.00%');
		});

		it('is 100% when only one of the shared categories is present', async () => {
			const weapons = [sentinelWeapon];
			setupDOM(weapons);
			await augmentEquipmentStats({Stats: {Weapons: weapons}});

			const rows = document.querySelectorAll<HTMLTableRowElement>('#equipment-stats tr');
			expect(rows[0].cells[2].textContent).toBe('100.00%');
		});

		it('keeps data-category as the specific category, not the combined key, for filtering', async () => {
			const weapons = [sentinelWeapon, kubrowWeapon, moaWeapon];
			setupDOM(weapons);
			await augmentEquipmentStats({Stats: {Weapons: weapons}});

			const rows = document.querySelectorAll<HTMLTableRowElement>('#equipment-stats tr');
			expect(rows[0].dataset.category).toBe('Sentinels');
			expect(rows[1].dataset.category).toBe('KubrowPets');
			expect(rows[2].dataset.category).toBe('MoaPets');
		});

		it('does not mix Sentinel/Companion totals into unrelated categories', async () => {
			const weapons = [sentinelWeapon, kubrowWeapon, mockProfile.Stats.Weapons[0]];
			setupDOM(weapons);
			await augmentEquipmentStats({Stats: {Weapons: weapons}});

			const rows = document.querySelectorAll<HTMLTableRowElement>('#equipment-stats tr');
			// Braton is alone in LongGuns, so it should still be 100% despite Sentinel/Companion rows present
			expect(rows[2].dataset.category).toBe('LongGuns');
			expect(rows[2].cells[2].textContent).toBe('100.00%');
		});
	});
});
