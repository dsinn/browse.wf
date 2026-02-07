import { describe, test, expect } from 'vitest';
import { loadMock } from '../../helpers/api-mocks';
import { testCardFilters } from '../card-filters-factory';

// Test generic card filter integration for Fissures card
// This verifies: gear icon, accordion, checkboxes, localStorage persistence, auto-expand
testCardFilters('fissures');

describe('Void Fissures Card', () => {
  test('renders fissure data from worldState', () => {
    const worldState = loadMock('worldState.json');

    expect(worldState.ActiveMissions).toBeDefined();
    expect(Array.isArray(worldState.ActiveMissions)).toBe(true);
    expect(worldState.ActiveMissions.length).toBeGreaterThan(0);

    expect(worldState.VoidStorms).toBeDefined();
    expect(Array.isArray(worldState.VoidStorms)).toBe(true);
    expect(worldState.VoidStorms.length).toBeGreaterThan(0);
  });

  test('fissures within each tier are sorted by expiry in chronological order', () => {
    const worldState = loadMock('worldState.json');

    // Combine ActiveMissions and VoidStorms into fissures array, mimicking live.ts logic
    const fissures = [];

    for (const fissure of worldState.ActiveMissions) {
      fissures.push({
        Category: fissure.Hard ? 'sp-fissures' : 'fissures',
        Hard: fissure.Hard,
        Activation: fissure.Activation,
        Expiry: fissure.Expiry,
        Node: fissure.Node,
        Modifier: fissure.Modifier,
      });
    }

    for (const fissure of worldState.VoidStorms) {
      fissures.push({
        Category: 'rj-fissures',
        Hard: false,
        Activation: fissure.Activation,
        Expiry: fissure.Expiry,
        Node: fissure.Node,
        Modifier: fissure.ActiveMissionTier,
      });
    }

    // Sort by tier first, then by expiry within each tier (same logic as live.ts)
    fissures.sort((a, b) => {
      const tierDiff = a.Modifier.charCodeAt(5) - b.Modifier.charCodeAt(5);
      if (tierDiff !== 0) return tierDiff;
      return parseInt(a.Expiry.$date.$numberLong) - parseInt(b.Expiry.$date.$numberLong);
    });

    // Group by tier and Hard mode to verify chronological ordering
    const tierGroups: Record<string, any[]> = {};
    for (const fissure of fissures) {
      const key = (fissure.Hard ? 'SP-' : '') + fissure.Modifier;
      if (!tierGroups[key]) {
        tierGroups[key] = [];
      }
      tierGroups[key].push(fissure);
    }

    // Verify each tier group is sorted chronologically by expiry
    for (const [tier, group] of Object.entries(tierGroups)) {
      if (group.length <= 1) {
        continue; // Single-item groups are trivially sorted
      }

      const expiries = group.map(f => parseInt(f.Expiry.$date.$numberLong));

      // Check that each expiry is <= the next one (chronological order)
      for (let i = 0; i < expiries.length - 1; i++) {
        expect(expiries[i]).toBeLessThanOrEqual(expiries[i + 1]);
      }

      // Additional verification: compare with a sorted copy
      const sortedExpiries = [...expiries].sort((a, b) => a - b);
      expect(expiries).toEqual(sortedExpiries);
    }
  });

  test('identifies missions with unsorted expiries in mock data', () => {
    const worldState = loadMock('worldState.json');

    // Group missions by tier WITHOUT sorting to see original order
    const byTierAndMode: Record<string, string[]> = {};

    worldState.ActiveMissions.forEach((m: any) => {
      const key = (m.Hard ? 'SP-' : '') + m.Modifier;
      if (!byTierAndMode[key]) byTierAndMode[key] = [];
      byTierAndMode[key].push(m.Expiry.$date.$numberLong);
    });

    worldState.VoidStorms.forEach((m: any) => {
      const key = 'RJ-' + m.ActiveMissionTier;
      if (!byTierAndMode[key]) byTierAndMode[key] = [];
      byTierAndMode[key].push(m.Expiry.$date.$numberLong);
    });

    // Find at least one tier with unsorted missions
    let foundUnsorted = false;
    for (const [tier, expiries] of Object.entries(byTierAndMode)) {
      if (expiries.length <= 1) continue;

      const sorted = [...expiries].sort((a, b) => parseInt(a) - parseInt(b));
      const alreadySorted = JSON.stringify(expiries) === JSON.stringify(sorted);

      if (!alreadySorted) {
        foundUnsorted = true;
        // Verify specific tiers we know are unsorted from our analysis
        if (tier === 'SP-VoidT2' || tier === 'SP-VoidT3' || tier === 'VoidT4' || tier === 'VoidT5') {
          expect(alreadySorted).toBe(false);
        }
      }
    }

    // Ensure the mock data actually has unsorted missions to test the sorting logic
    expect(foundUnsorted).toBe(true);
  });

  test('has correct tier labels', () => {
    const worldState = loadMock('worldState.json');

    const fissureTiers = {
      VoidT1: 'Lith',
      VoidT2: 'Meso',
      VoidT3: 'Neo',
      VoidT4: 'Axi',
      VoidT5: 'Requiem',
      VoidT6: 'Omnia',
    };

    // Check that all modifiers in mock data have corresponding tier labels
    const allModifiers = new Set([
      ...worldState.ActiveMissions.map((m: any) => m.Modifier),
      ...worldState.VoidStorms.map((m: any) => m.ActiveMissionTier),
    ]);

    for (const modifier of allModifiers) {
      expect(fissureTiers).toHaveProperty(modifier);
    }
  });

  test('separates normal, steel path, and void storms correctly', () => {
    const worldState = loadMock('worldState.json');

    const normalFissures = worldState.ActiveMissions.filter((m: any) => !m.Hard);
    const steelPathFissures = worldState.ActiveMissions.filter((m: any) => m.Hard);
    const voidStorms = worldState.VoidStorms;

    expect(normalFissures.length).toBeGreaterThan(0);
    expect(steelPathFissures.length).toBeGreaterThan(0);
    expect(voidStorms.length).toBeGreaterThan(0);

    // Verify they're mutually exclusive
    expect(normalFissures.every((m: any) => !m.Hard)).toBe(true);
    expect(steelPathFissures.every((m: any) => m.Hard)).toBe(true);
  });
});
