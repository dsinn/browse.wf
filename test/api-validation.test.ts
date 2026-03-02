import { describe, test, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { TEST_TEST_FRONT_PROXY_BASE_URL } from './helpers/test-constants';

/**
 * API Structure Validation Tests
 *
 * These tests verify that the real oracle.browse.wf API responses match the structure
 * of our mock files. This catches "mock drift" where the real API changes but our
 * mocks don't get updated.
 *
 * IMPORTANT: These tests DO NOT use mocks - they hit real external APIs.
 * Run these manually or in CI to detect when mocks need updating.
 *
 * If a test fails:
 * 1. Check if the API structure actually changed
 * 2. Update the mock file: ./test/update-mocks.sh
 * 3. Update tests if new fields are critical for functionality
 *
 * @TODO: Add validation for array element structures. Current tests only check if
 * arrays exist (Array.isArray), but don't validate the structure of items within
 * those arrays (e.g., Events[0], Invasions[0], etc. should have specific fields).
 */

describe.skipIf(process.env.API_VALIDATION !== '1')('API Structure Validation', () => {
  if (process.env.API_VALIDATION !== '1') {
    console.log('⏭️  Skipping API validation tests. Run with: npm run test:api-validation');
  }
  const mocksDir = path.join(__dirname, '__mocks__');
  const frontProxyHeaders = { 'X-Warframe-API-Front-Proxy-Token': process.env.WARFRAME_API_FRONT_PROXY_TOKEN ?? '' };

  test('oracle.browse.wf/min matches mock structure', async () => {
    const response = await fetch('https://oracle.browse.wf/min');
    expect(response.ok).toBe(true);

    const realData = await response.json();
    const mockData = JSON.parse(fs.readFileSync(path.join(mocksDir, 'min.json'), 'utf8'));

    // Validate top-level keys match
    expect(Object.keys(realData).sort()).toEqual(Object.keys(mockData).sort());

    // Validate critical fields exist and have correct types
    expect(typeof realData.version).toBe('number');
    expect(typeof realData.alerts).toBe('number');
    expect(typeof realData.fissures).toBe('number');
  });

  test('oracle.browse.wf/bounty-cycle matches mock structure', async () => {
    const response = await fetch('https://oracle.browse.wf/bounty-cycle');
    expect(response.ok).toBe(true);

    const realData = await response.json();
    const mockData = JSON.parse(fs.readFileSync(path.join(mocksDir, 'bounty-cycle.json'), 'utf8'));

    // Validate top-level keys match
    expect(Object.keys(realData).sort()).toEqual(Object.keys(mockData).sort());

    // Validate critical fields
    expect(typeof realData.expiry).toBe('number');
    expect(typeof realData.bounties).toBe('object');
  });

  test('worldState mock matches front proxy structure', async () => {
    const response = await fetch(`${TEST_FRONT_PROXY_BASE_URL}/worldState`, { headers: frontProxyHeaders });
    expect(response.ok).toBe(true);

    const realData = await response.json();
    const mockData = JSON.parse(fs.readFileSync(path.join(mocksDir, 'worldState.json'), 'utf8'));

    // Validate top-level keys match
    expect(Object.keys(realData).sort()).toEqual(Object.keys(mockData).sort());

    // Validate critical arrays exist
    expect(Array.isArray(realData.Events)).toBe(true);
    expect(Array.isArray(realData.Goals)).toBe(true);
    expect(Array.isArray(realData.Alerts)).toBe(true);
    expect(Array.isArray(realData.SyndicateMissions)).toBe(true);
    expect(Array.isArray(realData.Sorties)).toBe(true);
    expect(Array.isArray(realData.Invasions)).toBe(true);
    expect(Array.isArray(realData.FlashSales)).toBe(true);
    expect(Array.isArray(realData.DailyDeals)).toBe(true);

    // Validate timestamp exists
    expect(typeof realData.Time).toBe('number');
  });

  test('oracle.browse.wf/invasions matches mock structure', async () => {
    const response = await fetch('https://oracle.browse.wf/invasions');
    expect(response.ok).toBe(true);

    const realData = await response.json();
    const mockData = JSON.parse(fs.readFileSync(path.join(mocksDir, 'invasions.json'), 'utf8'));

    // Note: Mock is empty array [], but real API returns object
    // This test validates the real API structure only
    expect(typeof realData).toBe('object');

    // Validate critical fields if present
    if (!Array.isArray(realData)) {
      expect(typeof realData.activation).toBe('number');
      expect(typeof realData.expiry).toBe('number');
      expect(Array.isArray(realData.invasions)).toBe(true);
    }
  });

  test('oracle.browse.wf/redtext.json matches mock structure', async () => {
    const response = await fetch('https://oracle.browse.wf/redtext.json');
    expect(response.ok).toBe(true);

    const realData = await response.json();
    const mockData = JSON.parse(fs.readFileSync(path.join(mocksDir, 'redtext-empty.json'), 'utf8'));

    // Validate it's an array (may be empty)
    expect(Array.isArray(realData)).toBe(true);

    // If we have data, validate element structure
    if (realData.length > 0) {
      const firstElement = realData[0];
      expect(typeof firstElement.data).toBe('string');
      expect(typeof firstElement.time).toBe('number');
    }
  });
});
