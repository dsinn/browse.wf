import {type Page} from '@playwright/test';

/**
 Simulates a completed cloud sync (logged-in state) so that the profile page's showAutoFetchFlow is true.

 The page waits for a cloud-sync-* event and falls back to the manual flow if none arrives within 5 seconds
 (see waitForCloudSync in src/cloud-sync/trigger.ts). Relying on the page's own auth flow to produce that event
 ties every test to that flow's timing, so this does two things:
 - Emits cloud-sync-complete itself once the page's scripts have registered their listeners (DOMContentLoaded).
 - Replaces any other cloud-sync-* event the page dispatches with cloud-sync-complete, so a late real event
 (unauthenticated, unavailable, etc.) cannot change the outcome.
 */
export async function simulateLoggedIn(page: Page) {
	await page.addInitScript(() => {
		const original = window.dispatchEvent.bind(globalThis);
		window.dispatchEvent = function (event: Event) {
			return original(event.type.startsWith('cloud-sync-') && event.type !== 'cloud-sync-complete' ? new CustomEvent('cloud-sync-complete') : event);
		};

		document.addEventListener('DOMContentLoaded', () => {
			original(new CustomEvent('cloud-sync-complete'));
		}, {once: true});
	});
}
