import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { loadMock } from '../../helpers/api-mocks';
import { loadScript } from '../../helpers/dom-helpers';
import { testCardFilters } from '../card-filters-factory';

// Test card filter integration
testCardFilters('invasions');

describe('Invasions Card', () => {
  const invasionsData = loadMock('invasions.json');

  test('renders invasion data from API', () => {
    const invasionsData = loadMock('invasions.json');

    expect(invasionsData.invasions).toBeDefined();
    expect(Array.isArray(invasionsData.invasions)).toBe(true);
    expect(invasionsData.invasions.length).toBeGreaterThan(0);
  });

  test('displays invasion rewards correctly', () => {
    const firstInvasion = invasionsData.invasions[0];

    expect(firstInvasion).toHaveProperty('node');
    expect(firstInvasion).toHaveProperty('ally');
    expect(firstInvasion).toHaveProperty('allyPay');
    expect(firstInvasion).toHaveProperty('missions');

    expect(Array.isArray(firstInvasion.allyPay)).toBe(true);
    expect(firstInvasion.allyPay[0]).toHaveProperty('ItemType');
    expect(firstInvasion.allyPay[0]).toHaveProperty('ItemCount');
  });

  test('shows both sides of invasion', () => {
    // Find invasions with the same ID (two sides of same conflict)
    const invasionIds = invasionsData.invasions.map((inv: any) => inv.id);
    const uniqueIds = new Set(invasionIds);

    // Should have duplicate IDs (representing both sides)
    expect(invasionIds.length).toBeGreaterThan(uniqueIds.size);
  });

  test('identifies Grineer vs Corpus invasions', () => {
    const allies = invasionsData.invasions.map((inv: any) => inv.ally);
    const hasGrineer = allies.some((ally: string) => ally === 'FC_GRINEER');
    const hasCorpus = allies.some((ally: string) => ally === 'FC_CORPUS');

    expect(hasGrineer).toBe(true);
    expect(hasCorpus).toBe(true);
  });
});

