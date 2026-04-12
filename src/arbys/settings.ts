/**
 * Arbys save/load settings
 *
 * Handles persisting arbitration filter and display settings to localStorage,
 * wiring up Save/Load button click handlers, and re-checking the Load button
 * state after cloud sync events.
 */

type ArbysSettings = {
	select_days?: string;
	select_tz?: string;
	select_hourfmt?: string;
	filters?: Record<string, boolean>;
};

function saveToLocalStorage(): void {
	const settings: ArbysSettings = {
		select_days: document.querySelector<HTMLSelectElement>('#select-days')!.value,
		select_tz: document.querySelector<HTMLSelectElement>('#select-tz')!.value,
		select_hourfmt: document.querySelector<HTMLSelectElement>('#select-hourfmt')!.value,
		filters: {},
	};

	// Save all filter checkbox states
	for (const checkbox of document.querySelectorAll<HTMLInputElement>('input[type=checkbox][id^="filter-"]')) {
		const filterId = checkbox.id.slice(7); // Remove "filter-" prefix
		settings.filters![filterId] = checkbox.checked;
	}

	localStorage.setItem('arbys.settings', JSON.stringify(settings));
}

function loadFromLocalStorage(): void {
	const settingsJson = localStorage.getItem('arbys.settings');
	if (!settingsJson) {
		return;
	}

	try {
		const settings = JSON.parse(settingsJson) as ArbysSettings;

		// Restore dropdown values
		if (settings.select_days) {
			document.querySelector<HTMLSelectElement>('#select-days')!.value = settings.select_days;
		}

		if (settings.select_tz) {
			document.querySelector<HTMLSelectElement>('#select-tz')!.value = settings.select_tz;
		}

		if (settings.select_hourfmt) {
			document.querySelector<HTMLSelectElement>('#select-hourfmt')!.value = settings.select_hourfmt;
		}

		// Restore checkbox states
		if (settings.filters) {
			for (const [filterId, checked] of Object.entries(settings.filters)) {
				const checkbox = document.querySelector<HTMLInputElement>(`#filter-${filterId}`);
				if (checkbox) {
					checkbox.checked = checked;
				}
			}
		}
	} catch (error) {
		console.error('Failed to parse saved settings:', error);
	}
}

export function checkLoadButtonState(): void {
	const btnLoad = document.querySelector<HTMLButtonElement>('#btn-load-settings');
	if (!btnLoad) {
		return;
	}

	let shouldDisable = true;
	const settingsJson = localStorage.getItem('arbys.settings');
	if (settingsJson) {
		try {
			JSON.parse(settingsJson); // Validate it's valid JSON
			shouldDisable = false;
		} catch {
			// Invalid JSON — keep disabled
		}
	}

	btnLoad.disabled = shouldDisable;
}

export function initializeSettingsButtons(): void {
	// Save button handler
	document.querySelector('#btn-save-settings')?.addEventListener('click', event => {
		const btn = event.currentTarget as HTMLButtonElement;
		const originalText = btn.textContent;
		btn.disabled = true;
		btn.textContent = 'Saving...';

		try {
			// Save to localStorage
			saveToLocalStorage();

			// Trigger cloud sync if available
			if ((globalThis as any).triggerCloudSync) {
				(globalThis as any).triggerCloudSync();
			}

			btn.textContent = 'Saved!';

			// Enable Load button since settings now exist
			checkLoadButtonState();

			setTimeout(() => {
				btn.textContent = originalText;
				btn.disabled = false;
			}, 3000);
		} catch (error) {
			console.error('Failed to save settings:', error);
			btn.textContent = 'Error';
			setTimeout(() => {
				btn.textContent = originalText;
				btn.disabled = false;
			}, 3000);
		}
	});

	// Load button handler
	document.querySelector('#btn-load-settings')?.addEventListener('click', event => {
		const btn = event.currentTarget as HTMLButtonElement;
		const originalText = btn.textContent;
		btn.disabled = true;
		btn.textContent = 'Loading...';

		try {
			// Load from localStorage
			loadFromLocalStorage();

			// Update display
			if ('arbys' in globalThis) {
				(globalThis as any).updateLog();
			}

			// Update URL hash to match loaded settings
			(globalThis as any).saveSettings?.();

			btn.textContent = 'Loaded!';
			setTimeout(() => {
				btn.textContent = originalText;
				btn.disabled = false;
			}, 3000);
		} catch (error) {
			console.error('Failed to load settings:', error);
			btn.textContent = 'Error';
			setTimeout(() => {
				btn.textContent = originalText;
				btn.disabled = false;
			}, 3000);
		}
	});
}

// Wait for cloud sync to emit one of its events (or timeout), then check Load button state.
// `.then()` is used instead of top-level await to avoid blocking the rest of module initialization.
const cloudSyncEvent = new Promise<string>(resolve => {
	globalThis.addEventListener('cloud-sync-complete', () => {
		resolve('complete');
	}, {once: true});
	globalThis.addEventListener('cloud-sync-unavailable', () => {
		resolve('unavailable');
	}, {once: true});
	globalThis.addEventListener('cloud-sync-unauthenticated', () => {
		resolve('unauthenticated');
	}, {once: true});
	globalThis.addEventListener('cloud-sync-error', () => {
		resolve('error');
	}, {once: true});
	setTimeout(() => {
		resolve('timeout');
	}, 3000);
});

/* eslint-disable unicorn/prefer-top-level-await */
cloudSyncEvent.then(() => {
	checkLoadButtonState();
}).catch((error: unknown) => {
	console.error('Unexpected cloud sync event error:', error);
});
/* eslint-enable unicorn/prefer-top-level-await */

// Re-check on subsequent pulls (e.g. real-time sync from another device)
globalThis.addEventListener('cloud-sync-pulled', () => {
	checkLoadButtonState();
});

(globalThis as any).initializeSettingsButtons = initializeSettingsButtons;
