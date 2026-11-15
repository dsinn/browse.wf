import {test, expect} from '@playwright/test';
import {setupMockRoutes} from '../helpers/api-mocks';

test.describe('Live Page - Events Card', () => {
	test('goal with clan goals shows a tooltip listing each clan tier', async ({page}) => {
		await setupMockRoutes(page, {
			modifyWorldState(worldState) {
				worldState.Goals[0].ClanGoal = [72, 216, 648, 1944, 5832];
			},
		});
		await page.goto('/live');

		const goal = page.locator('#goals-body abbr[data-bs-toggle="tooltip"]');
		await expect(goal).toHaveCount(1);
		await goal.hover();

		const tooltip = page.locator('.tooltip-inner');
		await expect(tooltip).toBeVisible();
		expect(await tooltip.innerText()).toBe([
			'Clan Goals',
			'Ghost: 72',
			'Shadow: 216',
			'Storm: 648',
			'Mountain: 1,944',
			'Moon: 5,832',
		].join('\n'));
	});
});
