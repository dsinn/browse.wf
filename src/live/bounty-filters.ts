/**
 * Bounty filter functionality for browse.wf
 *
 * Provides dropdown-based filtering for bounty tiers per syndicate.
 * Integrates with the card-filters system and cloud sync.
 */

import {triggerCloudSyncWithDebounce as triggerCloudSync} from '../cloud-sync/trigger.js';

const SYNDICATE_TAGS = [
	'ZarimanSyndicate',
	'EntratiLabSyndicate',
	'HexSyndicate',
];

/**
 * Check if a mission type is enabled for a given syndicate
 * @param syndicateTag - The syndicate tag (e.g., "ZarimanSyndicate")
 * @param missionType - The mission type key (e.g., "MT_CORRUPTION")
 * @returns true if the mission type should be shown
 */
export function isBountyMissionTypeEnabled(syndicateTag: string, missionType: string): boolean {
	const storageKey = `live.filter.bounties.${syndicateTag}.${missionType}`;
	return localStorage.getItem(storageKey) !== '0';
}

/**
 * Get the minimum tier setting for a syndicate
 * @param syndicateTag - The syndicate tag (e.g., "ZarimanSyndicate")
 * @returns The minimum tier to display (-1 = hide, 1 = show all, higher = hide lower tiers)
 */
export function getMinimumTier(syndicateTag: string): number {
	const storageKey = `live.filter.bounties.${syndicateTag}.minTier`;
	const savedValue = localStorage.getItem(storageKey);

	if (savedValue !== null) {
		const tier = Number.parseInt(savedValue, 10);
		if (!Number.isNaN(tier) && tier >= -1) {
			return tier;
		}
	}

	// Default to minimum tier (1 = show all)
	return 1;
}

/**
 * Initialize the Deimos bounties checkbox
 */
function initializeDeimosFilter(): void {
	const checkbox = document.querySelector<HTMLInputElement>('#bounty-filter-deimos');
	if (!checkbox) {
		return;
	}

	const storageKey = 'live.filter.bounties.deimos';
	checkbox.checked = localStorage.getItem(storageKey) !== '0';

	checkbox.addEventListener('change', () => {
		localStorage.setItem(storageKey, checkbox.checked ? '1' : '0');
		triggerCloudSync();
	});
}

/**
 * Initialize bounty filter dropdowns and mission type checkboxes
 */
export function initializeBountyFilters(): void {
	initializeDeimosFilter();

	for (const syndicateTag of SYNDICATE_TAGS) {
		const select = document.querySelector<HTMLSelectElement>(`#bounty-filter-${syndicateTag}`);
		if (!select) {
			continue;
		}

		const tierStorageKey = `live.filter.bounties.${syndicateTag}.minTier`;

		// Load saved state (default to 1 = show all)
		const savedValue = localStorage.getItem(tierStorageKey);
		select.value = savedValue === null ? '1' : savedValue;

		// Handle tier dropdown changes
		select.addEventListener('change', () => {
			localStorage.setItem(tierStorageKey, select.value);
			triggerCloudSync();
			if (window.updateBountyCycleLocalised) {
				window.updateBountyCycleLocalised();
			}
		});

		// Initialize mission type checkboxes for this syndicate
		const checkboxes = document.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][data-bounty-syndicate="${syndicateTag}"]`);
		for (const checkbox of checkboxes) {
			const missionType = checkbox.dataset.filterType!;
			const checkboxStorageKey = `live.filter.bounties.${syndicateTag}.${missionType}`;

			// Load saved state (default checked = enabled)
			checkbox.checked = localStorage.getItem(checkboxStorageKey) !== '0';

			checkbox.addEventListener('change', () => {
				localStorage.setItem(checkboxStorageKey, checkbox.checked ? '1' : '0');
				triggerCloudSync();
				if (window.updateBountyCycleLocalised) {
					window.updateBountyCycleLocalised();
				}
			});
		}
	}
}

window.getMinimumTier = getMinimumTier;
window.isBountyMissionTypeEnabled = isBountyMissionTypeEnabled;
window.initializeBountyFilters = initializeBountyFilters;
