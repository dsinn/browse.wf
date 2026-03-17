import { describe, test, expect } from 'vitest';
import { loadMock, loadExportJson } from '../../helpers/api-mocks';
import { getById } from '../../helpers/dom-helpers';
import { formatTileset } from '../../../src/tileset-helpers';

describe('Sortie Card - Data Structure', () => {
  test('worldState contains sortie with three variants', () => {
    const worldState = loadMock('worldState.json');
    expect(Array.isArray(worldState.Sorties)).toBe(true);
    expect(worldState.Sorties.length).toBeGreaterThan(0);

    const sortie = worldState.Sorties[0];
    expect(Array.isArray(sortie.Variants)).toBe(true);
    expect(sortie.Variants.length).toBe(3);
  });

  test('each sortie variant has missionType, modifierType, node, and tileset', () => {
    const { Sorties } = loadMock('worldState.json');
    for (const variant of Sorties[0].Variants) {
      expect(variant).toHaveProperty('missionType');
      expect(variant).toHaveProperty('modifierType');
      expect(variant).toHaveProperty('node');
      expect(variant).toHaveProperty('tileset');
    }
  });

  test('sortie nodes exist in ExportRegions', () => {
    const { Sorties } = loadMock('worldState.json');
    const regions = loadExportJson('ExportRegions.json');
    for (const variant of Sorties[0].Variants) {
      expect(regions[variant.node], `Node ${variant.node} should exist in ExportRegions`).toBeTruthy();
    }
  });
});

describe('Sortie Card - DOM Structure', () => {
  test('sortie table element exists in fixture', () => {
    const table = getById('sortie-table');
    expect(table).toBeTruthy();
    expect(table.tagName).toBe('TABLE');
  });

  test('sortie header element exists in fixture', () => {
    const header = getById('sortie-header');
    expect(header).toBeTruthy();
  });
});

describe('Sortie Card - Tileset Tooltip Values', () => {
  // Matches worldState.json sortie data (validated in data structure tests)
  // SolNode301: OrokinMoonTilesetGrineer, SolNode122: GrineerOceanTileset, SolNode32: GrineerGalleonTileset
  const VARIANTS = [
    { node: 'SolNode301', tileset: 'OrokinMoonTilesetGrineer', expectedTooltip: 'Orokin Moon Grineer' },
    { node: 'SolNode122', tileset: 'GrineerOceanTileset', expectedTooltip: 'Grineer Ocean' },
    { node: 'SolNode32', tileset: 'GrineerGalleonTileset', expectedTooltip: 'Grineer Galleon' },
  ];

  for (const { node, tileset, expectedTooltip } of VARIANTS) {
    test(`${node} (${tileset}) formats to "${expectedTooltip}"`, () => {
      expect(formatTileset(tileset)).toBe(expectedTooltip);
    });
  }
});
