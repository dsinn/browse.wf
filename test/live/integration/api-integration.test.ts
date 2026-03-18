import {describe, test, expect} from 'vitest';
import {loadMock} from '../../helpers/api-mocks';

describe('API Integration', () => {
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
		expect(bountyCycle.expiry).toBeGreaterThan(Date.now() - 86_400_000); // Within last 24h or future
	});
});
