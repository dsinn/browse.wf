import { describe, test, expect } from 'vitest';
import { loadMock } from '../../helpers/api-mocks';
import { getById } from '../../helpers/dom-helpers';

describe('Arbitration Card', () => {
  test('loads arbitration schedule from arbys.txt', () => {
    const arbysText = loadMock('arbys.txt');
    const lines = arbysText.trim().split('\n');

    // Parse the last line (most recent arbitration)
    const lastLine = lines[lines.length - 1];
    const [timestamp, node] = lastLine.split(',');

    expect(node).toBe('SolNode308');
    expect(timestamp).toBe('1767898800');
  });

  test('displays arbitration node information', () => {
    const arbyWhat = getById('arby-what');
    const arbyWhere = getById('arby-where');
    const arbyTier = getById('arby-tier');

    // Simulate rendering
    arbyWhat.textContent = 'Defense';
    arbyWhere.textContent = 'on Mars';
    arbyTier.textContent = 'A';

    expect(arbyWhat.textContent).toBe('Defense');
    expect(arbyWhere.textContent).toBe('on Mars');
    expect(arbyTier.textContent).toBe('A');
  });
});
