/**
 * Arbys save/load settings
 *
 * Handles persisting arbitration filter and display settings to localStorage,
 * wiring up Save/Load button click handlers, and re-checking the Load button
 * state after cloud sync events.
 */
import { waitForCloudSync } from '../cloud-sync/trigger.js';
function saveToLocalStorage() {
    const settings = {
        select_days: document.querySelector('#select-days').value,
        select_tz: document.querySelector('#select-tz').value,
        select_hourfmt: document.querySelector('#select-hourfmt').value,
        filters: {},
    };
    // Save all filter checkbox states
    for (const checkbox of document.querySelectorAll('input[type=checkbox][id^="filter-"]')) {
        const filterId = checkbox.id.slice(7); // Remove "filter-" prefix
        settings.filters[filterId] = checkbox.checked;
    }
    localStorage.setItem('arbys.settings', JSON.stringify(settings));
}
function loadFromLocalStorage() {
    const settingsJson = localStorage.getItem('arbys.settings');
    if (!settingsJson) {
        return;
    }
    try {
        const settings = JSON.parse(settingsJson);
        // Restore dropdown values
        if (settings.select_days) {
            document.querySelector('#select-days').value = settings.select_days;
        }
        if (settings.select_tz) {
            document.querySelector('#select-tz').value = settings.select_tz;
        }
        if (settings.select_hourfmt) {
            document.querySelector('#select-hourfmt').value = settings.select_hourfmt;
        }
        // Restore checkbox states
        if (settings.filters) {
            for (const [filterId, checked] of Object.entries(settings.filters)) {
                const checkbox = document.querySelector(`#filter-${filterId}`);
                if (checkbox) {
                    checkbox.checked = checked;
                }
            }
        }
    }
    catch (error) {
        console.error('Failed to parse saved settings:', error);
    }
}
export function checkLoadButtonState() {
    const btnLoad = document.querySelector('#btn-load-settings');
    if (!btnLoad) {
        return;
    }
    let shouldDisable = true;
    const settingsJson = localStorage.getItem('arbys.settings');
    if (settingsJson) {
        try {
            JSON.parse(settingsJson); // Validate it's valid JSON
            shouldDisable = false;
        }
        catch {
            // Invalid JSON — keep disabled
        }
    }
    btnLoad.disabled = shouldDisable;
}
export function initializeSettingsButtons() {
    // Save button handler
    document.querySelector('#btn-save-settings')?.addEventListener('click', event => {
        const btn = event.currentTarget;
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Saving...';
        try {
            // Save to localStorage
            saveToLocalStorage();
            // Trigger cloud sync if available
            if (window.triggerCloudSync) {
                window.triggerCloudSync();
            }
            btn.textContent = 'Saved!';
            // Enable Load button since settings now exist
            checkLoadButtonState();
            setTimeout(() => {
                btn.textContent = originalText;
                btn.disabled = false;
            }, 3000);
        }
        catch (error) {
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
        const btn = event.currentTarget;
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Loading...';
        try {
            // Load from localStorage
            loadFromLocalStorage();
            // Update display
            if ('arbys' in window) {
                window.updateLog?.();
            }
            // Update URL hash to match loaded settings
            window.saveSettings?.();
            btn.textContent = 'Loaded!';
            setTimeout(() => {
                btn.textContent = originalText;
                btn.disabled = false;
            }, 3000);
        }
        catch (error) {
            console.error('Failed to load settings:', error);
            btn.textContent = 'Error';
            setTimeout(() => {
                btn.textContent = originalText;
                btn.disabled = false;
            }, 3000);
        }
    });
}
// `.then()` is used instead of top-level await to avoid blocking the rest of module initialization.
/* eslint-disable unicorn/prefer-top-level-await */
waitForCloudSync().then(() => {
    checkLoadButtonState();
}).catch((error) => {
    console.error('Unexpected cloud sync event error:', error);
});
/* eslint-enable unicorn/prefer-top-level-await */
// Re-check on subsequent pulls (e.g. real-time sync from another device)
globalThis.addEventListener('cloud-sync-pulled', () => {
    checkLoadButtonState();
});
window.initializeSettingsButtons = initializeSettingsButtons;
//# sourceMappingURL=settings.js.map