describe('Invasions - Reward Filter (isInvasionRewardShown)', () => {
  beforeEach(() => {
    loadScript('typestripped/src/card-filters.js');
    loadScript('typestripped/src/invasions.js');
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('shows unknown item types by default', () => {
    expect((window as any).isInvasionRewardShown('/Lotus/Types/SomeUnknownItem')).toBe(true);
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
      expect((window as any).isInvasionRewardShown(itemType)).toBe(true);
    }
  });

  test('hides Fieldron (EnergyComponent) when its filter is unchecked', () => {
    localStorage.setItem('live.filter.invasions.reward-EnergyComponent', '0');
    expect((window as any).isInvasionRewardShown('/Lotus/Types/Items/Research/EnergyComponent')).toBe(false);
  });

  test('hides Detonite Injector (ChemComponent) when its filter is unchecked', () => {
    localStorage.setItem('live.filter.invasions.reward-ChemComponent', '0');
    expect((window as any).isInvasionRewardShown('/Lotus/Types/Items/Research/ChemComponent')).toBe(false);
  });

  test('hides Mutagen Mass (BioComponent) when its filter is unchecked', () => {
    localStorage.setItem('live.filter.invasions.reward-BioComponent', '0');
    expect((window as any).isInvasionRewardShown('/Lotus/Types/Items/Research/BioComponent')).toBe(false);
  });

  test('hides Nav Coordinate when its filter is unchecked', () => {
    localStorage.setItem('live.filter.invasions.reward-InfestedAladCoordinate', '0');
    expect((window as any).isInvasionRewardShown('/Lotus/Types/Items/MiscItems/InfestedAladCoordinate')).toBe(false);
  });

  test('hides Karak Wraith parts when their filter is unchecked', () => {
    localStorage.setItem('live.filter.invasions.reward-KarakWraith', '0');
    expect((window as any).isInvasionRewardShown('/Lotus/Types/Recipes/Weapons/WeaponParts/KarakWraithReceiver')).toBe(false);
    expect((window as any).isInvasionRewardShown('/Lotus/Types/Recipes/Weapons/WeaponParts/KarakWraithBarrel')).toBe(false);
  });

  test('hides Snipetron Vandal parts and blueprint when their filter is unchecked', () => {
    localStorage.setItem('live.filter.invasions.reward-SnipetronVandal', '0');
    expect((window as any).isInvasionRewardShown('/Lotus/Types/Recipes/Weapons/WeaponParts/SnipetronVandalBarrel')).toBe(false);
    expect((window as any).isInvasionRewardShown('/Lotus/Types/Recipes/Weapons/SnipetronVandalBlueprint')).toBe(false);
  });

  test('hides Forma when its filter is unchecked', () => {
    localStorage.setItem('live.filter.invasions.reward-Forma', '0');
    expect((window as any).isInvasionRewardShown('/Lotus/Types/Recipes/Components/FormaBlueprint')).toBe(false);
  });

  test('hides Orokin Catalyst when its filter is unchecked', () => {
    localStorage.setItem('live.filter.invasions.reward-OrokinCatalyst', '0');
    expect((window as any).isInvasionRewardShown('/Lotus/Types/Recipes/Components/OrokinCatalystBlueprint')).toBe(false);
  });

  test('hides Orokin Reactor when its filter is unchecked', () => {
    localStorage.setItem('live.filter.invasions.reward-OrokinReactor', '0');
    expect((window as any).isInvasionRewardShown('/Lotus/Types/Recipes/Components/OrokinReactorBlueprint')).toBe(false);
  });

  test('GrineerCombatKnife sortie blueprint maps to same key as parts', () => {
    localStorage.setItem('live.filter.invasions.reward-GrineerCombatKnife', '0');
    expect((window as any).isInvasionRewardShown('/Lotus/Types/Recipes/Weapons/GrineerCombatKnifeSortieBlueprint')).toBe(false);
    expect((window as any).isInvasionRewardShown('/Lotus/Types/Recipes/Weapons/WeaponParts/GrineerCombatKnifeHeatsink')).toBe(false);
  });

  test('shows reward again after re-checking its filter', () => {
    localStorage.setItem('live.filter.invasions.reward-EnergyComponent', '0');
    expect((window as any).isInvasionRewardShown('/Lotus/Types/Items/Research/EnergyComponent')).toBe(false);
    localStorage.setItem('live.filter.invasions.reward-EnergyComponent', '1');
    expect((window as any).isInvasionRewardShown('/Lotus/Types/Items/Research/EnergyComponent')).toBe(true);
  });

  test('unchecking one filter does not affect other reward types', () => {
    localStorage.setItem('live.filter.invasions.reward-EnergyComponent', '0');
    expect((window as any).isInvasionRewardShown('/Lotus/Types/Items/Research/ChemComponent')).toBe(true);
    expect((window as any).isInvasionRewardShown('/Lotus/Types/Recipes/Weapons/WeaponParts/KarakWraithReceiver')).toBe(true);
  });
});

describe('Invasions - Duplicate Node Detection', () => {
  loadScript('typestripped/src/invasions.js');

  const invasionsData = loadMock('invasions-duplicate-node.json');
  const worldStateData = loadMock('worldState-duplicate-invasion-node.json');
  const duplicateNode = 'SolNode189'; // Node with duplicate invasions in the mock data

  test('detects duplicate invasions on the same node based on Activation', () => {
    // Call the real buildInvasionExtraDataMap function
    const extraDataMap = (window as any).buildInvasionExtraDataMap(
      worldStateData.Invasions,
      invasionsData.invasions
    );

    // Find invasions with duplicate nodes (duplicateNode appears multiple times)
    const duplicateNodeInvasions = invasionsData.invasions.filter(
      (inv: any) => inv.node === duplicateNode
    );

    expect(duplicateNodeInvasions.length).toBeGreaterThan(1);

    // Get unique invasion IDs on duplicateNode
    const uniqueInvasionIds = Array.from(new Set(duplicateNodeInvasions.map((inv: any) => inv.id)));
    expect(uniqueInvasionIds.length).toBeGreaterThanOrEqual(2);

    // The first invasion on duplicateNode should be marked as duplicate in our mock data
    const firstInvasionId = uniqueInvasionIds[0];
    const firstExtraData = extraDataMap[firstInvasionId];
    expect(firstExtraData).toBeDefined();
    expect(firstExtraData.isDuplicate).toBe(true);

    // The second invasion on duplicateNode should NOT be marked as duplicate in our mock data
    const secondInvasionId = uniqueInvasionIds[1];
    const secondExtraData = extraDataMap[secondInvasionId];
    expect(secondExtraData).toBeDefined();
    expect(secondExtraData.isDuplicate).toBe(false);
  });

  test('non-duplicate invasions are not marked as duplicate', () => {
    const extraDataMap = (window as any).buildInvasionExtraDataMap(
      worldStateData.Invasions,
      invasionsData.invasions
    );

    // Find invasions that are NOT on duplicateNode (unique nodes)
    const uniqueNodeInvasions = invasionsData.invasions.filter(
      (inv: any) => inv.node !== duplicateNode
    );

    // All unique node invasions should NOT be marked as duplicate
    uniqueNodeInvasions.forEach((invasion: any) => {
      const extraData = extraDataMap[invasion.id];
      if (extraData) {
        expect(extraData.isDuplicate).toBe(false);
      }
    });
  });

  test('tracks node duplicates correctly across multiple nodes', () => {
    const extraDataMap = (window as any).buildInvasionExtraDataMap(
      worldStateData.Invasions,
      invasionsData.invasions
    );

    // Count how many entries in extraDataMap are marked as duplicates
    const duplicateCount = Object.values(extraDataMap).filter(
      (data: any) => data.isDuplicate === true
    ).length;

    // Count worldState invasions per node (only non-completed)
    const nodeCounts = new Map<string, number>();
    worldStateData.Invasions.forEach((wsInvasion: any) => {
      if (wsInvasion.Completed) return;
      const node = wsInvasion.Node;
      nodeCounts.set(node, (nodeCounts.get(node) || 0) + 1);
    });

    // Calculate expected duplicates:
    // For each node with N invasions, (N-1) are duplicates
    // extraDataMap has one entry per worldState invasion
    // So expected duplicates = sum of (N-1) for all nodes with N > 1
    let expectedDuplicates = 0;
    nodeCounts.forEach((count) => {
      if (count > 1) {
        expectedDuplicates += (count - 1);
      }
    });

    expect(duplicateCount).toBe(expectedDuplicates);
  });

  test('isDuplicate flag persists in extraDataMap structure', () => {
    const extraDataMap = (window as any).buildInvasionExtraDataMap(
      worldStateData.Invasions,
      invasionsData.invasions
    );

    // Verify all extraData entries have the isDuplicate property
    Object.values(extraDataMap).forEach((extraData: any) => {
      expect(extraData).toHaveProperty('isDuplicate');
      expect(typeof extraData.isDuplicate).toBe('boolean');
    });
  });

  test('completed invasions are excluded from duplicate detection', () => {
    const extraDataMap = (window as any).buildInvasionExtraDataMap(
      worldStateData.Invasions,
      invasionsData.invasions
    );

    // Find completed invasions in worldState
    const completedInvasions = worldStateData.Invasions.filter(
      (ws: any) => ws.Completed === true
    );

    // Completed invasions should not appear in extraDataMap
    completedInvasions.forEach((wsInvasion: any) => {
      const invasionId = wsInvasion._id.$oid;
      expect(extraDataMap[invasionId]).toBeUndefined();
    });
  });
});
