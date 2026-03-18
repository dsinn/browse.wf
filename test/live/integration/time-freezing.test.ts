import {describe, test, expect} from 'vitest';
import {MOCK_TIMESTAMP} from '../../helpers/time-helpers';

describe('Time Freezing', () => {
	test('Date.now() returns frozen timestamp for predictable tests', () => {
		// This ensures expiry calculations, countdowns, etc. work with frozen mock data
		expect(Date.now()).toBe(MOCK_TIMESTAMP); // 2026-01-10 12:00:00 UTC
	});

	test('new Date() creates date at frozen timestamp', () => {
		const now = new Date();
		expect(now.getTime()).toBe(MOCK_TIMESTAMP);
	});
});
