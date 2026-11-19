import {describe, it, expect} from 'vitest';
import {calcSyndicateRankPct, appendSyndicateProgressBar} from './syndicate-addons';

describe('calcSyndicateRankPct', () => {
	describe('positive ranks', () => {
		it('returns 0 at the bottom of a rank', () => {
			expect(calcSyndicateRankPct(240_000, 240_000, 372_000, 5)).toBe(0);
		});

		it('returns 100 at the top of a rank', () => {
			expect(calcSyndicateRankPct(372_000, 240_000, 372_000, 5)).toBe(100);
		});

		it('returns the correct mid-rank percentage', () => {
			// ArbitersSyndicate rank 5: standing 342304, min 240000, max 372000 → 78%
			expect(calcSyndicateRankPct(342_304, 240_000, 372_000, 5)).toBe(78);
		});

		it('clamps to 0 when standing is below rankMin', () => {
			expect(calcSyndicateRankPct(230_000, 240_000, 372_000, 5)).toBe(0);
		});

		it('clamps to 100 when standing exceeds rankMax', () => {
			expect(calcSyndicateRankPct(400_000, 240_000, 372_000, 5)).toBe(100);
		});
	});

	describe('negative ranks', () => {
		it('returns 100 (fully red) at the rank floor', () => {
			// Rank -2: standing at minimum → fully filled
			expect(calcSyndicateRankPct(-71_000, -71_000, -27_000, -2)).toBe(100);
		});

		it('returns the correct partial fill mid-rank', () => {
			// Formula uses standing/rankMin; at rankMax (-27000/-71000) ≈ 38%
			expect(calcSyndicateRankPct(-27_001, -71_000, -27_000, -2)).toBe(38);
		});

		it('clamps to 100 for standing below rankMin', () => {
			expect(calcSyndicateRankPct(-80_000, -71_000, -27_000, -2)).toBe(100);
		});
	});

	describe('LibrarySyndicate (hardcoded 0–125,000 range)', () => {
		it('returns 0 at standing 0', () => {
			expect(calcSyndicateRankPct(0, 0, 125_000, 0)).toBe(0);
		});

		it('returns 100 at standing 125,000', () => {
			expect(calcSyndicateRankPct(125_000, 0, 125_000, 0)).toBe(100);
		});

		it('returns the correct percentage for demo profile standing', () => {
			// [DE]Rebecca: standing 11829 → 9%
			expect(calcSyndicateRankPct(11_829, 0, 125_000, 0)).toBe(9);
		});
	});
});

describe('appendSyndicateProgressBar', () => {
	const title = {minStanding: 240_000, maxStanding: 372_000};

	it('appends a progress bar to the body element', () => {
		const body = document.createElement('div');
		appendSyndicateProgressBar(body, 'ArbitersSyndicate', 342_304, 5, title);
		expect(body.querySelector('.progress')).not.toBeNull();
		expect(body.querySelector('.progress-bar')).not.toBeNull();
	});

	it('sets the correct width on the progress bar', () => {
		const body = document.createElement('div');
		appendSyndicateProgressBar(body, 'ArbitersSyndicate', 342_304, 5, title);
		const bar = body.querySelector<HTMLElement>('.progress-bar');
		expect(bar?.style.width).toBe('78%');
	});

	it('uses bg-danger for negative ranks', () => {
		const body = document.createElement('div');
		appendSyndicateProgressBar(body, 'PerrinSyndicate', -71_000, -2, {minStanding: -71_000, maxStanding: -27_000});
		expect(body.querySelector('.progress-bar')?.className).toContain('bg-danger');
	});

	it('does not use bg-danger for positive ranks', () => {
		const body = document.createElement('div');
		appendSyndicateProgressBar(body, 'ArbitersSyndicate', 342_304, 5, title);
		expect(body.querySelector('.progress-bar')?.className).not.toContain('bg-danger');
	});

	it('does nothing for KahlSyndicate (Garrison)', () => {
		const body = document.createElement('div');
		appendSyndicateProgressBar(body, 'KahlSyndicate', 5, 5, {minStanding: 4, maxStanding: 5});
		expect(body.querySelector('.progress')).toBeNull();
	});
});
