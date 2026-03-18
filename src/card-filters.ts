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
export function refreshFilterStatus(elm: HTMLElement): void {
	const cardName = elm.dataset.filterToggle;
	const panelId = `${String(cardName)}-filters`;
	const panel = document.querySelector<HTMLElement>(`#${panelId}`);
	const isOpen = panel?.classList.contains('show');

	const span = document.createElement('span');
	span.textContent = '⚙️';
	span.className = isOpen ? 'filter-gear-enabled' : 'filter-gear-disabled';

	// Add tooltip using existing addTooltip function
	if (globalThis.addTooltip) {
		globalThis.addTooltip(span, 'Widget settings');
	}

	for (const x of elm.querySelectorAll('[data-bs-toggle=tooltip]')) {
		globalThis.bootstrap?.Tooltip.getInstance(x)?.dispose();
	}

	elm.innerHTML = '';
	elm.append(span);
}

/**
 * Initialize filter toggle functionality for all cards with [data-filter-toggle]
 */
export function initializeFilterToggles(): void {
	for (const elm of document.querySelectorAll<HTMLAnchorElement>('[data-filter-toggle]')) {
		refreshFilterStatus(elm);
		elm.addEventListener('click', () => {
			const cardName = elm.dataset.filterToggle;
			const panelId = `${String(cardName)}-filters`;
			const panel = document.querySelector<HTMLElement>(`#${panelId}`);

			if (panel) {
				if (panel.classList.contains('show')) {
					// Close panel
					panel.classList.remove('show');
					// After animation completes, hide completely
					setTimeout(() => {
						if (!panel.classList.contains('show')) {
							panel.style.display = 'none';
						}
					}, 300);
				} else {
					// Open panel
					panel.style.display = 'grid';
					// Trigger reflow to ensure display change is processed before adding class
					void panel.offsetHeight;
					panel.classList.add('show');

					// If card is collapsed, expand it
					const collapseToggle = document.querySelector<HTMLElement>(`[data-collapse-toggle="${cardName}"]`);
					if (collapseToggle?.classList.contains('engaged')) {
						localStorage.removeItem(`live.collapse.${cardName}`);
						if (globalThis.refreshCollapseStatus) {
							globalThis.refreshCollapseStatus(collapseToggle);
						}

						// Trigger cloud sync if available
						if (globalThis.triggerCloudSync) {
							globalThis.triggerCloudSync();
						}
					}
				}

				refreshFilterStatus(elm);
			}
		});
	}
}

/**
 * Initialize filter checkboxes for a specific card
 * @param cardName - The name of the card (e.g., "news")
 * @param onFilterChange - Optional callback when filters change
 */
export function initializeCardFilters(cardName: string, onFilterChange: () => void): void {
	for (const checkbox of document.querySelectorAll<HTMLInputElement>(`#${cardName}-filters input[type=checkbox]`)) {
		const {filterType} = checkbox.dataset;
		const storageKey = `live.filter.${cardName}.${filterType}`;

		// Load saved state
		const savedState = localStorage.getItem(storageKey);
		if (savedState !== null) {
			checkbox.checked = savedState === '1';
		}

		// Handle changes
		checkbox.addEventListener('change', () => {
			if (checkbox.checked) {
				localStorage.setItem(storageKey, '1');
			} else {
				localStorage.setItem(storageKey, '0');
			}

			// Trigger cloud sync if available
			if (globalThis.triggerCloudSync) {
				globalThis.triggerCloudSync();
			}

			// Special case: if enabling danger filter and redtext not loaded, fetch it
			if (cardName === 'news' && filterType === 'danger' && checkbox.checked && !globalThis.redtext) {
				void fetch('https://oracle.browse.wf/redtext.json')
					.then(async response => response.json())
					.then(redtext => {
						globalThis.redtext = redtext;
						if (globalThis.updateNewsTicker) {
							globalThis.updateNewsTicker();
						}
					});
			}

			// Call the update callback if provided
			if (onFilterChange) {
				onFilterChange();
			}
		});
	}
}

/**
 * Check if a specific filter type is enabled for a card
 * @param cardName - The name of the card (e.g., "news", "incursions")
 * @param filterType - The filter type value from the checkbox's data-filter-type attribute
 * @returns true if the filter is enabled (should show items), false if disabled (should hide items)
 */
export function isFilterEnabled(cardName: string, filterType: string): boolean {
	const filterKey = `live.filter.${cardName}.${filterType}`;
	const filterState = localStorage.getItem(filterKey);
	// If no filter is set, default to showing the item (checked)
	// If filter is explicitly "0", hide the item
	return filterState !== '0';
}

// Expose functions globally for use by non-module scripts
globalThis.refreshFilterStatus = refreshFilterStatus;
globalThis.isFilterEnabled = isFilterEnabled;
globalThis.initializeCardFilters = initializeCardFilters;
globalThis.initializeFilterToggles = initializeFilterToggles;
