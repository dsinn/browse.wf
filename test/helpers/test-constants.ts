/**
 * Shared constants for tests
 */

import process from 'node:process';

// Freeze time to when mock data was captured: 2026-01-10 12:00:00 UTC
// This ensures time-dependent calculations (expiry, countdowns) work with frozen mock data
export const MOCK_TIMESTAMP = 1_768_087_200_000;

export const TEST_FRONT_PROXY_BASE_URL = process.env.WARFRAME_API_FRONT_PROXY_BASE_URL || 'https://warframe-api-front-proxy.dsinn69.workers.dev';
