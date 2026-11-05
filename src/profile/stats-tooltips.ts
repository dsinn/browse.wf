/**
 * Augmentations for the profile Stats tab summary row.
 *
 * Each function is called from profile.ts immediately after the upstream
 * one-liner that sets the element's text content.
 */

import {SECONDS_PER_DAY, SECONDS_PER_HOUR} from '../helpers/time-helpers.js';

const MISSION_STATS = ['MissionsCompleted', 'MissionsFailed', 'MissionsQuit', 'MissionsInterrupted', 'MissionsDumped'];
const CIPHER_STATS = ['CiphersSolved', 'CiphersFailed'];

function addTooltipDecoration(elm: HTMLElement): void {
	elm.style.cursor = 'help';
	elm.style.textDecoration = 'underline dotted';
	elm.dataset.bsToggle = 'tooltip';
}

/**
 * Adds a breakdown tooltip to a time stat element (TimePlayedSec or CipherTime).
 * Called after the upstream textContent assignment for those stats.
 */
export function addTimeStatTooltip(elm: HTMLElement, stat: string, value: number): void {
	addTooltipDecoration(elm);
	if (stat === 'TimePlayedSec') {
		const totalSec = Math.floor(value);
		const days = Math.floor(totalSec / SECONDS_PER_DAY);
		const hours = Math.floor((totalSec % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
		const minutes = Math.floor((totalSec % SECONDS_PER_HOUR) / 60);
		const seconds = totalSec % 60;
		const p = window.pluralize!;
		elm.dataset.bsTitle = [p(days, 'day'), p(hours, 'hour'), p(minutes, 'minute'), p(seconds, 'second')].join(', ');
	} else {
		elm.dataset.bsTitle = `${Math.round(value).toLocaleString()} seconds`;
	}

	void new window.bootstrap.Tooltip(elm);
}

/**
 * Appends a percentage to a mission or cipher stat element.
 * Computes the relevant total from window.profile so no extra args are needed.
 * Called after the upstream textContent assignment for non-time stats.
 */
export function addStatPercentage(stat: string, value: number): void {
	const stats = window.profile?.Stats ?? {};

	if (MISSION_STATS.includes(stat)) {
		const total = MISSION_STATS.reduce((sum, key) => sum + (Number(stats[key]) || 0), 0);
		if (total > 0) {
			const elm = document.querySelector<HTMLElement>(`#stat-${stat}`)!;
			elm.textContent += ` (${((value / total) * 100).toFixed(2)}%)`;
		}
	} else if (CIPHER_STATS.includes(stat)) {
		const total = CIPHER_STATS.reduce((sum, key) => sum + (Number(stats[key]) || 0), 0);
		if (total > 0) {
			const elm = document.querySelector<HTMLElement>(`#stat-${stat}`)!;
			elm.textContent += ` (${((value / total) * 100).toFixed(2)}%)`;
		}
	}
}

/**
 * Replaces the cipher average element's text with a more precise value and
 * adds a tooltip showing the full unrounded figure.
 * Called after the upstream one-liner sets the element's text content.
 */
export function addCipherAvgTooltip(elm: HTMLElement, profile: any): void {
	const avgCipherTime = profile.Stats.CipherTime / profile.Stats.CiphersSolved;
	elm.textContent = `${avgCipherTime.toFixed(3)}s`;
	addTooltipDecoration(elm);
	elm.dataset.bsTitle = `${avgCipherTime} seconds`;
	void new window.bootstrap.Tooltip(elm);
}

window.addTimeStatTooltip = addTimeStatTooltip;
window.addStatPercentage = addStatPercentage;
window.addCipherAvgTooltip = addCipherAvgTooltip;
