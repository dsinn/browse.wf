/**
 * Storage serializer for cloud sync
 *
 * Pure data transforms between localStorage and nested objects.
 * No auth, database, or WebSocket dependencies.
 */
// LocalStorage keys excluded from cloud sync:
// - sb-*-auth-token: Supabase session token; sensitive, must never leave the device
// - profile.data*: Large Warframe profile JSON cache; device-specific, not user preferences
export const localOnlyKeyRegex = /^(?:sb-.*-auth-token|profile\.data)/u;
/**
 * Set a value in a nested object using dot-separated path
 * e.g., setNestedValue({}, "live.filter.news.danger", "0")
 *   → {live: {filter: {news: {danger: "0"}}}}
 */
export function setNestedValue(object, path, value) {
    const keys = path.split('.');
    let current = object;
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!(key in current)) {
            current[key] = {};
        }
        current = current[key];
    }
    current[keys[keys.length - 1]] = value;
}
/**
 * Flatten nested object back to dot-separated keys
 * e.g., {live: {collapse: {news: "1"}}} → {"live.collapse.news": "1"}
 */
export function flattenObject(object, prefix = '') {
    const result = {};
    for (const [key, value] of Object.entries(object)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            Object.assign(result, flattenObject(value, newKey));
        }
        else {
            result[newKey] = value;
        }
    }
    return result;
}
/**
 * Convert localStorage to nested object based on dot-separated keys
 * Stores values exactly as they appear in localStorage (no transformations)
 */
export function localStorageToData() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || localOnlyKeyRegex.test(key)) {
            continue;
        }
        setNestedValue(data, key, localStorage.getItem(key));
    }
    return data;
}
/**
 * Convert nested object to localStorage using dot-separated keys
 * Stores values exactly as they are (no transformations)
 */
export function dataToLocalStorage(data) {
    // Clear all localStorage except local-only keys (e.g., auth token)
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && !localOnlyKeyRegex.test(key)) {
            localStorage.removeItem(key);
        }
    }
    const flattened = flattenObject(data);
    for (const [key, value] of Object.entries(flattened)) {
        localStorage.setItem(key, String(value));
    }
}
//# sourceMappingURL=serializer.js.map