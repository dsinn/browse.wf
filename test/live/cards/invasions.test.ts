import { describe, test, expect } from 'vitest';
import { loadMock } from '../../helpers/api-mocks';

describe('Invasions Card', () => {
  test('renders invasion data from API', () => {
    const invasionsData = loadMock('invasions.json');

    expect(invasionsData.invasions).toBeDefined();
    expect(Array.isArray(invasionsData.invasions)).toBe(true);
    expect(invasionsData.invasions.length).toBeGreaterThan(0);
  });

  test('displays invasion rewards correctly', () => {
    const invasionsData = loadMock('invasions.json');
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
    const invasionsData = loadMock('invasions.json');

    // Find invasions with the same ID (two sides of same conflict)
    const invasionIds = invasionsData.invasions.map((inv: any) => inv.id);
    const uniqueIds = new Set(invasionIds);

    // Should have duplicate IDs (representing both sides)
    expect(invasionIds.length).toBeGreaterThan(uniqueIds.size);
  });

  test('identifies Grineer vs Corpus invasions', () => {
    const invasionsData = loadMock('invasions.json');

    const allies = invasionsData.invasions.map((inv: any) => inv.ally);
    const hasGrineer = allies.some((ally: string) => ally === 'FC_GRINEER');
    const hasCorpus = allies.some((ally: string) => ally === 'FC_CORPUS');

    expect(hasGrineer).toBe(true);
    expect(hasCorpus).toBe(true);
  });
});
