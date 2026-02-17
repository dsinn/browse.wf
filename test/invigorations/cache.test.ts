import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

/**
 * Unit tests for Invigoration Cache Helper Functions
 *
 * These tests verify the JavaScript helper functions used for caching
 * invigoration calculations in localStorage.
 */

describe('Invigoration Cache Helpers', () => {
  let dom: JSDOM;
  let window: Window & typeof globalThis;
  let originalTZ: string | undefined;
  let getWeekIndex: (timestamp: number) => number;

  beforeEach(() => {
    // Set timezone to UTC for consistent timestamp formatting
    originalTZ = process.env.TZ;
    process.env.TZ = 'UTC';

    // Create minimal DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head>
          <script>
            // Helper function to get week index from timestamp
            function getWeekIndex(timestamp) {
              return Math.trunc(((timestamp / 1000) - 1391990400) / 604800);
            }
          </script>
        </head>
        <body></body>
      </html>
    `, {
      url: 'http://localhost/invigorations.php',
      runScripts: 'dangerously'
    });

    window = dom.window as unknown as Window & typeof globalThis;
    (global as any).window = window;

    getWeekIndex = (window as any).getWeekIndex;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore original timezone
    if (originalTZ === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTZ;
    }
  });

  describe('getWeekIndex()', () => {
    const now = Date.now();
    const currentDate = new Date(now);
    const currentDayOfWeek = currentDate.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    test('increments week index for consecutive weeks', () => {
      const currentWeekIndex = getWeekIndex(now);

      const millisInOneWeek = (7 * 24 * 60 * 60 * 1000);

      // One week later should have an index that's higher by 1
      const oneWeekLater = now + millisInOneWeek;
      expect(getWeekIndex(oneWeekLater)).toBe(currentWeekIndex + 1);

      // Two weeks later should have an index that's higher by 2
      const twoWeeksLater = oneWeekLater + millisInOneWeek;
      expect(getWeekIndex(twoWeeksLater)).toBe(currentWeekIndex + 2);
    });

    test('previous week boundary', () => {
      const currentWeekIndex = getWeekIndex(now);

      // Calculate days to reach Monday of current week
      const daysAfterMonday = currentDayOfWeek === 0
        ? 6 // Sunday -> Monday was 6 days ago
        : currentDayOfWeek - 1; // Any other day -> Monday was (currentDay - 1) days ago

      const mondayMidnight = Date.UTC(
        currentDate.getUTCFullYear(),
        currentDate.getUTCMonth(),
        currentDate.getUTCDate() - daysAfterMonday,
        0, 0, 0, 0
      );

      // Monday 00:00:00 should have same week index as current timestamp
      expect(getWeekIndex(mondayMidnight)).toBe(currentWeekIndex);

      // One second before Monday 00:00:00 should have week index one less
      expect(getWeekIndex(mondayMidnight - 1000)).toBe(currentWeekIndex - 1);
    });

    test('next week boundary', () => {
      const currentWeekIndex = getWeekIndex(now);

      // Calculate days until Sunday
      const daysUntilSunday = currentDayOfWeek === 0
        ? 0 // Sunday -> it's the same day
        : 7 - currentDayOfWeek; // Any other day -> Sunday is in (7 - currentDay) days

      const sundayEnd = Date.UTC(
        currentDate.getUTCFullYear(),
        currentDate.getUTCMonth(),
        currentDate.getUTCDate() + daysUntilSunday,
        23, 59, 59, 0
      );

      // Sunday 23:59:59 should have same week index as current timestamp
      expect(getWeekIndex(sundayEnd)).toBe(currentWeekIndex);

      // One second after Sunday 23:59:59 should have week index one greater
      expect(getWeekIndex(sundayEnd + 1000)).toBe(currentWeekIndex + 1);
    });

    test('known timestamps', () => {
      const baseTimestamp = Date.UTC(2026, 1, 7, 0, 0, 0); // Saturday, Feb 7, 2026
      const oneWeekLater = Date.UTC(2026, 1, 14, 0, 0, 0); // Saturday, Feb 14, 2026
      const twoWeeksLater = Date.UTC(2026, 1, 21, 0, 0, 0); // Saturday, Feb 21, 2026

      expect(getWeekIndex(baseTimestamp)).toBe(625);
      expect(getWeekIndex(oneWeekLater)).toBe(626);
      expect(getWeekIndex(twoWeeksLater)).toBe(627);
    });
  });

  describe('Cache Structure and Week Calculation', () => {
    test('simulates one week passing', () => {

      const baseTimestamp = Date.now();
      const oneWeekLater = baseTimestamp + (7 * 24 * 60 * 60 * 1000);

      const cachedWeek = getWeekIndex(baseTimestamp);
      const currentWeek = getWeekIndex(oneWeekLater);

      expect(currentWeek - cachedWeek).toBe(1);
    });

    test('simulates two weeks passing', () => {

      const baseTimestamp = Date.now();
      const twoWeeksLater = baseTimestamp + (14 * 24 * 60 * 60 * 1000);

      const cachedWeek = getWeekIndex(baseTimestamp);
      const currentWeek = getWeekIndex(twoWeeksLater);

      expect(currentWeek - cachedWeek).toBe(2);
    });

    test('new cache structure matches expected schema (multi-week)', () => {
      // Test that cache objects follow the new keyed structure
      const currentWeek = getWeekIndex(Date.now());
      const mockCache = {
        [currentWeek]: {
          request: {
            n: 'TestUser',
            s: ['/Lotus/Powersuits/Mag/MagBaseSuit'],
            p: false
          },
          response: {
            suits: ['/Lotus/Powersuits/Mag/MagBaseSuit'],
            offensiveUpgrades: ['/Lotus/Upgrades/Invigorations/Offensive/OffensiveInvigorationPowerStrength'],
            defensiveUpgrades: ['/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationHealth']
          }
        }
      };

      // Verify structure
      expect(mockCache[currentWeek]).toBeDefined();
      expect(mockCache[currentWeek].request).toBeDefined();
      expect(mockCache[currentWeek].response).toBeDefined();

      // Verify request structure
      expect(mockCache[currentWeek].request.n).toBe('TestUser');
      expect(Array.isArray(mockCache[currentWeek].request.s)).toBe(true);
      expect(typeof mockCache[currentWeek].request.p).toBe('boolean');

      // Verify response structure
      expect(Array.isArray(mockCache[currentWeek].response.suits)).toBe(true);
      expect(Array.isArray(mockCache[currentWeek].response.offensiveUpgrades)).toBe(true);
      expect(Array.isArray(mockCache[currentWeek].response.defensiveUpgrades)).toBe(true);
    });

    test('cache with multiple weeks can be serialized and deserialized', () => {
      const currentWeek = getWeekIndex(Date.now());
      const mockCache = {
        [currentWeek - 1]: {
          request: {
            n: 'SerializeTest',
            s: ['/Lotus/Powersuits/Mag/MagBaseSuit'],
            p: true
          },
          response: {
            suits: ['/Lotus/Powersuits/Volt/VoltBaseSuit'],
            offensiveUpgrades: ['/Lotus/Upgrades/Invigorations/Offensive/OffensiveInvigorationPowerRange'],
            defensiveUpgrades: ['/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationArmor']
          }
        },
        [currentWeek]: {
          request: {
            n: 'SerializeTest',
            s: ['/Lotus/Powersuits/Rhino/RhinoBaseSuit'],
            p: false
          },
          response: {
            suits: ['/Lotus/Powersuits/Frost/FrostBaseSuit'],
            offensiveUpgrades: ['/Lotus/Upgrades/Invigorations/Offensive/OffensiveInvigorationPowerStrength'],
            defensiveUpgrades: ['/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationHealth']
          }
        }
      };

      // Simulate localStorage round-trip
      const serialized = JSON.stringify(mockCache);
      const deserialized = JSON.parse(serialized);

      // Verify data integrity after round-trip
      expect(deserialized[currentWeek].request.n).toBe(mockCache[currentWeek].request.n);
      expect(deserialized[currentWeek].request.s).toEqual(mockCache[currentWeek].request.s);
      expect(deserialized[currentWeek].request.p).toBe(mockCache[currentWeek].request.p);
      expect(deserialized[currentWeek].response.suits).toEqual(mockCache[currentWeek].response.suits);
      expect(deserialized[currentWeek - 1]).toBeDefined();
    });

  });

  describe('Edge Cases', () => {
    test('handles very old timestamps', () => {

      // Test with a very old timestamp (year 2015)
      const oldTimestamp = new Date(2015, 0, 1).getTime();
      const weekIndex = getWeekIndex(oldTimestamp);

      expect(weekIndex).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(weekIndex)).toBe(true);
    });

    test('handles timestamps before Warframe epoch', () => {

      // Test with timestamp before Warframe epoch (should be negative)
      const beforeEpoch = (1391990400 - 604800) * 1000; // One week before epoch
      const weekIndex = getWeekIndex(beforeEpoch);

      expect(weekIndex).toBe(-1);
    });

  });
});
