/**
 * Circuit card functionality for browse.wf
 *
 * Renders the two "The Circuit" entries in the Weekly Missions card using
 * the EndlessXpSchedule array from worldState: wait for worldState, find the
 * active entry by Activation/Expiry, re-schedule at expiry.
 */

import {pascalToTitleCase} from '../helpers/string-helpers.js';
import {filterWeeklyMissions} from './weekly.js';

const STALE_DATA_RETRY_MS = 5000;

function choiceToDisplay(choice: string): string {
	return pascalToTitleCase(choice).replaceAll(' And ', ' & ');
}

type ICategoryChoice = {
	Category: string;
	Choices: string[];
};

type IEndlessXpEntry = {
	Activation: IMongoDate;
	Expiry: IMongoDate;
	CategoryChoices: ICategoryChoice[];
};

export function updateCircuitChoices(): void {
	const schedule: IEndlessXpEntry[] | undefined = (window as any).worldState?.EndlessXpSchedule;
	if (!schedule || schedule.length === 0) {
		setTimeout(updateCircuitChoices, STALE_DATA_RETRY_MS);
		return;
	}

	const now = Date.now();
	const active = schedule.find((entry: IEndlessXpEntry) =>
		Number.parseInt(entry.Activation.$date.$numberLong, 10) <= now && Number.parseInt(entry.Expiry.$date.$numberLong, 10) > now);

	if (!active) {
		setTimeout(updateCircuitChoices, STALE_DATA_RETRY_MS);
		return;
	}

	const expiry = Number.parseInt(active.Expiry.$date.$numberLong, 10);

	window.setDatum!('circuit-header', 'Weekly Missions', expiry);

	const clearAndSet = (id: string, key: string) => {
		const element = document.querySelector(`#${id}`)!;

		for (const node of element.querySelectorAll('[data-bs-toggle=tooltip]')) {
			window.bootstrap?.Tooltip.getInstance(node)?.dispose();
		}

		element.innerHTML = '';
		element.append(window.createCompletionToggle(key));
	};

	clearAndSet('circuit-frames-check', `circuit-normal-${expiry}`);
	clearAndSet('circuit-weapons-check', `circuit-hard-${expiry}`);

	setTimeout(updateCircuitChoices, expiry - now);

	const normalChoices = active.CategoryChoices.find(c => c.Category === 'EXC_NORMAL')?.Choices ?? [];
	const hardChoices = active.CategoryChoices.find(c => c.Category === 'EXC_HARD')?.Choices ?? [];

	document.querySelector('#circuit-frames')!.textContent = normalChoices.map(c => choiceToDisplay(c)).join('\u00A0\u00B7 ') + ' ';
	document.querySelector('#circuit-weapons')!.textContent = hardChoices.map(c => choiceToDisplay(c)).join('\u00A0\u00B7 ') + ' ';

	filterWeeklyMissions();
}

window.updateCircuitChoices = updateCircuitChoices;
