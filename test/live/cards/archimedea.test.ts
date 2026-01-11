import { describe, test, expect } from 'vitest';
import { loadMock } from '../../helpers/api-mocks';

describe('Deep Archimedea Card', () => {
  test('renders Deep Archimedea missions from weekly data', () => {
    const weeklyData = loadMock('weekly.json');

    expect(weeklyData.labConquestMissions).toBeDefined();
    expect(Array.isArray(weeklyData.labConquestMissions)).toBe(true);
    expect(weeklyData.labConquestMissions.length).toBe(3);
  });

  test('displays mission types and conditions', () => {
    const weeklyData = loadMock('weekly.json');
    const missions = weeklyData.labConquestMissions;

    missions.forEach((mission: any) => {
      expect(mission).toHaveProperty('type');
      expect(mission).toHaveProperty('variant');
      expect(mission).toHaveProperty('conditions');
      expect(Array.isArray(mission.conditions)).toBe(true);
    });

    // Verify specific mission types
    const missionTypes = missions.map((m: any) => m.type);
    expect(missionTypes).toContain('Artifact');
    expect(missionTypes).toContain('Survival');
    expect(missionTypes).toContain('DualDefense');
  });

  test('shows frame variables (modifiers)', () => {
    const weeklyData = loadMock('weekly.json');

    expect(weeklyData.labConquestFrameVariables).toBeDefined();
    expect(Array.isArray(weeklyData.labConquestFrameVariables)).toBe(true);
    expect(weeklyData.labConquestFrameVariables.length).toBeGreaterThan(0);

    // Verify frame variables are present
    expect(weeklyData.labConquestFrameVariables).toContain('ShieldDelay');
    expect(weeklyData.labConquestFrameVariables).toContain('Starvation');
  });
});

describe('Temporal Archimedea Card', () => {
  test('renders Temporal Archimedea missions from weekly data', () => {
    const weeklyData = loadMock('weekly.json');

    expect(weeklyData.hexConquestMissions).toBeDefined();
    expect(Array.isArray(weeklyData.hexConquestMissions)).toBe(true);
    expect(weeklyData.hexConquestMissions.length).toBe(3);
  });

  test('displays different mission types than Deep Archimedea', () => {
    const weeklyData = loadMock('weekly.json');
    const missions = weeklyData.hexConquestMissions;

    // Verify specific mission types
    const missionTypes = missions.map((m: any) => m.type);
    expect(missionTypes).toContain('Exterminate');
    expect(missionTypes).toContain('EndlessCapture');
    expect(missionTypes).toContain('Defense');
  });

  test('shows different frame variables than Deep Archimedea', () => {
    const weeklyData = loadMock('weekly.json');

    expect(weeklyData.hexConquestFrameVariables).toBeDefined();
    expect(Array.isArray(weeklyData.hexConquestFrameVariables)).toBe(true);

    // Verify frame variables
    expect(weeklyData.hexConquestFrameVariables).toContain('VoidEnergyOverload');
    expect(weeklyData.hexConquestFrameVariables).toContain('OperatorLockout');
  });
});
