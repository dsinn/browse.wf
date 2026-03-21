/**
 * Live page cloud sync handler
 *
 * Listens for 'cloud-sync-pulled' and refreshes all live-page UI to reflect
 * the newly pulled localStorage values.
 */

import {refreshFilterStatus} from '../card-filters.js';
import {initializeBountyFiltersAll} from '../bounty-filters.js';
import {pruneStaleNewsRead} from '../news-mark-read.js';

globalThis.addEventListener('cloud-sync-before-push', () => {
	// Prune stale objective completions — keep only OIDs present in the DOM
	const oidsValue = localStorage.getItem('oids_completed');
	if (oidsValue) {
		try {
			const allOids = JSON.parse(oidsValue);
			const validOids = new Set<string>();
			for (const element of document.querySelectorAll<HTMLElement>('[data-oid]')) {
				const {oid} = element.dataset;
				if (oid) {
					validOids.add(oid);
				}
			}

			// Skip if page has no [data-oid] elements — can't determine what's stale
			if (validOids.size > 0) {
				const cleanedOids = allOids.filter((oid: string) => validOids.has(oid));
				if (cleanedOids.length > 0) {
					localStorage.setItem('oids_completed', JSON.stringify(cleanedOids));
				} else {
					localStorage.removeItem('oids_completed');
				}
			}
		} catch {
			localStorage.removeItem('oids_completed');
		}
	}

	pruneStaleNewsRead();
});

globalThis.addEventListener('cloud-sync-pulled', () => {
	// Refresh completion checkboxes (objectives)
	if ((globalThis as any).refreshAllCompletionToggles) {
		(globalThis as any).refreshAllCompletionToggles();
	}

	// Refresh collapse states
	if ((globalThis as any).refreshCollapseStatus) {
		for (const elm of document.querySelectorAll<HTMLElement>('[data-collapse-toggle]')) {
			(globalThis as any).refreshCollapseStatus(elm);
		}
	}

	// Refresh notification states
	if ((globalThis as any).refreshNotifStatus) {
		for (const elm of document.querySelectorAll<HTMLElement>('[data-notif-toggle]')) {
			(globalThis as any).refreshNotifStatus(elm);
		}
	}

	// Refresh filter toggle states
	for (const elm of document.querySelectorAll<HTMLElement>('[data-filter-toggle]')) {
		refreshFilterStatus(elm);
	}

	// Refresh filter checkboxes
	for (const checkbox of document.querySelectorAll<HTMLInputElement>('[data-filter-type]')) {
		const {filterType} = checkbox.dataset;
		if (filterType) {
			// Extract card name from checkbox ID (e.g., "filter-news-danger" -> "news", "filter-bounty-cycle-credits" -> "bounty")
			const cardName = checkbox.id.replace(/^filter-/u, '').split('-')[0];
			const storageKey = `live.filter.${cardName}.${filterType}`;
			const savedState = localStorage.getItem(storageKey);
			if (savedState !== null) {
				checkbox.checked = savedState === '1';
			}
		}
	}

	// Refresh bounty filter dropdowns
	initializeBountyFiltersAll();

	// Refresh card content to apply filters
	if ((globalThis as any).updateNewsTicker) {
		(globalThis as any).updateNewsTicker();
	}

	if ((globalThis as any).updateBountyCycleLocalised) {
		(globalThis as any).updateBountyCycleLocalised();
	}

	if ((globalThis as any).updateIncursionsLocalised) {
		(globalThis as any).updateIncursionsLocalised();
	}

	// Refresh arbys Load button state (enable/disable based on saved settings)
	if ((globalThis as any).checkLoadButtonState) {
		(globalThis as any).checkLoadButtonState();
	}
});
