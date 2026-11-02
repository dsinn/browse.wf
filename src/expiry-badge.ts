/**
 * Expiry badge helpers extracted from upstream live.ts for performance refactoring and extension.
 * Badges register with the shared ticker in timer-registry.ts.
 */

import {getPendingLabel, registerTimerBadge, setTimerText} from './timer-registry.js';

export function deltaToUnits(delta: number): string[] {
	delta = Math.abs(delta);

	const units = [];
	if (delta >= 86_400_000) {
		units.push(Math.trunc(delta / 86_400_000) + 'd');
		delta %= 86_400_000;
	}

	if (delta >= 3_600_000 || units.length > 0) {
		units.push(Math.trunc(delta / 3_600_000) + 'h');
		delta %= 3_600_000;
	}

	if (delta >= 60_000 || units.length > 0) {
		units.push(Math.trunc(delta / 60_000) + 'm');
		delta %= 60_000;
	}

	units.push(Math.trunc(delta / 1000).toString().padStart(2, '0') + 's');
	return units;
}

/**
 * Sets the badge's text from its data-expiry. Returns false once the pending label is showing.
 */
function updateExpiryBadge(badge: HTMLElement): boolean {
	let expiry = Number.parseInt(badge.dataset.expiry ?? '', 10);
	expiry -= expiry % 1000;
	expiry += 1000; // Normalise the ms so everything ticks at the same time
	const delta = expiry - Date.now();
	if (delta < 1000) {
		setTimerText(badge, getPendingLabel());
		return false;
	}

	setTimerText(badge, deltaToUnits(delta).join(' '));
	return true;
}

export function createExpiryBadge(expiry: number): HTMLSpanElement {
	const span = document.createElement('span');
	span.dataset.expiry = expiry.toString();
	span.className = 'badge text-bg-secondary';
	registerTimerBadge(span, () => updateExpiryBadge(span));
	return span;
}

window.createExpiryBadge = createExpiryBadge;
