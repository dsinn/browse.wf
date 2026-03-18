/**
 * Descendia card functionality for browse.wf
 *
 * Handles rendering the Descendia (Devil's Lair) weekly rotation challenges.
 * Displays 21 challenges from the active Descent with mission types, arenas,
 * specs, and auras.
 */

import {resolveDescentChallenges} from './descendia-data.js';

type IMongoDate = {
	$date: {
		$numberLong: string;
	};
};

type IDescent = {
	Activation: IMongoDate;
	Expiry: IMongoDate;
	RandSeed: number;
	Challenges: Array<{
		Index: number;
		Type: string;
		Challenge: string;
		Level: string;
		Specs: string[];
		Auras: string[];
	}>;
};

/**
 * Updates the Descendia table with the currently active Descent rotation
 */
export function updateDescendia(): void {
	// WorldState must be available before calling this
	if (!(globalThis as any).worldState?.Descents || (globalThis as any).worldState.Descents.length === 0) {
		console.error('worldState.Descents not available for updateDescendia');
		return;
	}

	const now = Date.now();
	// Find the active Descent (Activation <= now < Expiry)
	const activeDescent: IDescent = (globalThis as any).worldState.Descents.find((d: IDescent) =>
		Number.parseInt(d.Activation.$date.$numberLong, 10) <= now && Number.parseInt(d.Expiry.$date.$numberLong, 10) > now);

	if (!activeDescent) {
		setTimeout(updateDescendia, 5000); // Stale worldState — retry shortly
		return;
	}

	// Update header with expiry timer
	const expiry = Number.parseInt(activeDescent.Expiry.$date.$numberLong, 10);
	const header = document.querySelector('.card-header:has(#descent-checks) h5');
	if (header) {
		// Preserve collapse toggle, set title + badge, then append checks
		const collapseToggle = header.querySelector('[data-collapse-toggle="descendia"]');
		const checksSpan = header.querySelector('#descent-checks');

		header.textContent = '';
		if (collapseToggle) {
			collapseToggle.classList.add('me-1');
			header.append(collapseToggle);
		}

		header.append(document.createTextNode('Descendia '));
		header.append(createExpiryBadge(expiry));
		header.append(document.createTextNode(' '));
		if (checksSpan) {
			header.append(checksSpan);
		}
	}

	// Refresh when this Descent expires
	setTimeout(updateDescendia, expiry - Date.now());

	void getDictPromise().then(dict => {
		const table = document.querySelector('#descendia-table');
		const existingTbody = table.querySelector('tbody');
		if (existingTbody) {
			existingTbody.remove();
		}

		table.append(renderDescentChallenges(activeDescent, dict));
	});
}

/**
 * Renders the challenges of a given Descent into a <tbody> element.
 * Extracted from updateDescendia() so weekly-forecast can render any descent, not just the active one.
 *
 * @param descent  An IDescent object from worldState.Descents[]
 * @param dict     The main dictionary (key → localized string)
 * @returns        A <tbody> element ready to be inserted into a table
 */
export function renderDescentChallenges(descent: IDescent, dict: Record<string, string>): HTMLTableSectionElement {
	const tbody = document.createElement('tbody');

	for (const row of resolveDescentChallenges(descent, dict)) {
		const tr = document.createElement('tr');

		// Column 1: Level (Index)
		{
			const td = document.createElement('td');
			td.className = 'text-center';
			td.textContent = row.index.toString();
			tr.append(td);
		}

		// Column 2: Mission Type
		{
			const td = document.createElement('td');
			td.textContent = row.typeLabel;
			tr.append(td);
		}

		// Column 3: Challenge
		{
			const td = document.createElement('td');
			td.textContent = row.challenge;
			tr.append(td);
		}

		// Column 4: Arena (known arenas → emoji span with tooltip; unknown → plain text)
		{
			const td = document.createElement('td');
			if (row.arenaEmoji) {
				const span = document.createElement('span');
				span.textContent = row.arenaEmoji;
				span.dataset.bsToggle = 'tooltip';
				span.dataset.bsTitle = row.arenaKey;
				void new globalThis.bootstrap.Tooltip(span);
				td.append(span);
			} else {
				td.textContent = row.arenaFallback;
			}

			tr.append(td);
		}

		// Column 5: Specs
		{
			const td = document.createElement('td');
			td.textContent = row.specs.length > 0 ? row.specs.join(', ') : '-';
			tr.append(td);
		}

		// Column 6: Auras
		{
			const td = document.createElement('td');
			td.textContent = row.auras.length > 0 ? row.auras.join(', ') : '-';
			tr.append(td);
		}

		tbody.append(tr);
	}

	return tbody;
}

// Expose functions globally for use by non-module scripts
(globalThis as any).updateDescendia = updateDescendia;
(globalThis as any).renderDescentChallenges = renderDescentChallenges;
