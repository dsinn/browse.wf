/**
 * Bounty filter functionality for browse.wf
 *
 * Provides dropdown-based filtering for bounty tiers per syndicate.
 * Integrates with the card-filters system and cloud sync.
 *
 * This module exposes functions globally via window object for compatibility
 * with non-module scripts.
 */

const SYNDICATE_TAGS = [
	'ZarimanSyndicate',
	'EntratiLabSyndicate',
	'HexSyndicate',
];

/**
 * Get the minimum tier setting for a syndicate
 * @param syndicateTag - The syndicate tag (e.g., "ZarimanSyndicate")
 * @returns The minimum tier to display (-1 = hide, 1 = show all, higher = hide lower tiers)
 */
export function getMinimumTier(syndicateTag: string): number {
	const storageKey = `live.filter.bounties.${syndicateTag}`;
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
 * Initialize bounty filter dropdowns
 */
function initializeBountyFilters(): void {
	for (const syndicateTag of SYNDICATE_TAGS) {
		const select = document.querySelector<HTMLSelectElement>(`#bounty-filter-${syndicateTag}`);
		if (!select) {
			continue;
		}

		const storageKey = `live.filter.bounties.${syndicateTag}`;

		// Load saved state (default to 1 = show all)
		const savedValue = localStorage.getItem(storageKey);
		select.value = savedValue === null ? '1' : savedValue; // Default to minimum tier (show all)

		// Handle changes
		select.addEventListener('change', () => {
			localStorage.setItem(storageKey, select.value);

			// Trigger cloud sync if available
			if ((globalThis as any).triggerCloudSync) {
				(globalThis as any).triggerCloudSync();
			}

			// Re-render bounties
			if ((globalThis as any).updateBountyCycleLocalised) {
				(globalThis as any).updateBountyCycleLocalised();
			}
		});
	}
}

/**
 * Initialize all bounty filter functionality
 * Call this after the DOM is loaded
 */
export function initializeBountyFiltersAll(): void {
	initializeBountyFilters();
}

// Expose functions globally for use by non-module scripts
(globalThis as any).getMinimumTier = getMinimumTier;
(globalThis as any).initializeBountyFiltersAll = initializeBountyFiltersAll;
