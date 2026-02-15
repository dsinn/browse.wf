/**
 * Card filter functionality for browse.wf
 *
 * Provides accordion-based filtering for card widgets with gear icon toggle
 * and checkbox-based filter controls. Integrates with cloud sync system.
 *
 * This module exposes functions globally via window object for compatibility
 * with non-module scripts.
 */

/**
 * Refresh the visual state of a filter gear icon based on panel open/closed state
 */
function refreshFilterStatus(elm: HTMLElement): void
{
	const cardName = elm.getAttribute("data-filter-toggle");
	const panelId = cardName + "-filters";
	const panel = document.getElementById(panelId);
	const isOpen = panel && panel.classList.contains("show");

	const span = document.createElement("span");
	span.textContent = "⚙️";
	span.className = isOpen ? "filter-gear-enabled" : "filter-gear-disabled";

	// Add tooltip using existing addTooltip function
	if ((window as any).addTooltip) {
		(window as any).addTooltip(span, "Widget settings");
	}

	elm.querySelectorAll("[data-bs-toggle=tooltip]").forEach(x => (window as any).bootstrap?.Tooltip.getInstance(x)?.dispose());
	elm.innerHTML = "";
	elm.appendChild(span);
}

/**
 * Initialize filter toggle functionality for all cards with [data-filter-toggle]
 */
function initializeFilterToggles(): void
{
	document.querySelectorAll<HTMLAnchorElement>("[data-filter-toggle]").forEach(elm =>
	{
		refreshFilterStatus(elm);
		elm.onclick = function()
		{
			const cardName = elm.getAttribute("data-filter-toggle");
			const panelId = cardName + "-filters";
			const panel = document.getElementById(panelId);

			if (panel)
			{
				if (panel.classList.contains("show"))
				{
					// Close panel
					panel.classList.remove("show");
					// After animation completes, hide completely
					setTimeout(() => {
						if (!panel.classList.contains("show")) {
							panel.style.display = "none";
						}
					}, 300);
				}
				else
				{
					// Open panel
					panel.style.display = "grid";
					// Trigger reflow to ensure display change is processed before adding class
					panel.offsetHeight;
					panel.classList.add("show");

					// If card is collapsed, expand it
					const collapseToggle = document.querySelector<HTMLElement>(`[data-collapse-toggle="${cardName}"]`);
					if (collapseToggle && collapseToggle.classList.contains("engaged"))
					{
						localStorage.removeItem(`live.collapse.${cardName}`);
						if ((window as any).refreshCollapseStatus)
						{
							(window as any).refreshCollapseStatus(collapseToggle);
						}
						// Trigger cloud sync if available
						if ((window as any).triggerCloudSync)
						{
							(window as any).triggerCloudSync();
						}
					}
				}
				refreshFilterStatus(elm);
			}
			return false;
		};
	});
}

/**
 * Initialize filter checkboxes for a specific card
 * @param cardName - The name of the card (e.g., "news")
 * @param onFilterChange - Optional callback when filters change
 */
function initializeCardFilters(cardName: string, onFilterChange?: () => void): void
{
	document.querySelectorAll<HTMLInputElement>(`#${cardName}-filters input[type=checkbox]`).forEach(checkbox =>
	{
		const filterType = checkbox.getAttribute("data-filter-type");
		const storageKey = `live.filter.${cardName}.${filterType}`;

		// Load saved state
		const savedState = localStorage.getItem(storageKey);
		if (savedState !== null)
		{
			checkbox.checked = savedState === "1";
		}

		// Handle changes
		checkbox.onchange = function()
		{
			if (checkbox.checked)
			{
				localStorage.setItem(storageKey, "1");
			}
			else
			{
				localStorage.setItem(storageKey, "0");
			}

			// Trigger cloud sync if available
			if ((window as any).triggerCloudSync)
			{
				(window as any).triggerCloudSync();
			}

			// Special case: if enabling danger filter and redtext not loaded, fetch it
			if (cardName === "news" && filterType === "danger" && checkbox.checked)
			{
				if (!(window as any).redtext)
				{
					fetch("https://oracle.browse.wf/redtext.json")
						.then(res => res.json())
						.then(redtext =>
						{
							(window as any).redtext = redtext;
							if ((window as any).updateNewsTicker)
							{
								(window as any).updateNewsTicker();
							}
						});
				}
			}

			// Call the update callback if provided
			if (onFilterChange)
			{
				onFilterChange();
			}
		};
	});
}

/**
 * Check if a specific filter type is enabled for a card
 * @param cardName - The name of the card (e.g., "news", "incursions")
 * @param filterType - The filter type value from the checkbox's data-filter-type attribute
 * @returns true if the filter is enabled (should show items), false if disabled (should hide items)
 */
function isFilterEnabled(cardName: string, filterType: string): boolean
{
	const filterKey = `live.filter.${cardName}.${filterType}`;
	const filterState = localStorage.getItem(filterKey);
	// If no filter is set, default to showing the item (checked)
	// If filter is explicitly "0", hide the item
	return filterState !== "0";
}

/**
 * Initialize all card filter functionality
 * Call this after the DOM is loaded
 */
function initializeCardFilters_all(): void
{
	initializeFilterToggles();

	// Initialize News card filters
	initializeCardFilters("news", () => {
		if ((window as any).updateNewsTicker) {
			(window as any).updateNewsTicker();
		}
	});

	// Initialize Steel Path Incursions card filters
	initializeCardFilters("incursions", () => {
		if ((window as any).updateIncursionsLocalised) {
			(window as any).updateIncursionsLocalised();
		}
	});

	// Initialize Void Fissures card filters
	initializeCardFilters("fissures", () => {
		if ((window as any).updateFissures) {
			(window as any).updateFissures();
		}
	});

	// Initialize Steel Path Fissures card filters
	initializeCardFilters("sp-fissures", () => {
		if ((window as any).updateFissures) {
			(window as any).updateFissures();
		}
	});

	// Initialize Void Storms (Railjack) card filters
	initializeCardFilters("rj-fissures", () => {
		if ((window as any).updateFissures) {
			(window as any).updateFissures();
		}
	});

	// Initialize Weekly Missions card filters
	initializeCardFilters("weekly-missions", () => {
		if ((window as any).updateCircuitLocalised) {
			(window as any).updateCircuitLocalised();
		}
	});

	// Initialize Invasions card filters
	initializeCardFilters("invasions", () => {
		if ((window as any).updateInvasionsLocalised) {
			(window as any).updateInvasionsLocalised();
		}
	});

	// Future cards can be initialized here:
	// initializeCardFilters("alerts", () => { updateAlerts(); });
}

// Expose functions globally for use by non-module scripts
(window as any).refreshFilterStatus = refreshFilterStatus;
(window as any).isFilterEnabled = isFilterEnabled;
(window as any).initializeCardFilters_all = initializeCardFilters_all;
