import {
	describe,
	test,
	expect,
	beforeEach,
} from 'vitest';
import {mockBootstrapTooltip} from '@test/helpers/dom-helpers';
import {formatClanGoalTooltip, renderGoals} from './goals';

describe('formatClanGoalTooltip', () => {
	test('lists each clan tier from smallest to largest under a heading', () => {
		expect(formatClanGoalTooltip([72, 216, 648, 1944, 5832])).toBe([
			'Clan Goals',
			'Ghost: 72',
			'Shadow: 216',
			'Storm: 648',
			'Mountain: 1,944',
			'Moon: 5,832',
		].join('\n'));
	});
});

describe('renderGoals', () => {
	let body: HTMLElement;

	beforeEach(() => {
		mockBootstrapTooltip();
		body = document.createElement('div');
	});

	test('shows a placeholder when there are no goals', () => {
		renderGoals(body, [], []);
		expect(body.textContent).toBe('None right now.');
	});

	test('adds a clan goal tooltip only to goals that have clan goals', () => {
		renderGoals(body, [{ClanGoal: [72, 216, 648, 1944, 5832]}, {}], ['Jade Shadows', 'Nightwave']);

		expect(body.textContent).toBe('Jade Shadows, Nightwave');
		const [abbr, ...otherAbbrs] = body.querySelectorAll('abbr');
		expect(otherAbbrs).toEqual([]);
		expect(abbr?.textContent).toBe('Jade Shadows');
		expect(abbr?.dataset.bsTitle).toBe(formatClanGoalTooltip([72, 216, 648, 1944, 5832]));
	});

	test('exposes renderGoals on globalThis', () => {
		expect((globalThis as any).renderGoals).toBe(renderGoals);
	});
});
