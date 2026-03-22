/**
 * Unit tests for renderDescentChallenges() exported from src/descendia.ts
 *
 * Imports the real production code directly to avoid test drift.
 */
import {
	describe, test, expect, beforeEach,
} from 'vitest';
import {mockBootstrapTooltip} from '../helpers/dom-helpers';
import {loadMock} from '../helpers/api-mocks';
import {renderDescentChallenges} from '../../src/descendia';

beforeEach(() => {
	// Known arenas render an emoji span with a Bootstrap tooltip.
	mockBootstrapTooltip();
});

describe('renderDescentChallenges', () => {
	const worldState = loadMock('worldState.json');
	const dict = loadMock('dicts/en.json');

	test('returns a <tbody> element', () => {
		const descent = worldState.Descents[0];
		const tbody = renderDescentChallenges(descent, dict);
		expect(tbody.nodeName).toBe('TBODY');
	});

	test('renders one row per challenge (21 rows)', () => {
		const descent = worldState.Descents[0];
		const tbody = renderDescentChallenges(descent, dict);
		expect(tbody.querySelectorAll('tr').length).toBe(21);
	});

	test('each row has 5 columns', () => {
		const descent = worldState.Descents[0];
		const tbody = renderDescentChallenges(descent, dict);

		for (const tr of tbody.querySelectorAll('tr')) {
			expect(tr.querySelectorAll('td').length).toBe(5);
		}
	});

	test('level column (col 1) shows the challenge Index value', () => {
		const descent = worldState.Descents[0];
		const tbody = renderDescentChallenges(descent, dict);
		const rows = tbody.querySelectorAll('tr');

		for (const [i, challenge] of (descent.Challenges as any[]).entries()) {
			const levelCell = rows[i].querySelectorAll('td')[0];
			expect(levelCell.textContent).toBe(String(challenge.Index));
		}
	});

	test('arena column strips .level suffix', () => {
		const descent = worldState.Descents[0];
		const tbody = renderDescentChallenges(descent, dict);

		for (const tr of tbody.querySelectorAll('tr')) {
			const arenaCell = tr.querySelectorAll('td')[3];
			expect(arenaCell.textContent).not.toMatch(/\.level$/iu);
		}
	});

	test('known arenas render an emoji span with a tooltip', () => {
		const descent = worldState.Descents[0];
		const tbody = renderDescentChallenges(descent, dict);

		// All arenas in the mock data are known, so every arena cell should have a <span>
		for (const tr of tbody.querySelectorAll('tr')) {
			const arenaCell = tr.querySelectorAll('td')[3];
			const span = arenaCell.querySelector<HTMLElement>('span');
			expect(span).not.toBeNull();
			expect(span!.dataset.bsToggle).toBe('tooltip');
			expect(span!.dataset.bsTitle).toBeTruthy();
		}
	});

	test('arena tooltip title is the internal arena key (no path separators or .level)', () => {
		const descent = worldState.Descents[0];
		const tbody = renderDescentChallenges(descent, dict);

		for (const tr of tbody.querySelectorAll('tr')) {
			const title = tr.querySelectorAll('td')[3].querySelector<HTMLElement>('span')!.dataset.bsTitle;
			expect(title).not.toContain('/');
			expect(title).not.toMatch(/\.level$/iu);
		}
	});

	test('unknown arenas fall back to plain text', () => {
		// Construct a descent with an unrecognised arena key
		const descent = worldState.Descents[0];
		const unknownDescent = {
			...descent,
			Challenges: [{
				...descent.Challenges[0],
				Level: '/Lotus/Levels/Proc/Descendia/ArenaUnknownXYZ.level',
			}],
		};
		const tbody = renderDescentChallenges(unknownDescent, {});
		const arenaCell = tbody.querySelector('tr')!.querySelectorAll('td')[3];
		expect(arenaCell.querySelector('span')).toBeNull();
		expect(arenaCell.textContent).toBe('ArenaUnknownXYZ');
	});

	test('specs & auras column shows "-" when both Specs and Auras are empty', () => {
		const descent = worldState.Descents[0];
		const emptyBothChallenge = descent.Challenges.find((c: any) =>
			(!c.Specs || c.Specs.length === 0) && (!c.Auras || c.Auras.length === 0));
		expect(emptyBothChallenge).toBeDefined();

		const tbody = renderDescentChallenges(descent, dict);
		const rows = tbody.querySelectorAll('tr');
		const idx = descent.Challenges.indexOf(emptyBothChallenge);
		expect(rows[idx].querySelectorAll('td')[4].textContent).toBe('\u2014');
	});

	test('specs & auras column uses middot separator between spec and aura values', () => {
		const descent = worldState.Descents[0];
		// Find a challenge that has both specs and auras
		const bothChallenge = descent.Challenges.find((c: any) =>
			c.Specs && c.Specs.length > 0 && c.Auras && c.Auras.length > 0);
		if (!bothChallenge) {
			return; // Skip if mock data lacks a row with both
		}

		const tbody = renderDescentChallenges(descent, dict);
		const rows = tbody.querySelectorAll('tr');
		const idx = descent.Challenges.indexOf(bothChallenge);
		const cell = rows[idx].querySelectorAll('td')[4];
		expect(cell.textContent).toContain('\u00A0\u00B7');
	});

	test('works for any descent in the Descents array (not just first)', () => {
		// Run against all 6 descents to verify none throw
		for (const descent of worldState.Descents) {
			const tbody = renderDescentChallenges(descent, dict);
			expect(tbody.querySelectorAll('tr').length).toBe(21);
		}
	});

	test('falls back to raw path tail when dict key is missing', () => {
		// Pass an empty dict so nothing gets translated
		const descent = worldState.Descents[0];
		const tbody = renderDescentChallenges(descent, {});

		// Challenge column (col 3) should still have non-empty text (raw value)
		const rows = tbody.querySelectorAll('tr');
		for (const tr of rows) {
			const challengeCell = tr.querySelectorAll('td')[2];
			expect(challengeCell.textContent.length).toBeGreaterThan(0);
		}
	});
});
