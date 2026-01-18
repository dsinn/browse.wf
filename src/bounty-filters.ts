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
	"ZarimanSyndicate",
	"EntratiLabSyndicate",
	"HexSyndicate",
];

/**
 * Get the minimum tier setting for a syndicate
 * @param syndicateTag - The syndicate tag (e.g., "ZarimanSyndicate")
 * @returns The minimum tier to display (-1 = hide, 1 = show all, higher = hide lower tiers)
 */
function getMinimumTier(syndicateTag: string): number
{
	const storageKey = `live.filter.bounties.${syndicateTag}`;
	const savedValue = localStorage.getItem(storageKey);

	if (savedValue !== null)
	{
		const tier = parseInt(savedValue, 10);
		if (!isNaN(tier) && tier >= -1)
		{
			return tier;
		}
	}

	// Default to minimum tier (1 = show all)
	return 1;
}

/**
 * Initialize bounty filter dropdowns
 */
function initializeBountyFilters(): void
{
	SYNDICATE_TAGS.forEach(syndicateTag =>
	{
		const select = document.getElementById(`bounty-filter-${syndicateTag}`) as HTMLSelectElement;
		if (!select) return;

		const storageKey = `live.filter.bounties.${syndicateTag}`;

		// Load saved state (default to 1 = show all)
		const savedValue = localStorage.getItem(storageKey);
		if (savedValue !== null)
		{
			select.value = savedValue;
		}
		else
		{
			select.value = "1"; // Default to minimum tier (show all)
		}

		// Handle changes
		select.onchange = function()
		{
			localStorage.setItem(storageKey, select.value);

			// Trigger cloud sync if available
			if ((window as any).triggerCloudSync)
			{
				(window as any).triggerCloudSync();
			}

			// Re-render bounties
			if ((window as any).updateBountyCycleLocalised)
			{
				(window as any).updateBountyCycleLocalised();
			}
		};
	});
}

/**
 * Initialize all bounty filter functionality
 * Call this after the DOM is loaded
 */
function initializeBountyFilters_all(): void
{
	initializeBountyFilters();
}

// Expose functions globally for use by non-module scripts
(window as any).getMinimumTier = getMinimumTier;
(window as any).initializeBountyFilters_all = initializeBountyFilters_all;
