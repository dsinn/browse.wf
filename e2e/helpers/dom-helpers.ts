import {type Page} from '@playwright/test';

// Must match .card-filter-panel { transition: grid-template-rows ... } in src/card-filters.css
const FILTER_PANEL_TRANSITION_MS = 300;

/**
 * Opens a card filter panel by clicking its gear icon toggle and waits for the
 * CSS accordion animation to complete before returning.
 *
 * Use this instead of manually clicking and asserting toBeVisible() — the panel
 * element becomes visible immediately when display:grid is set, before the
 * grid-template-rows transition finishes, so toBeVisible() resolves too early.
 * During the animation the inner content is clipped to zero height by
 * overflow:hidden, leaving checkboxes physically inaccessible.
 */
export async function openFilterPanel(page: Page, cardName: string): Promise<void> {
	await page.locator(`[data-filter-toggle="${cardName}"]`).click();
	await page.waitForTimeout(FILTER_PANEL_TRANSITION_MS);
}
