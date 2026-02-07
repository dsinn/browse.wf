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
  let formatTimestamp: (timestamp: number) => string;

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

            // Helper function to format timestamp
            function formatTimestamp(timestamp) {
              const date = new Date(timestamp);
              const options = {
                weekday: 'long',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              };
              return date.toLocaleString('en-US', options);
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

    // Assign helper functions for use in tests
    getWeekIndex = (window as any).getWeekIndex;
    formatTimestamp = (window as any).formatTimestamp;
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

  describe('formatTimestamp()', () => {
    test.each([
      {
        timestamp: Date.UTC(2026, 0, 15, 14, 30, 0),
        expected: 'Thursday, Jan 15, 2026, 02:30 PM',
        description: 'formats January date correctly'
      },
      {
        timestamp: Date.UTC(2026, 5, 20, 9, 15, 0),
        expected: 'Saturday, Jun 20, 2026, 09:15 AM',
        description: 'formats June date correctly'
      },
      {
        timestamp: Date.UTC(2025, 11, 31, 23, 59, 0),
        expected: 'Wednesday, Dec 31, 2025, 11:59 PM',
        description: 'formats end of year date correctly'
      }
    ])('$description', ({ timestamp, expected }) => {
      expect(formatTimestamp(timestamp)).toBe(expected);
    });
  });

  describe('Cache Structure and Week Calculation', () => {
    test('cache timestamp can accurately reconstruct week index', () => {

      // Simulate saving cache
      const saveTimestamp = Date.now();
      const savedWeekIndex = getWeekIndex(saveTimestamp);

      // Simulate loading cache later
      const loadTimestamp = Date.now();
      const loadWeekIndex = getWeekIndex(loadTimestamp);

      // Calculate week difference
      const weekDiff = loadWeekIndex - savedWeekIndex;

      // Should be 0 if same day
      expect(weekDiff).toBe(0);
    });

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

    test('cache structure matches expected schema', () => {
      // Test that cache objects follow the expected structure
      const mockCache = {
        request: {
          n: 'TestUser',
          s: ['/Lotus/Powersuits/Mag/MagBaseSuit'],
          p: false
        },
        response: {
          suits: ['/Lotus/Powersuits/Mag/MagBaseSuit'],
          offensiveUpgrades: ['/Lotus/Upgrades/Invigorations/Offensive/OffensiveInvigorationPowerStrength'],
          defensiveUpgrades: ['/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationHealth']
        },
        timestamp: Date.now()
      };

      // Verify required fields exist
      expect(mockCache.request).toBeDefined();
      expect(mockCache.response).toBeDefined();
      expect(mockCache.timestamp).toBeDefined();

      // Verify request structure
      expect(mockCache.request.n).toBe('TestUser');
      expect(Array.isArray(mockCache.request.s)).toBe(true);
      expect(typeof mockCache.request.p).toBe('boolean');

      // Verify response structure
      expect(Array.isArray(mockCache.response.suits)).toBe(true);
      expect(Array.isArray(mockCache.response.offensiveUpgrades)).toBe(true);
      expect(Array.isArray(mockCache.response.defensiveUpgrades)).toBe(true);

      // Verify timestamp is a number
      expect(typeof mockCache.timestamp).toBe('number');
      expect(mockCache.timestamp).toBeGreaterThan(0);
    });

    test('cache can be serialized and deserialized', () => {
      const mockCache = {
        request: {
          n: 'SerializeTest',
          s: ['/Lotus/Powersuits/Mag/MagBaseSuit'],
          p: true
        },
        response: {
          suits: ['/Lotus/Powersuits/Volt/VoltBaseSuit'],
          offensiveUpgrades: ['/Lotus/Upgrades/Invigorations/Offensive/OffensiveInvigorationPowerRange'],
          defensiveUpgrades: ['/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationArmor']
        },
        timestamp: Date.now()
      };

      // Simulate localStorage round-trip
      const serialized = JSON.stringify(mockCache);
      const deserialized = JSON.parse(serialized);

      // Verify data integrity after round-trip
      expect(deserialized.request.n).toBe(mockCache.request.n);
      expect(deserialized.request.s).toEqual(mockCache.request.s);
      expect(deserialized.request.p).toBe(mockCache.request.p);
      expect(deserialized.response.suits).toEqual(mockCache.response.suits);
      expect(deserialized.timestamp).toBe(mockCache.timestamp);
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

    test('formatTimestamp handles various dates', () => {

      // Test various dates
      const dates = [
        new Date(2026, 0, 1, 0, 0, 0).getTime(),     // New Year
        new Date(2026, 5, 15, 12, 30, 0).getTime(),  // Mid-year
        new Date(2026, 11, 31, 23, 59, 59).getTime() // End of year
      ];

      dates.forEach(timestamp => {
        const formatted = formatTimestamp(timestamp);
        expect(formatted).toBeTruthy();
        expect(typeof formatted).toBe('string');
        expect(formatted.length).toBeGreaterThan(0);
      });
    });
  });
});
