import { describe, test, expect } from 'vitest';
import { loadMock } from '../../helpers/api-mocks';

describe('API Integration', () => {
  test('min API returns expected metadata', () => {
    const minData = loadMock('min.json');

    expect(minData).toHaveProperty('version');
    expect(minData).toHaveProperty('latestEvent');
    expect(minData).toHaveProperty('latestRedtext');
    expect(minData).toHaveProperty('darvoSold');
    expect(minData).toHaveProperty('invasions');
    expect(minData).toHaveProperty('alerts');
    expect(minData).toHaveProperty('goals');
    expect(minData).toHaveProperty('fissures');

    // Verify numeric values
    expect(typeof minData.darvoSold).toBe('number');
    expect(minData.darvoSold).toBe(61);
    expect(minData.invasions).toBe(6);
  });

  test('worldState contains all required game data', () => {
    const worldState = loadMock('worldState.json');

    expect(worldState).toHaveProperty('DailyDeals');
    expect(worldState).toHaveProperty('Sorties');
    expect(worldState).toHaveProperty('LiteSorties');
    expect(worldState).toHaveProperty('ActiveMissions');

    // Verify arrays
    expect(Array.isArray(worldState.DailyDeals)).toBe(true);
    expect(Array.isArray(worldState.Sorties)).toBe(true);
  });

  test('bounty-cycle has expiry timestamp', () => {
    const bountyCycle = loadMock('bounty-cycle.json');

    expect(bountyCycle.expiry).toBeDefined();
    expect(typeof bountyCycle.expiry).toBe('number');
    expect(bountyCycle.expiry).toBeGreaterThan(Date.now() - 86400000); // Within last 24h or future
  });
});
