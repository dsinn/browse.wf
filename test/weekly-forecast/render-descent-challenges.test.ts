/**
 * Unit tests for renderDescentChallenges() exported from src/descendia.ts
 *
 * Loads the real compiled production code to avoid test drift.
 */
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { loadScript, mockBootstrapTooltip } from '../helpers/dom-helpers';
import { loadMock } from '../helpers/api-mocks';

beforeEach(() => {
  // Known arenas render an emoji span with a Bootstrap tooltip.
  mockBootstrapTooltip();
  loadScript('typestripped/src/descendia.js');
});

afterEach(() => {
  delete (window as any).updateDescendia;
  delete (window as any).renderDescentChallenges;
});

describe('renderDescentChallenges', () => {
  const worldState = loadMock('worldState.json');
  const dict = loadMock('dicts/en.json');

  test('is exposed as a global function', () => {
    expect(typeof (window as any).renderDescentChallenges).toBe('function');
  });

  test('returns a <tbody> element', () => {
    const descent = worldState.Descents[0];
    const tbody = (window as any).renderDescentChallenges(descent, dict);
    expect(tbody.nodeName).toBe('TBODY');
  });

  test('renders one row per challenge (21 rows)', () => {
    const descent = worldState.Descents[0];
    const tbody = (window as any).renderDescentChallenges(descent, dict) as HTMLTableSectionElement;
    expect(tbody.querySelectorAll('tr').length).toBe(21);
  });

  test('each row has 6 columns', () => {
    const descent = worldState.Descents[0];
    const tbody = (window as any).renderDescentChallenges(descent, dict) as HTMLTableSectionElement;

    tbody.querySelectorAll('tr').forEach((tr: Element) => {
      expect(tr.querySelectorAll('td').length).toBe(6);
    });
  });

  test('level column (col 1) shows the challenge Index value', () => {
    const descent = worldState.Descents[0];
    const tbody = (window as any).renderDescentChallenges(descent, dict) as HTMLTableSectionElement;
    const rows = tbody.querySelectorAll('tr');

    descent.Challenges.forEach((challenge: any, i: number) => {
      const levelCell = rows[i].querySelectorAll('td')[0];
      expect(levelCell.textContent).toBe(String(challenge.Index));
    });
  });

  test('arena column strips .level suffix', () => {
    const descent = worldState.Descents[0];
    const tbody = (window as any).renderDescentChallenges(descent, dict) as HTMLTableSectionElement;

    tbody.querySelectorAll('tr').forEach((tr: Element) => {
      const arenaCell = tr.querySelectorAll('td')[3];
      expect(arenaCell.textContent).not.toMatch(/\.level$/i);
    });
  });

  test('known arenas render an emoji span with a tooltip', () => {
    const descent = worldState.Descents[0];
    const tbody = (window as any).renderDescentChallenges(descent, dict) as HTMLTableSectionElement;

    // All arenas in the mock data are known, so every arena cell should have a <span>
    tbody.querySelectorAll('tr').forEach((tr: Element) => {
      const arenaCell = tr.querySelectorAll('td')[3];
      const span = arenaCell.querySelector('span');
      expect(span).not.toBeNull();
      expect(span!.getAttribute('data-bs-toggle')).toBe('tooltip');
      expect(span!.getAttribute('data-bs-title')).toBeTruthy();
    });
  });

  test('arena tooltip title is the internal arena key (no path separators or .level)', () => {
    const descent = worldState.Descents[0];
    const tbody = (window as any).renderDescentChallenges(descent, dict) as HTMLTableSectionElement;

    tbody.querySelectorAll('tr').forEach((tr: Element) => {
      const title = tr.querySelectorAll('td')[3].querySelector('span')!.getAttribute('data-bs-title')!;
      expect(title).not.toContain('/');
      expect(title).not.toMatch(/\.level$/i);
    });
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
    const tbody = (window as any).renderDescentChallenges(unknownDescent, {}) as HTMLTableSectionElement;
    const arenaCell = tbody.querySelector('tr')!.querySelectorAll('td')[3];
    expect(arenaCell.querySelector('span')).toBeNull();
    expect(arenaCell.textContent).toBe('ArenaUnknownXYZ');
  });

  test('specs column shows "-" when Specs is empty', () => {
    const descent = worldState.Descents[0];
    const emptySpecsChallenge = descent.Challenges.find((c: any) => !c.Specs || c.Specs.length === 0);
    expect(emptySpecsChallenge).toBeDefined();

    const tbody = (window as any).renderDescentChallenges(descent, dict) as HTMLTableSectionElement;
    const rows = tbody.querySelectorAll('tr');
    const idx = descent.Challenges.indexOf(emptySpecsChallenge);
    expect(rows[idx].querySelectorAll('td')[4].textContent).toBe('-');
  });

  test('auras column shows "-" when Auras is empty', () => {
    const descent = worldState.Descents[0];
    const emptyAurasChallenge = descent.Challenges.find((c: any) => !c.Auras || c.Auras.length === 0);
    expect(emptyAurasChallenge).toBeDefined();

    const tbody = (window as any).renderDescentChallenges(descent, dict) as HTMLTableSectionElement;
    const rows = tbody.querySelectorAll('tr');
    const idx = descent.Challenges.indexOf(emptyAurasChallenge);
    expect(rows[idx].querySelectorAll('td')[5].textContent).toBe('-');
  });

  test('works for any descent in the Descents array (not just first)', () => {
    // Run against all 6 descents to verify none throw
    for (const descent of worldState.Descents) {
      const tbody = (window as any).renderDescentChallenges(descent, dict) as HTMLTableSectionElement;
      expect(tbody.querySelectorAll('tr').length).toBe(21);
    }
  });

  test('falls back to raw path tail when dict key is missing', () => {
    // Pass an empty dict so nothing gets translated
    const descent = worldState.Descents[0];
    const tbody = (window as any).renderDescentChallenges(descent, {}) as HTMLTableSectionElement;

    // Challenge column (col 3) should still have non-empty text (raw value)
    const rows = tbody.querySelectorAll('tr');
    rows.forEach((tr: Element) => {
      const challengeCell = tr.querySelectorAll('td')[2];
      expect(challengeCell.textContent!.length).toBeGreaterThan(0);
    });
  });
});
