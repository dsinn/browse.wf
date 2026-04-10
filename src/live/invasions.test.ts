import {
	describe, test, expect, beforeEach, afterEach,
} from 'vitest';
import {mockBootstrapTooltip} from '@test/helpers/dom-helpers';
import {loadMock} from '@test/helpers/api-mocks';
import {testCardFilters} from '@test/live/card-filters-factory';
import {isFilterEnabled} from '../card-filters';
import {isInvasionRewardShown, updateInvasions} from './invasions';

// Test card filter integration
testCardFilters('invasions');

describe('Invasions - Filter Panel DOM Structure', () => {
	test('filter panel has all three reward group headings', () => {
		const panel = document.querySelector('#invasions-filters');
		expect(panel?.textContent).toContain('Resources');
		expect(panel?.textContent).toContain('Blueprints');
		expect(panel?.textContent).toContain('Weapon parts');
	});

	test('spot-check one checkbox per reward group', () => {
		expect(document.querySelector('#filter-invasions-reward-EnergyComponent')).toBeTruthy();
		expect(document.querySelector('#filter-invasions-reward-Forma')).toBeTruthy();
		expect(document.querySelector('#filter-invasions-reward-KarakWraith')).toBeTruthy();
	});
});

// Shared setup for tests that exercise the real updateInvasions function
function setupInvasionsGlobals() {
	mockBootstrapTooltip();

	// Stub getItemNamePromise to return the last path segment (e.g. "KarakWraithReceiver")
	(globalThis as any).getItemNamePromise = async (itemType: string) =>
		itemType.replace(/^.*\//u, '');

	// Stub setImageSource, addTooltip, and createCompletionToggle
	(globalThis as any).setImageSource = (img: HTMLImageElement, icon: string) => {
		img.src = icon;
	};

	(globalThis as any).addTooltip = (element: HTMLElement, title: string) => {
		element.dataset.bsTitle = title;
	};

	(globalThis as any).createCompletionToggle = (oid: string) => {
		const span = document.createElement('span');
		span.className = 'completion-check';
		span.dataset.oid = oid;
		return span;
	};
}

describe('Invasions - updateInvasions DOM rendering', () => {
	let callUpdateInvasions: () => Promise<void>;

	beforeEach(() => {
		setupInvasionsGlobals();
		callUpdateInvasions = async () => updateInvasions();
		// Set up the invasions-table element that updateInvasions writes into
		const table = document.createElement('table');
		table.id = 'invasions-table';
		document.body.append(table);
		(globalThis as any).worldState = loadMock('worldState-invasions.json');
	});

	afterEach(() => {
		document.querySelector('#invasions-table')?.remove();
		localStorage.clear();
		delete (globalThis as any).worldState;
	});

	test('renders one visible row per invasion side (two rows per Corpus-vs-Grineer invasion)', async () => {
		await callUpdateInvasions();
		// WorldState-invasions.json has 2 invasions, each with attacker + defender reward → 4 visible rows
		const rows = document.querySelectorAll('#invasions-table tbody tr:not(.d-none)');
		expect(rows.length).toBe(4);
	});

	test('attacker row contains progress bar and percentage', async () => {
		await callUpdateInvasions();
		const firstRow = document.querySelector('#invasions-table tbody tr:not(.d-none)');
		expect(firstRow!.querySelector('.invasion-progress-container')).toBeTruthy();
		expect(firstRow!.querySelector('.invasion-percentage')).toBeTruthy();
	});

	test('defender row has invasion-defender-reward class and no progress bar', async () => {
		await callUpdateInvasions();
		const defenderRow = document.querySelector('#invasions-table tbody tr.invasion-defender-reward');
		expect(defenderRow).toBeTruthy();
		expect(defenderRow!.querySelector('.invasion-progress-container')).toBeNull();
	});

	test('attacker row contains a completion toggle', async () => {
		await callUpdateInvasions();
		const firstRow = document.querySelector('#invasions-table tbody tr:not(.d-none):not(.invasion-defender-reward)');
		expect(firstRow!.querySelector('.completion-check')).toBeTruthy();
	});

	test('node label is rendered from ExportRegions + dict', async () => {
		await callUpdateInvasions();
		// SolNode181 sorts first (lower percentage = 54.5% vs 72.2%)
		const firstRow = document.querySelector('#invasions-table tbody tr:not(.d-none)');
		expect(firstRow!.querySelector('th')?.textContent).toContain('Adaro, Sedna');
	});

	test('when all invasions are completed, renders "no invasions" message', async () => {
		(globalThis as any).worldState.Invasions = (globalThis as any).worldState.Invasions.map((inv: any) => ({...inv, Completed: true}));
		await callUpdateInvasions();
		expect(document.querySelector('#invasions-table')?.textContent)
			.toContain('No invasions match the current filters.');
	});

	test('completed invasions are not rendered', async () => {
		// Add a completed invasion to worldState — it should be ignored
		(globalThis as any).worldState.Invasions.push({
			_id: {$oid: 'aabbccddeeff001122334455'},
			Node: 'SolNode38',
			Completed: true,
			Count: -48_000,
			Goal: 48_000,
			Faction: 'FC_GRINEER',
			DefenderFaction: 'FC_CORPUS',
			Activation: {$date: {$numberLong: '1769000000000'}},
			AttackerReward: {countedItems: [{ItemType: '/Lotus/Types/Items/Research/ChemComponent', ItemCount: 3}]},
			DefenderReward: {countedItems: [{ItemType: '/Lotus/Types/Items/Research/EnergyComponent', ItemCount: 3}]},
		});
		await callUpdateInvasions();
		const rows = document.querySelectorAll('#invasions-table tbody tr:not(.d-none)');
		expect(rows.length).toBe(4); // Unchanged — completed invasion not rendered
	});

	test('invasions are sorted ascending by completion percentage', async () => {
		await callUpdateInvasions();
		// SolNode181 (54.5%) should appear before SolNode217 (72.2%)
		const headers = [...document.querySelectorAll('#invasions-table tbody tr:not(.d-none) th')]
			.map(th => th.textContent);
		const adaro = headers.findIndex(h => h?.includes('Adaro'));
		const orias = headers.findIndex(h => h?.includes('Orias'));
		expect(adaro).toBeLessThan(orias);
	});

	test('duplicate-node invasion sorts last, shows hourglass instead of percentage, and has empty toggle cell', async () => {
		// In the mock data, there are two invasions at 100% but only one of them is a duplicate.
		(globalThis as any).worldState = loadMock('worldState-duplicate-invasion-node.json');
		await callUpdateInvasions();
		const allDupRows = [...document.querySelectorAll('#invasions-table tbody tr:not(.d-none):not(.invasion-defender-reward)')];
		const lastRow = allDupRows.at(-1)!;
		expect(lastRow).toBeDefined();
		expect(lastRow.querySelector('td:nth-child(2)')!.textContent).toContain('⏳');
		expect(lastRow.querySelector('.invasion-percentage')).toBeNull();
		expect(lastRow.querySelector('.completion-check')).toBeNull();
	});

	test('SolNode65 (Gradivus) shows 💥 emoji with Sabotage tooltip in node header', async () => {
		(globalThis as any).worldState.Invasions = [{
			_id: {$oid: '6974e8fee68ad4bc31ce5f49'},
			Node: 'SolNode65',
			Completed: false,
			Count: -20_000,
			Goal: 39_000,
			Faction: 'FC_INFESTATION',
			DefenderFaction: 'FC_CORPUS',
			Activation: {$date: {$numberLong: '1769982001914'}},
			AttackerReward: [],
			DefenderReward: {countedItems: [{ItemType: '/Lotus/Types/Items/Research/BioComponent', ItemCount: 3}]},
		}];
		await callUpdateInvasions();
		const th = document.querySelector('#invasions-table tbody tr:not(.d-none) th');
		expect(th?.textContent).toContain('💥');
		const sabotageSpan = th?.querySelector('span[data-bs-title="Sabotage"]');
		expect(sabotageSpan).toBeTruthy();
	});

	test('Assassination invasion shows Phorid sigil icon with tooltip in node header', async () => {
		// Add dict entries needed for an assassination node (e.g. SolNode144 = Exta, Ceres)
		(globalThis as any).dict['/Lotus/Language/Locations/Exta'] = 'Exta';
		(globalThis as any).dict['/Lotus/Language/Locations/Ceres'] = 'Ceres';
		(globalThis as any).worldState.Invasions = [{
			_id: {$oid: 'aabbccddeeff001122334455'},
			Node: 'SolNode144',
			Completed: false,
			Count: -20_000,
			Goal: 39_000,
			Faction: 'FC_INFESTATION',
			DefenderFaction: 'FC_GRINEER',
			Activation: {$date: {$numberLong: '1769982001914'}},
			AttackerReward: [],
			DefenderReward: {countedItems: [{ItemType: '/Lotus/Types/Items/Research/BioComponent', ItemCount: 3}]},
		}];
		await callUpdateInvasions();
		const th = document.querySelector('#invasions-table tbody tr:not(.d-none) th');
		const img = th?.querySelector<HTMLImageElement>('img.invasion-boss-icon');
		expect(img).toBeTruthy();
		expect(img!.src).toContain('Phorid');
		expect(img!.dataset.bsTitle).toBe('Assassination (Phorid)');
	});

	test('Assassination node shows Grineer Asteroid tileset tooltip regardless of node tileset field', async () => {
		(globalThis as any).dict['/Lotus/Language/Locations/Exta'] = 'Exta';
		(globalThis as any).dict['/Lotus/Language/Locations/Ceres'] = 'Ceres';
		(globalThis as any).worldState.Invasions = [{
			_id: {$oid: 'aabbccddeeff001122334455'},
			Node: 'SolNode144',
			Completed: false,
			Count: -20_000,
			Goal: 39_000,
			Faction: 'FC_INFESTATION',
			DefenderFaction: 'FC_GRINEER',
			Activation: {$date: {$numberLong: '1769982001914'}},
			AttackerReward: [],
			DefenderReward: {countedItems: [{ItemType: '/Lotus/Types/Items/Research/BioComponent', ItemCount: 3}]},
		}];
		await callUpdateInvasions();
		const th = document.querySelector('#invasions-table tbody tr:not(.d-none) th');
		const labelSpan = th?.querySelector<HTMLElement>('span[data-bs-title]');
		expect(labelSpan?.dataset.bsTitle).toBe('Grineer Asteroid');
	});

	test('non-assassination node shows tileset from ExportRegions as tooltip', async () => {
		await callUpdateInvasions();
		const headers = [...document.querySelectorAll('#invasions-table tbody tr:not(.d-none) th')];
		const oriasHeader = headers.find(th => th.textContent?.includes('Orias'));
		const labelSpan = oriasHeader?.querySelector<HTMLElement>('span[data-bs-title]');
		expect(labelSpan?.dataset.bsTitle).toBe('Corpus Ice Planet');
	});

	test('percentage cell shows activation tooltip with elapsed time under 1 hour', async () => {
		const thirtyMinutesAgo = 1_768_087_200_000 - (30 * 60_000);
		(globalThis as any).worldState.Invasions = [{
			_id: {$oid: 'aabbccddeeff001122334455'},
			Node: 'SolNode181',
			Completed: false,
			Count: -15_000,
			Goal: 33_000,
			Faction: 'FC_CORPUS',
			DefenderFaction: 'FC_GRINEER',
			Activation: {$date: {$numberLong: String(thirtyMinutesAgo)}},
			AttackerReward: {countedItems: [{ItemType: '/Lotus/Types/Recipes/Weapons/SnipetronVandalBlueprint', ItemCount: 1}]},
			DefenderReward: {countedItems: [{ItemType: '/Lotus/Types/Recipes/Weapons/WeaponParts/KarakWraithReceiver', ItemCount: 1}]},
		}];
		await callUpdateInvasions();
		const span = document.querySelector<HTMLElement>('#invasions-table .invasion-percentage');
		expect(span?.dataset.bsTitle).toMatch(/Up since .+ \(30m.ago\); 18,000.runs.left/u);
	});

	test('percentage cell shows elapsed hours and minutes when under 24 hours', async () => {
		await callUpdateInvasions();
		const headers = [...document.querySelectorAll('#invasions-table tbody tr:not(.d-none) th')];
		const oriasRow = headers.find(th => th.textContent?.includes('Orias'))?.closest('tr');
		const span = oriasRow?.querySelector<HTMLElement>('.invasion-percentage');
		expect(span?.dataset.bsTitle).toMatch(/Up since .+ \(15h.50m.ago\); 26,000.runs.left/u);
	});

	test('percentage cell shows days when invasion has been up over 24 hours', async () => {
		await callUpdateInvasions();
		const headers = [...document.querySelectorAll('#invasions-table tbody tr:not(.d-none) th')];
		const adaroRow = headers.find(th => th.textContent?.includes('Adaro'))?.closest('tr');
		const span = adaroRow?.querySelector<HTMLElement>('.invasion-percentage');
		expect(span?.dataset.bsTitle).toMatch(/Up since .+ \(2d.4h.19m.ago\); 18,000.runs.left/u);
	});

	test('percentage cell tooltip shows "run" (singular) when exactly 1 run remains', async () => {
		(globalThis as any).worldState.Invasions = [{
			_id: {$oid: 'aabbccddeeff001122334455'},
			Node: 'SolNode181',
			Completed: false,
			Count: -(33_000 - 1),
			Goal: 33_000,
			Faction: 'FC_CORPUS',
			DefenderFaction: 'FC_GRINEER',
			Activation: {$date: {$numberLong: '1768030142526'}},
			AttackerReward: {countedItems: [{ItemType: '/Lotus/Types/Recipes/Weapons/SnipetronVandalBlueprint', ItemCount: 1}]},
			DefenderReward: {countedItems: [{ItemType: '/Lotus/Types/Recipes/Weapons/WeaponParts/KarakWraithReceiver', ItemCount: 1}]},
		}];
		await callUpdateInvasions();
		const span = document.querySelector<HTMLElement>('#invasions-table .invasion-percentage');
		expect(span?.dataset.bsTitle).toMatch(/; 1.run.left$/u);
	});

	test('percentage cell tooltip clamps runs to 0 when Count exceeds Goal', async () => {
		(globalThis as any).worldState.Invasions = [{
			_id: {$oid: 'aabbccddeeff001122334455'},
			Node: 'SolNode181',
			Completed: false,
			Count: -99_999,
			Goal: 33_000,
			Faction: 'FC_CORPUS',
			DefenderFaction: 'FC_GRINEER',
			Activation: {$date: {$numberLong: '1768030142526'}},
			AttackerReward: {countedItems: [{ItemType: '/Lotus/Types/Recipes/Weapons/SnipetronVandalBlueprint', ItemCount: 1}]},
			DefenderReward: {countedItems: [{ItemType: '/Lotus/Types/Recipes/Weapons/WeaponParts/KarakWraithReceiver', ItemCount: 1}]},
		}];
		await callUpdateInvasions();
		const span = document.querySelector<HTMLElement>('#invasions-table .invasion-percentage');
		expect(span?.dataset.bsTitle).toMatch(/; 0.runs.left$/u);
	});

	test('duplicate-node invasion does not show activation tooltip on hourglass', async () => {
		(globalThis as any).worldState = loadMock('worldState-duplicate-invasion-node.json');
		await callUpdateInvasions();
		const allRows = [...document.querySelectorAll('#invasions-table tbody tr:not(.d-none):not(.invasion-defender-reward)')];
		const lastRow = allRows.at(-1)!;
		const hourglassSpan = lastRow.querySelector<HTMLElement>('td:nth-child(2) span');
		expect(hourglassSpan?.dataset.bsTitle).toContain('Will unlock');
		expect(hourglassSpan?.dataset.bsTitle).not.toContain('Up since');
	});

	test('reward text omits "1x" prefix when ItemCount is 1', async () => {
		await callUpdateInvasions();
		const rewardCells = [...document.querySelectorAll('#invasions-table tbody tr:not(.d-none) td:nth-child(3)')];
		expect(rewardCells.length).toBeGreaterThan(0);
		for (const td of rewardCells) {
			expect(td.textContent).not.toMatch(/^\d+x /u);
		}
	});

	test('reward text shows count prefix when ItemCount is greater than 1', async () => {
		(globalThis as any).worldState.Invasions = [{
			_id: {$oid: 'aabbccddeeff001122334456'},
			Node: 'SolNode181',
			Completed: false,
			Count: -15_000,
			Goal: 33_000,
			Faction: 'FC_CORPUS',
			DefenderFaction: 'FC_GRINEER',
			Activation: {$date: {$numberLong: '1767898807628'}},
			AttackerReward: {countedItems: [{ItemType: '/Lotus/Types/Items/Research/EnergyComponent', ItemCount: 3}]},
			DefenderReward: {countedItems: [{ItemType: '/Lotus/Types/Items/Research/ChemComponent', ItemCount: 3}]},
		}];
		await callUpdateInvasions();
		const rewardCells = [...document.querySelectorAll('#invasions-table tbody tr:not(.d-none) td:nth-child(3)')];
		expect(rewardCells.length).toBeGreaterThan(0);
		for (const td of rewardCells) {
			expect(td.textContent).toMatch(/^3x /u);
		}
	});

	test('when both rewards are filtered out, renders "no invasions" message', async () => {
		localStorage.setItem('live.filter.invasions.reward-SnipetronVandal', '0');
		localStorage.setItem('live.filter.invasions.reward-KarakWraith', '0');
		localStorage.setItem('live.filter.invasions.reward-LatronWraith', '0');
		await callUpdateInvasions();
		expect(document.querySelector('#invasions-table')?.textContent)
			.toContain('No invasions match the current filters.');
	});

	test('defender-only visible row is promoted: no invasion-defender-reward class, has completion toggle', async () => {
		// Hide SnipetronVandal (SolNode181 attacker) → its defender row (KarakWraith) gets promoted
		localStorage.setItem('live.filter.invasions.reward-SnipetronVandal', '0');
		await callUpdateInvasions();
		const rows = [...document.querySelectorAll('#invasions-table tbody tr:not(.d-none)')];
		// SolNode181 should now have only one visible row, not marked as defender
		const sol181Rows = rows.filter(r => r.querySelector('th')?.textContent?.includes('Adaro'));
		expect(sol181Rows.length).toBe(1);
		expect(sol181Rows[0].classList.contains('invasion-defender-reward')).toBe(false);
		expect(sol181Rows[0].querySelector('.completion-check')).toBeTruthy();
	});
});

describe('Invasions - Reward Filter (isInvasionRewardShown)', () => {
	afterEach(() => {
		localStorage.clear();
	});

	test('shows unknown item types by default', () => {
		expect(isInvasionRewardShown('/Lotus/Types/SomeUnknownItem')).toBe(true);
	});

	test('shows all known reward types when no filters are set', () => {
		const itemTypes = [
			'/Lotus/Types/Items/Research/EnergyComponent',
			'/Lotus/Types/Items/Research/ChemComponent',
			'/Lotus/Types/Items/Research/BioComponent',
			'/Lotus/Types/Items/MiscItems/InfestedAladCoordinate',
			'/Lotus/Types/Recipes/Weapons/WeaponParts/KarakWraithReceiver',
			'/Lotus/Types/Recipes/Weapons/WeaponParts/LatronWraithBarrel',
			'/Lotus/Types/Recipes/Weapons/WeaponParts/StrunWraithBarrel',
			'/Lotus/Types/Recipes/Weapons/WeaponParts/TwinVipersWraithBarrel',
			'/Lotus/Types/Recipes/Weapons/WeaponParts/GrineerCombatKnifeHeatsink',
			'/Lotus/Types/Recipes/Weapons/WeaponParts/DeraVandalBarrel',
			'/Lotus/Types/Recipes/Weapons/WeaponParts/SnipetronVandalBarrel',
			'/Lotus/Types/Recipes/Weapons/SnipetronVandalBlueprint',
			'/Lotus/Types/Recipes/Components/FormaBlueprint',
			'/Lotus/Types/Recipes/Components/OrokinCatalystBlueprint',
			'/Lotus/Types/Recipes/Components/OrokinReactorBlueprint',
		];
		for (const itemType of itemTypes) {
			expect(isInvasionRewardShown(itemType)).toBe(true);
		}
	});

	test('hides Fieldron (EnergyComponent) when its filter is unchecked', () => {
		localStorage.setItem('live.filter.invasions.reward-EnergyComponent', '0');
		expect(isInvasionRewardShown('/Lotus/Types/Items/Research/EnergyComponent')).toBe(false);
	});

	test('hides Detonite Injector (ChemComponent) when its filter is unchecked', () => {
		localStorage.setItem('live.filter.invasions.reward-ChemComponent', '0');
		expect(isInvasionRewardShown('/Lotus/Types/Items/Research/ChemComponent')).toBe(false);
	});

	test('hides Mutagen Mass (BioComponent) when its filter is unchecked', () => {
		localStorage.setItem('live.filter.invasions.reward-BioComponent', '0');
		expect(isInvasionRewardShown('/Lotus/Types/Items/Research/BioComponent')).toBe(false);
	});

	test('hides Nav Coordinate when its filter is unchecked', () => {
		localStorage.setItem('live.filter.invasions.reward-InfestedAladCoordinate', '0');
		expect(isInvasionRewardShown('/Lotus/Types/Items/MiscItems/InfestedAladCoordinate')).toBe(false);
	});

	test('hides Karak Wraith parts when their filter is unchecked', () => {
		localStorage.setItem('live.filter.invasions.reward-KarakWraith', '0');
		expect(isInvasionRewardShown('/Lotus/Types/Recipes/Weapons/WeaponParts/KarakWraithReceiver')).toBe(false);
		expect(isInvasionRewardShown('/Lotus/Types/Recipes/Weapons/WeaponParts/KarakWraithBarrel')).toBe(false);
	});

	test('hides Snipetron Vandal parts and blueprint when their filter is unchecked', () => {
		localStorage.setItem('live.filter.invasions.reward-SnipetronVandal', '0');
		expect(isInvasionRewardShown('/Lotus/Types/Recipes/Weapons/WeaponParts/SnipetronVandalBarrel')).toBe(false);
		expect(isInvasionRewardShown('/Lotus/Types/Recipes/Weapons/SnipetronVandalBlueprint')).toBe(false);
	});

	test('hides Forma when its filter is unchecked', () => {
		localStorage.setItem('live.filter.invasions.reward-Forma', '0');
		expect(isInvasionRewardShown('/Lotus/Types/Recipes/Components/FormaBlueprint')).toBe(false);
	});

	test('hides Orokin Catalyst when its filter is unchecked', () => {
		localStorage.setItem('live.filter.invasions.reward-OrokinCatalyst', '0');
		expect(isInvasionRewardShown('/Lotus/Types/Recipes/Components/OrokinCatalystBlueprint')).toBe(false);
	});

	test('hides Orokin Reactor when its filter is unchecked', () => {
		localStorage.setItem('live.filter.invasions.reward-OrokinReactor', '0');
		expect(isInvasionRewardShown('/Lotus/Types/Recipes/Components/OrokinReactorBlueprint')).toBe(false);
	});

	test('GrineerCombatKnife sortie blueprint maps to same key as parts', () => {
		localStorage.setItem('live.filter.invasions.reward-GrineerCombatKnife', '0');
		expect(isInvasionRewardShown('/Lotus/Types/Recipes/Weapons/GrineerCombatKnifeSortieBlueprint')).toBe(false);
		expect(isInvasionRewardShown('/Lotus/Types/Recipes/Weapons/WeaponParts/GrineerCombatKnifeHeatsink')).toBe(false);
	});

	test('shows reward again after re-checking its filter', () => {
		localStorage.setItem('live.filter.invasions.reward-EnergyComponent', '0');
		expect(isInvasionRewardShown('/Lotus/Types/Items/Research/EnergyComponent')).toBe(false);
		localStorage.setItem('live.filter.invasions.reward-EnergyComponent', '1');
		expect(isInvasionRewardShown('/Lotus/Types/Items/Research/EnergyComponent')).toBe(true);
	});

	test('unchecking one filter does not affect other reward types', () => {
		localStorage.setItem('live.filter.invasions.reward-EnergyComponent', '0');
		expect(isInvasionRewardShown('/Lotus/Types/Items/Research/ChemComponent')).toBe(true);
		expect(isInvasionRewardShown('/Lotus/Types/Recipes/Weapons/WeaponParts/KarakWraithReceiver')).toBe(true);
	});
});
