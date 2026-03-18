import {describe, test, expect} from 'vitest';
import {loadMock} from '../../helpers/api-mocks';
import {getById} from '../../helpers/dom-helpers';

describe('Bounties Card', () => {
	test('renders bounty rotation information', () => {
		const bountyCycle = loadMock('bounty-cycle.json');

		expect(bountyCycle.rot).toBe('C');
		expect(bountyCycle.vaultRot).toBe('B');
		expect(bountyCycle.expiry).toBeGreaterThan(0);
	});

	test('displays bounty rotation in DOM', () => {
		const bountyRot = getById('bounty-rot');
		const vaultRot = getById('vault-rot');

		const bountyCycle = loadMock('bounty-cycle.json');

		bountyRot.textContent = bountyCycle.rot;
		vaultRot.textContent = bountyCycle.vaultRot;

		expect(bountyRot.textContent).toBe('C');
		expect(vaultRot.textContent).toBe('B');
	});

	test('renders Zariman bounties from bounty-cycle', () => {
		const bountyCycle = loadMock('bounty-cycle.json');
		const zarimanBounties = bountyCycle.bounties.ZarimanSyndicate;

		expect(Array.isArray(zarimanBounties)).toBe(true);
		expect(zarimanBounties.length).toBe(5);

		// Each bounty should have node and challenge
		for (const bounty of zarimanBounties as any[]) {
			expect(bounty).toHaveProperty('node');
			expect(bounty).toHaveProperty('challenge');
			expect(bounty.node).toMatch(/^SolNode\d+$/u);
			expect(bounty.challenge).toMatch(/^\/Lotus\/Types\/Challenges\//u);
		}
	});

	test('renders Cavia bounties with correct structure', () => {
		const bountyCycle = loadMock('bounty-cycle.json');
		const caviaBounties = bountyCycle.bounties.EntratiLabSyndicate;

		expect(Array.isArray(caviaBounties)).toBe(true);
		expect(caviaBounties.length).toBe(5);

		// Verify first bounty structure
		const firstBounty = caviaBounties[0];
		expect(firstBounty.node).toBe('SolNode718');
		expect(firstBounty.challenge).toContain('EntratiLab');
	});

	test('renders Hex bounties with allies', () => {
		const bountyCycle = loadMock('bounty-cycle.json');
		const hexBounties = bountyCycle.bounties.HexSyndicate;

		expect(Array.isArray(hexBounties)).toBe(true);
		expect(hexBounties.length).toBeGreaterThan(0);

		// Most Hex bounties should have allies
		const bountiesWithAllies = hexBounties.filter((b: any) => b.ally);
		expect(bountiesWithAllies.length).toBeGreaterThan(0);

		// Verify ally format
		const bountyWithAlly = bountiesWithAllies[0];
		expect(bountyWithAlly.ally).toMatch(/^\/Lotus\/Types\/Gameplay/u);
	});
});
