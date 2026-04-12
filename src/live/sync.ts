/**
 * Live page cloud sync handler
 *
 * Listens for 'cloud-sync-pulled' and refreshes all live-page UI to reflect
 * the newly pulled localStorage values.
 *
 * Call initLiveSync() to activate — this ensures listeners are
 * registered synchronously during page load, before any auth events fire.
 */

import {refreshFilterStatus} from '../card-filters.js';
import {initializeBountyFilters} from './bounty-filters.js';
import {refreshAllCompletionToggles} from './completion-toggles.js';
import {updateIncursionsLocalised} from './incursions.js';
import {pruneStaleNewsRead} from './news-mark-read.js';
import {updateNewsTicker} from './news.js';
import {pruneStaleOids} from './prune-stale-data.js';
import {updateRedText} from './red-text.js';

export function initLiveSync() {
	globalThis.addEventListener('cloud-sync-before-push', () => {
		pruneStaleOids();
		pruneStaleNewsRead();
	});

	globalThis.addEventListener('cloud-sync-pulled', () => {
		// Refresh completion checkboxes (objectives)
		refreshAllCompletionToggles();

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
		initializeBountyFilters();

		// Refresh card content to apply filters
		updateRedText();

		updateNewsTicker();

		if ((globalThis as any).bountyCycle) {
			(globalThis as any).updateBountyCycleLocalised();
		}

		void updateIncursionsLocalised();
	});
}

(globalThis as any).initLiveSync = initLiveSync;
