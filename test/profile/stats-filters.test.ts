import {
	describe, it, expect, beforeEach, vi,
} from 'vitest';
import {loadCommonJsFunctions, mockBootstrapTooltip} from '../helpers/dom-helpers';
import {loadExportJson} from '../helpers/api-mocks';
import {
	EQUIPMENT_CATEGORIES, ENEMY_FACTIONS, getEquipmentCategoryLabel, getEnemyFactionLabel, initStatsFilterBar,
} from '../../src/profile/stats-filters';

const ExportImages = loadExportJson('ExportImages.json');

describe('profile-stats-filters', () => {
	beforeEach(() => {
		mockBootstrapTooltip();
		(globalThis as any).ExportImages = ExportImages;
		loadCommonJsFunctions(['setImageSource']);
	});

	describe('EQUIPMENT_CATEGORIES', () => {
		it('contains all expected productCategory keys', () => {
			const expectedKeys = [
				'Suits',
				'LongGuns',
				'Pistols',
				'Melee',
				'SpaceSuits',
				'MechSuits',
				'Sentinels',
				'KubrowPets',
				'MoaPets',
				'SpaceGuns',
				'SpaceMelee',
				'SentinelWeapons',
				'DrifterMelee',
				'OperatorAmps',
				'SpecialItems',
			];
			for (const key of expectedKeys) {
				expect(EQUIPMENT_CATEGORIES).toHaveProperty(key);
			}
		});

		it('every entry has a tooltip string', () => {
			for (const [key, value] of Object.entries(EQUIPMENT_CATEGORIES) as Array<[string, any]>) {
				expect(typeof value.tooltip, key).toBe('string');
				expect(value.tooltip.length, key).toBeGreaterThan(0);
			}
		});

		it('every entry has an icon string (may be empty for SpecialItems)', () => {
			for (const [key, value] of Object.entries(EQUIPMENT_CATEGORIES) as Array<[string, any]>) {
				expect(typeof value.icon, key).toBe('string');
			}
		});
	});

	describe('ENEMY_FACTIONS', () => {
		it('is an array with at least one entry', () => {
			expect(Array.isArray(ENEMY_FACTIONS)).toBe(true);
			expect(ENEMY_FACTIONS.length).toBeGreaterThan(0);
		});

		it('every entry has tooltip, icon, and factions array', () => {
			for (const entry of ENEMY_FACTIONS) {
				expect(typeof entry.tooltip).toBe('string');
				expect(typeof entry.icon).toBe('string');
				expect(Array.isArray(entry.factions)).toBe(true);
				expect(entry.factions.length).toBeGreaterThan(0);
			}
		});

		it('covers the main factions', () => {
			const tooltips = ENEMY_FACTIONS.map((f: any) => f.tooltip);
			for (const expected of ['Grineer', 'Corpus', 'Infested', 'Orokin', 'Sentient', 'Narmer', 'Murmur']) {
				expect(tooltips).toContain(expected);
			}
		});

		it('Infested bucket covers both Infestation and Infested strings', () => {
			const infested = ENEMY_FACTIONS.find((f: any) => f.tooltip === 'Infested');
			expect(infested!.factions).toContain('Infestation');
			expect(infested!.factions).toContain('Infested');
		});
	});

	describe('icon paths resolve to content.warframe.com via setImageSource', () => {
		it('every non-empty equipment category icon produces a content.warframe.com URL', () => {
			for (const [key, value] of Object.entries(EQUIPMENT_CATEGORIES) as Array<[string, {icon: string}]>) {
				if (!value.icon) {
					continue;
				}

				const img = document.createElement('img');
				(globalThis as any).setImageSource(img, value.icon);
				expect(img.src, key).not.toMatch(/^https:\/\/browse\.wf\//u);
			}
		});

		it('every enemy faction icon produces a content.warframe.com URL', () => {
			for (const entry of ENEMY_FACTIONS) {
				const img = document.createElement('img');
				(globalThis as any).setImageSource(img, entry.icon);
				expect(img.src, entry.tooltip).not.toMatch(/^https:\/\/browse\.wf\//u);
			}
		});
	});

	describe('getEquipmentCategoryLabel', () => {
		it('returns the display label for a known productCategory', () => {
			expect(getEquipmentCategoryLabel('Suits')).toBe('Warframes');
			expect(getEquipmentCategoryLabel('LongGuns')).toBe('Primary');
			expect(getEquipmentCategoryLabel('Pistols')).toBe('Secondary');
			expect(getEquipmentCategoryLabel('Melee')).toBe('Melee');
		});

		it('returns undefined for an unknown productCategory', () => {
			expect(getEquipmentCategoryLabel('Unknown')).toBeUndefined();
			expect(getEquipmentCategoryLabel('')).toBeUndefined();
		});
	});

	describe('getEnemyFactionLabel', () => {
		it('returns the bucket label for a known faction string', () => {
			expect(getEnemyFactionLabel('Grineer')).toBe('Grineer');
			expect(getEnemyFactionLabel('Corpus')).toBe('Corpus');
			expect(getEnemyFactionLabel('Infestation')).toBe('Infested');
			expect(getEnemyFactionLabel('Infested')).toBe('Infested');
			expect(getEnemyFactionLabel('OrokinEmpire')).toBe('Orokin');
			expect(getEnemyFactionLabel('Orokin Empire')).toBe('Orokin');
			expect(getEnemyFactionLabel('NarmerVeil')).toBe('Narmer');
			expect(getEnemyFactionLabel('MITW')).toBe('Murmur');
		});

		it('returns undefined for an unknown faction string', () => {
			expect(getEnemyFactionLabel('Unknown')).toBeUndefined();
			expect(getEnemyFactionLabel('')).toBeUndefined();
		});
	});

	describe('initStatsFilterBar', () => {
		let filterBar: HTMLElement;
		let tbody: HTMLElement;

		const entries = [
			{key: 'Alpha', tooltip: 'Alpha Label', icon: '/Lotus/some/Alpha.png'},
			{key: 'Beta', tooltip: 'Beta Label', icon: ''},
			{key: 'Gamma', tooltip: 'Gamma Label', icon: '/Lotus/some/Gamma.png'},
		];

		beforeEach(() => {
			document.body.innerHTML = `
        <div id="filter-bar"></div>
        <table><tbody id="tbody">
          <tr data-category="Alpha"></tr>
          <tr data-category="Alpha"></tr>
          <tr data-category="Beta"></tr>
          <tr data-category="Gamma"></tr>
        </tbody></table>
      `;
			filterBar = document.querySelector('#filter-bar')!;
			tbody = document.querySelector('#tbody')!;
		});

		it('renders an "All" button as the first button', () => {
			initStatsFilterBar(filterBar, tbody, entries, new Set(['Alpha', 'Beta', 'Gamma']));
			const buttons = filterBar.querySelectorAll('button');
			expect(buttons[0].dataset.bsTitle).toBe('All');
			expect(buttons[0].dataset.filter).toBe('');
		});

		it('"All" button starts active', () => {
			initStatsFilterBar(filterBar, tbody, entries, new Set(['Alpha', 'Beta', 'Gamma']));
			const allBtn = filterBar.querySelector('button');
			expect(allBtn!.classList.contains('active')).toBe(true);
		});

		it('every button has a Bootstrap tooltip', () => {
			initStatsFilterBar(filterBar, tbody, entries, new Set(['Alpha', 'Beta', 'Gamma']));
			for (const btn of filterBar.querySelectorAll('button')) {
				expect(btn.dataset.bsToggle).toBe('tooltip');
				expect(btn.dataset.bsTitle).toBeTruthy();
			}
		});

		it('only renders buttons for categories present in presentKeys', () => {
			initStatsFilterBar(filterBar, tbody, entries, new Set(['Alpha', 'Gamma']));
			const buttons = filterBar.querySelectorAll('button');
			// All + Alpha + Gamma = 3, Beta is absent
			expect(buttons).toHaveLength(3);
			const filters = [...buttons].map(b => (b).dataset.filter);
			expect(filters).not.toContain('Beta');
		});

		it('renders an img for entries with an icon', () => {
			initStatsFilterBar(filterBar, tbody, entries, new Set(['Alpha', 'Beta', 'Gamma']));
			const alphaBtn = filterBar.querySelector<HTMLButtonElement>('[data-filter="Alpha"]');
			expect(alphaBtn!.querySelector('img')).toBeTruthy();
		});

		it('renders a text span for entries with no icon', () => {
			initStatsFilterBar(filterBar, tbody, entries, new Set(['Alpha', 'Beta', 'Gamma']));
			const betaBtn = filterBar.querySelector<HTMLButtonElement>('[data-filter="Beta"]');
			expect(betaBtn!.querySelector('span')).toBeTruthy();
			expect(betaBtn!.querySelector('img')).toBeNull();
		});

		it('clicking a filter button sets data-filter on tbody and marks button active', () => {
			initStatsFilterBar(filterBar, tbody, entries, new Set(['Alpha', 'Beta', 'Gamma']));
			const alphaBtn = filterBar.querySelector<HTMLButtonElement>('[data-filter="Alpha"]');
			alphaBtn!.click();
			expect(tbody.dataset.filter).toBe('Alpha');
			expect(alphaBtn!.classList.contains('active')).toBe(true);
		});

		it('clicking "All" clears the filter', () => {
			initStatsFilterBar(filterBar, tbody, entries, new Set(['Alpha', 'Beta', 'Gamma']));
			const alphaBtn = filterBar.querySelector<HTMLButtonElement>('[data-filter="Alpha"]');
			const allBtn = filterBar.querySelector<HTMLButtonElement>('[data-filter=""]');
			alphaBtn!.click();
			expect(tbody.dataset.filter).toBe('Alpha');
			allBtn!.click();
			expect(tbody.dataset.filter).toBeUndefined();
			expect(allBtn!.classList.contains('active')).toBe(true);
		});

		it('only one button is active at a time', () => {
			initStatsFilterBar(filterBar, tbody, entries, new Set(['Alpha', 'Beta', 'Gamma']));
			const alphaBtn = filterBar.querySelector<HTMLButtonElement>('[data-filter="Alpha"]');
			const gammaBtn = filterBar.querySelector<HTMLButtonElement>('[data-filter="Gamma"]');
			alphaBtn!.click();
			gammaBtn!.click();
			const activeButtons = filterBar.querySelectorAll('button.active');
			expect(activeButtons).toHaveLength(1);
			expect((activeButtons[0] as HTMLButtonElement).dataset.filter).toBe('Gamma');
		});

		it('calls onFilter callback when a category button is clicked', () => {
			const onFilter = vi.fn();
			initStatsFilterBar(filterBar, tbody, entries, new Set(['Alpha', 'Beta', 'Gamma']), () => {
				onFilter();
			});
			const alphaBtn = filterBar.querySelector<HTMLButtonElement>('[data-filter="Alpha"]');
			alphaBtn!.click();
			expect(onFilter).toHaveBeenCalledTimes(1);
		});

		it('calls onFilter callback when "All" is clicked', () => {
			const onFilter = vi.fn();
			initStatsFilterBar(filterBar, tbody, entries, new Set(['Alpha', 'Beta', 'Gamma']), () => {
				onFilter();
			});
			const alphaBtn = filterBar.querySelector<HTMLButtonElement>('[data-filter="Alpha"]');
			const allBtn = filterBar.querySelector<HTMLButtonElement>('[data-filter=""]');
			alphaBtn!.click();
			onFilter.mockClear();
			allBtn!.click();
			expect(onFilter).toHaveBeenCalledTimes(1);
		});

		it('does not throw when onFilter is omitted', () => {
			expect(() => {
				initStatsFilterBar(filterBar, tbody, entries, new Set(['Alpha']));
				filterBar.querySelector<HTMLButtonElement>('[data-filter="Alpha"]')!.click();
			}).not.toThrow();
		});
	});
});
