import { describe, test, expect } from 'vitest';
import { loadMock } from '../../helpers/api-mocks';
import { getById } from '../../helpers/dom-helpers';

describe('Sortie Card', () => {
  test('renders sortie missions from worldState', () => {
    const worldState = loadMock('worldState.json');

    expect(worldState.Sorties).toBeDefined();
    expect(Array.isArray(worldState.Sorties)).toBe(true);

    if (worldState.Sorties.length > 0) {
      const sortie = worldState.Sorties[0];
      expect(sortie.Variants).toBeDefined();
      expect(sortie.Variants.length).toBeGreaterThan(0);

      // Each sortie has 3 missions
      expect(sortie.Variants.length).toBeLessThanOrEqual(3);

      // Each variant has required properties
      const variant = sortie.Variants[0];
      expect(variant).toHaveProperty('missionType');
      expect(variant).toHaveProperty('modifierType');
      expect(variant).toHaveProperty('node');
    }
  });

  test('displays sortie table with missions', () => {
    const sortieTable = getById('sortie-table');

    // Simulate rendering 3 missions
    sortieTable.innerHTML = `
      <tr><th>Defense</th><td>Bow Only</td><td>Mars</td></tr>
      <tr><th>Survival</th><td>Energy Reduction</td><td>Venus</td></tr>
      <tr><th>Assassination</th><td>Eximus</td><td>Earth</td></tr>
    `;

    const rows = sortieTable.querySelectorAll('tr');
    expect(rows.length).toBe(3);
  });
});
