import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mockBootstrapTooltip } from '../../helpers/dom-helpers';
import { loadMock, loadExportJson } from '../../helpers/api-mocks';
import { testCardFilters } from '../card-filters-factory';
import { isInvasionRewardShown, updateInvasions } from '../../../src/invasions';
import { isFilterEnabled, initializeCardFilters_all } from '../../../src/card-filters';

// Test card filter integration
testCardFilters('invasions');

describe('Invasions - Filter Panel DOM Structure', () => {
  test('filter panel has all three reward group headings', () => {
    const panel = document.getElementById('invasions-filters');
    expect(panel?.textContent).toContain('Resources');
    expect(panel?.textContent).toContain('Blueprints');
    expect(panel?.textContent).toContain('Weapon parts');
  });

  test('spot-check one checkbox per reward group', () => {
    expect(document.getElementById('filter-invasions-reward-EnergyComponent')).toBeTruthy();
    expect(document.getElementById('filter-invasions-reward-Forma')).toBeTruthy();
    expect(document.getElementById('filter-invasions-reward-KarakWraith')).toBeTruthy();
  });
});

// Shared setup for tests that exercise the real updateInvasions function
function setupInvasionsGlobals() {
  mockBootstrapTooltip();

  const ExportRegions = loadExportJson('ExportRegions.json');
  (window as any).ExportRegions = ExportRegions;
  (window as any).ExportRegions_promise = Promise.resolve(ExportRegions);

  // Minimal dict with just the node names used in tests
  const dict: Record<string, string> = {
    '/Lotus/Language/Locations/Adaro': 'Adaro',
    '/Lotus/Language/Locations/Sedna': 'Sedna',
    '/Lotus/Language/Locations/Orias': 'Orias',
    '/Lotus/Language/Locations/Europa': 'Europa',
    '/Lotus/Language/Locations/Gradivus': 'Gradivus',
    '/Lotus/Language/Locations/Mars': 'Mars',
  };
  (window as any).dict = dict;
  (window as any).dicts_promise = Promise.resolve([dict, {}]);

  // Stub getItemNamePromise to return the last path segment (e.g. "KarakWraithReceiver")
  (window as any).getItemNamePromise = (itemType: string) =>
    Promise.resolve(itemType.replace(/^.*\//, ''));

  // Stub setImageSource, addTooltip, and createCompletionToggle
  (window as any).setImageSource = (img: HTMLImageElement, icon: string) => { img.src = icon; };
  (window as any).addTooltip = (el: HTMLElement, title: string) => {
    el.setAttribute('data-bs-title', title);
  };
  (window as any).createCompletionToggle = (oid: string) => {
    const span = document.createElement('span');
    span.className = 'completion-check';
    span.dataset.oid = oid;
    return span;
  };
}

describe('Invasions - updateInvasions DOM rendering', () => {
  beforeEach(() => {
    setupInvasionsGlobals();
    // Set up the invasions-table element that updateInvasions writes into
    const table = document.createElement('table');
    table.id = 'invasions-table';
    document.body.appendChild(table);
    window.worldState = loadMock('worldState-invasions.json');
  });

  afterEach(() => {
    document.getElementById('invasions-table')?.remove();
    localStorage.clear();
    delete (window as any).worldState;
  });

  test('renders one visible row per invasion side (two rows per Corpus-vs-Grineer invasion)', async () => {
    await updateInvasions();
    // worldState-invasions.json has 2 invasions, each with attacker + defender reward → 4 visible rows
    const rows = document.querySelectorAll('#invasions-table tbody tr:not(.d-none)');
    expect(rows.length).toBe(4);
  });

  test('attacker row contains progress bar and percentage', async () => {
    await updateInvasions();
    const firstRow = document.querySelector('#invasions-table tbody tr:not(.d-none)') as HTMLElement;
    expect(firstRow.querySelector('.invasion-progress-container')).toBeTruthy();
    expect(firstRow.querySelector('.invasion-percentage')).toBeTruthy();
  });

  test('defender row has invasion-defender-reward class and no progress bar', async () => {
    await updateInvasions();
    const defenderRow = document.querySelector('#invasions-table tbody tr.invasion-defender-reward') as HTMLElement;
    expect(defenderRow).toBeTruthy();
    expect(defenderRow.querySelector('.invasion-progress-container')).toBeNull();
  });

  test('attacker row contains a completion toggle', async () => {
    await updateInvasions();
    const firstRow = document.querySelector('#invasions-table tbody tr:not(.d-none):not(.invasion-defender-reward)') as HTMLElement;
    expect(firstRow.querySelector('.completion-check')).toBeTruthy();
  });

  test('node label is rendered from ExportRegions + dict', async () => {
    await updateInvasions();
    // SolNode181 sorts first (lower percentage = 54.5% vs 72.2%)
    const firstRow = document.querySelector('#invasions-table tbody tr:not(.d-none)') as HTMLElement;
    expect(firstRow.querySelector('th')?.textContent).toContain('Adaro, Sedna');
  });

  test('when all invasions are completed, renders "no invasions" message', async () => {
    window.worldState.Invasions = window.worldState.Invasions.map((inv: any) => ({ ...inv, Completed: true }));
    await updateInvasions();
    expect(document.querySelector('#invasions-table')?.textContent)
      .toContain('No invasions match the current filters.');
  });

  test('completed invasions are not rendered', async () => {
    // Add a completed invasion to worldState — it should be ignored
    window.worldState.Invasions.push({
      _id: { $oid: 'aabbccddeeff001122334455' },
      Node: 'SolNode38',
      Completed: true,
      Count: -48000,
      Goal: 48000,
      Faction: 'FC_GRINEER',
      DefenderFaction: 'FC_CORPUS',
      Activation: { $date: { $numberLong: '1769000000000' } },
      AttackerReward: { countedItems: [{ ItemType: '/Lotus/Types/Items/Research/ChemComponent', ItemCount: 3 }] },
      DefenderReward: { countedItems: [{ ItemType: '/Lotus/Types/Items/Research/EnergyComponent', ItemCount: 3 }] },
    });
    await updateInvasions();
    const rows = document.querySelectorAll('#invasions-table tbody tr:not(.d-none)');
    expect(rows.length).toBe(4); // unchanged — completed invasion not rendered
  });

  test('invasions are sorted ascending by completion percentage', async () => {
    await updateInvasions();
    // SolNode181 (54.5%) should appear before SolNode217 (72.2%)
    const headers = Array.from(document.querySelectorAll('#invasions-table tbody tr:not(.d-none) th'))
      .map(th => th.textContent);
    const adaro = headers.findIndex(h => h?.includes('Adaro'));
    const orias = headers.findIndex(h => h?.includes('Orias'));
    expect(adaro).toBeLessThan(orias);
  });

  test('SolNode65 (Gradivus) shows 💥 emoji with Sabotage tooltip in node header', async () => {
    window.worldState.Invasions = [{
      _id: { $oid: '6974e8fee68ad4bc31ce5f49' },
      Node: 'SolNode65',
      Completed: false,
      Count: -20000,
      Goal: 39000,
      Faction: 'FC_INFESTATION',
      DefenderFaction: 'FC_CORPUS',
      Activation: { $date: { $numberLong: '1769982001914' } },
      AttackerReward: [],
      DefenderReward: { countedItems: [{ ItemType: '/Lotus/Types/Items/Research/BioComponent', ItemCount: 3 }] },
    }];
    await updateInvasions();
    const th = document.querySelector('#invasions-table tbody tr:not(.d-none) th') as HTMLElement;
    expect(th?.textContent).toContain('💥');
    const tooltipEl = th?.querySelector('[data-bs-title]');
    expect(tooltipEl?.getAttribute('data-bs-title')).toBe('Sabotage');
  });

  test('Assassination invasion shows Phorid sigil icon with tooltip in node header', async () => {
    // Add dict entries needed for an assassination node (e.g. SolNode144 = Exta, Ceres)
    (window as any).dict['/Lotus/Language/Locations/Exta'] = 'Exta';
    (window as any).dict['/Lotus/Language/Locations/Ceres'] = 'Ceres';
    window.worldState.Invasions = [{
      _id: { $oid: 'aabbccddeeff001122334455' },
      Node: 'SolNode144',
      Completed: false,
      Count: -20000,
      Goal: 39000,
      Faction: 'FC_INFESTATION',
      DefenderFaction: 'FC_GRINEER',
      Activation: { $date: { $numberLong: '1769982001914' } },
      AttackerReward: [],
      DefenderReward: { countedItems: [{ ItemType: '/Lotus/Types/Items/Research/BioComponent', ItemCount: 3 }] },
    }];
    await updateInvasions();
    const th = document.querySelector('#invasions-table tbody tr:not(.d-none) th') as HTMLElement;
    const img = th?.querySelector('img.invasion-boss-icon') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toContain('Phorid');
    expect(img.getAttribute('data-bs-title')).toBe('Assassination (Phorid)');
  });

  test('reward text omits "1x" prefix when ItemCount is 1', async () => {
    // worldState-invasions.json has ItemCount: 1 for all rewards
    await updateInvasions();
    const rewardCells = Array.from(document.querySelectorAll('#invasions-table tbody tr:not(.d-none) td:nth-child(3)'));
    expect(rewardCells.length).toBeGreaterThan(0);
    for (const td of rewardCells) {
      expect(td.textContent).not.toMatch(/^\d+x /);
    }
  });

  test('reward text shows count prefix when ItemCount is greater than 1', async () => {
    window.worldState.Invasions = [{
      _id: { $oid: 'aabbccddeeff001122334456' },
      Node: 'SolNode181',
      Completed: false,
      Count: -15000,
      Goal: 33000,
      Faction: 'FC_CORPUS',
      DefenderFaction: 'FC_GRINEER',
      Activation: { $date: { $numberLong: '1767898807628' } },
      AttackerReward: { countedItems: [{ ItemType: '/Lotus/Types/Items/Research/EnergyComponent', ItemCount: 3 }] },
      DefenderReward: { countedItems: [{ ItemType: '/Lotus/Types/Items/Research/ChemComponent', ItemCount: 3 }] },
    }];
    await updateInvasions();
    const rewardCells = Array.from(document.querySelectorAll('#invasions-table tbody tr:not(.d-none) td:nth-child(3)'));
    expect(rewardCells.length).toBeGreaterThan(0);
    for (const td of rewardCells) {
      expect(td.textContent).toMatch(/^3x /);
    }
  });

  test('when both rewards are filtered out, renders "no invasions" message', async () => {
    localStorage.setItem('live.filter.invasions.reward-SnipetronVandal', '0');
    localStorage.setItem('live.filter.invasions.reward-KarakWraith', '0');
    localStorage.setItem('live.filter.invasions.reward-LatronWraith', '0');
    await updateInvasions();
    expect(document.querySelector('#invasions-table')?.textContent)
      .toContain('No invasions match the current filters.');
  });

  test('defender-only visible row is promoted: no invasion-defender-reward class, has completion toggle', async () => {
    // Hide SnipetronVandal (SolNode181 attacker) → its defender row (KarakWraith) gets promoted
    localStorage.setItem('live.filter.invasions.reward-SnipetronVandal', '0');
    await updateInvasions();
    const rows = Array.from(document.querySelectorAll('#invasions-table tbody tr:not(.d-none)'));
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
