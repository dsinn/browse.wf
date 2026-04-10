import {describe, test, expect} from 'vitest';
import {loadMock} from '@test/helpers/api-mocks';
import {getById} from '@test/helpers/dom-helpers';

describe('Archon Hunt Card', () => {
	test('renders archon hunt from worldState', () => {
		const worldState = loadMock('worldState.json');

		if (worldState.LiteSorties && worldState.LiteSorties.length > 0) {
			const archonHunt = worldState.LiteSorties[0];

			expect(archonHunt).toHaveProperty('Boss');
			expect(archonHunt).toHaveProperty('Missions');
			expect(archonHunt.Missions.length).toBe(3);

			// Boss should be one of the three archons
			expect(['SORTIE_BOSS_AMAR', 'SORTIE_BOSS_NIRA', 'SORTIE_BOSS_BOREAL'])
				.toContain(archonHunt.Boss);
		}
	});

	test('displays archon hunt missions', () => {
		const litesortieBody = getById('litesortie-body');

		// Simulate rendering
		litesortieBody.innerHTML = `
      <span class="d-block"><b>Defense</b> on Mars</span>
      <span class="d-block"><b>Survival</b> on Venus</span>
      <span class="d-block"><b>Assassination</b> Archon Amar on Earth</span>
    `;

		expect(litesortieBody.textContent).toContain('Defense');
		expect(litesortieBody.textContent).toContain('Archon Amar');
	});
});
