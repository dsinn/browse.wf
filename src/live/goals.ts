/**
 Events (Goals) card helpers (fork-specific)
 */
import {createTooltip} from '../tooltip.js';

/**
 Clan tiers in ascending order of size. `Goal.ClanGoal` lists one score per tier in this order.
 */
const CLAN_TIERS = ['Ghost', 'Shadow', 'Storm', 'Mountain', 'Moon'];

/**
 Formats a goal's per-clan-tier scores as a multi-line tooltip, smallest tier first.
 */
export function formatClanGoalTooltip(clanGoal: number[]): string {
	const lines = clanGoal.map((score, index) => `${CLAN_TIERS[index] ?? `Tier ${index + 1}`}: ${score.toLocaleString('en')}`);
	return ['Clan Goals', ...lines].join('\n');
}

/**
 Renders the comma-separated goal names, adding a clan goal tooltip to goals that have one.

 @param body - The card body element
 @param goals - `worldState.Goals`
 @param names - Display names, one per goal, in the same order as `goals`
 */
export function renderGoals(body: HTMLElement, goals: any[], names: string[]): void {
	for (const element of body.querySelectorAll('[data-bs-toggle=tooltip]')) {
		window.bootstrap?.Tooltip.getInstance(element)?.dispose();
	}

	if (names.length === 0) {
		body.textContent = 'None right now.';
		return;
	}

	const nodes: Array<string | Node> = [];
	for (const [index, name] of names.entries()) {
		if (index > 0) {
			nodes.push(', ');
		}

		const clanGoal = goals[index]?.ClanGoal;
		if (Array.isArray(clanGoal) && clanGoal.length > 0) {
			const abbr = document.createElement('abbr');
			abbr.textContent = name;
			abbr.dataset.bsToggle = 'tooltip';
			abbr.dataset.bsTitle = formatClanGoalTooltip(clanGoal);
			createTooltip(abbr, {customClass: 'tooltip-multiline'});
			nodes.push(abbr);
		} else {
			nodes.push(name);
		}
	}

	body.replaceChildren(...nodes);
}

window.renderGoals = renderGoals;
