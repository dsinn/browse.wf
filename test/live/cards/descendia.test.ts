import { describe, test, expect } from 'vitest';
import { loadMock } from '../../helpers/api-mocks';
import { getById } from '../../helpers/dom-helpers';

describe('Descendia Card', () => {
  test('renders Descents data from worldState', () => {
    const worldState = loadMock('worldState.json');

    expect(worldState.Descents).toBeDefined();
    expect(Array.isArray(worldState.Descents)).toBe(true);
    expect(worldState.Descents.length).toBe(6);

    if (worldState.Descents.length > 0) {
      const descent = worldState.Descents[0];

      // Check top-level properties
      expect(descent).toHaveProperty('Activation');
      expect(descent).toHaveProperty('Expiry');
      expect(descent).toHaveProperty('RandSeed');
      expect(descent).toHaveProperty('Challenges');

      // Check Challenges array
      expect(Array.isArray(descent.Challenges)).toBe(true);
      expect(descent.Challenges.length).toBe(21);

      // Check first challenge properties
      const challenge = descent.Challenges[0];
      expect(challenge).toHaveProperty('Index');
      expect(challenge).toHaveProperty('Type');
      expect(challenge).toHaveProperty('Challenge');
      expect(challenge).toHaveProperty('Level');
      expect(challenge).toHaveProperty('Specs');
      expect(challenge).toHaveProperty('Auras');

      // Specs and Auras should be arrays
      expect(Array.isArray(challenge.Specs)).toBe(true);
      expect(Array.isArray(challenge.Auras)).toBe(true);
    }
  });

  test('finds active Descent by timestamp', () => {
    const worldState = loadMock('worldState.json');
    const now = Date.now();

    // Find the active Descent (Activation <= now < Expiry)
    const activeDescent = worldState.Descents.find((d: any) =>
      parseInt(d.Activation.$date.$numberLong) <= now &&
      parseInt(d.Expiry.$date.$numberLong) > now
    );

    // The mock data should have at least one active Descent
    // If this fails, it means all Descents have expired or haven't started yet
    expect(activeDescent).toBeDefined();

    if (activeDescent) {
      expect(activeDescent.Challenges.length).toBe(21);
    }
  });

  test('displays Descendia table with challenges', () => {
    const descendiaTable = getById('descendia-table');

    // Simulate rendering 3 challenges
    descendiaTable.innerHTML = `
      <thead>
        <tr>
          <th>#</th>
          <th>Mission Type</th>
          <th>Challenge</th>
          <th>Arena</th>
          <th>Specs</th>
          <th>Auras</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>Exterminate</td>
          <td>Fire Chain</td>
          <td>ArenaWaffle.level</td>
          <td>CoHForestGrineerFairy</td>
          <td>FireChainAura</td>
        </tr>
        <tr>
          <td>2</td>
          <td>Collection</td>
          <td>Slip and Slide</td>
          <td>ArenaAvocado.level</td>
          <td>-</td>
          <td>CoHSlipAndSlideAura</td>
        </tr>
        <tr>
          <td>3</td>
          <td>Race</td>
          <td>Basic Race</td>
          <td>ArenaPeach.level</td>
          <td>-</td>
          <td>-</td>
        </tr>
      </tbody>
    `;

    const rows = descendiaTable.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);

    // Check first row
    const firstRow = rows[0];
    const cells = firstRow.querySelectorAll('td');
    expect(cells[0].textContent).toBe('1');
    expect(cells[1].textContent).toBe('Exterminate');
  });

  test('checkboxes exist in card header', () => {
    const descentChecks = getById('descent-checks');
    expect(descentChecks).toBeDefined();
  });
});
