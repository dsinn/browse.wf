/**
 * News Mark as Read System
 * Fork-specific feature to track which news items have been read
 */
import { triggerCloudSyncWithDebounce as triggerCloudSync } from '../cloud-sync/trigger.js';
const ALL_READ_TIMESTAMP_KEY = 'live.news.all_read_timestamp';
const READ_COLLECTION_KEY = 'news_items_read';
/**
 * Generate unique key for a news item
 * Format: {link}|{timestamp}
 * Items without links use empty string for URL part
 */
function generateNewsItemKey(item) {
    const linkPart = item.link || '';
    return `${linkPart}|${item.time}`;
}
/**
 * Set data attributes on a news item element for use by the mark-as-read system
 */
export function setNewsItemData(item, element) {
    element.dataset.newsKey = generateNewsItemKey(item);
    element.dataset.newsTime = item.time.toString();
}
/**
 * Check if a news item is marked as read.
 * Returns true if the item's timestamp is at or before the bulk-read threshold,
 * or if its key was individually marked as read.
 */
export function isNewsItemRead(item) {
    const key = generateNewsItemKey(item);
    const threshold = getAllReadThreshold();
    if (threshold !== undefined && item.time <= threshold) {
        return true;
    }
    return getReadItems().includes(key);
}
/**
 * Mark a news item as read
 * Updates localStorage, triggers cloud sync, and updates UI
 */
export function markNewsItemAsRead(item, element) {
    // Don't re-mark already read items
    if (element.classList.contains('news-read')) {
        return;
    }
    const key = generateNewsItemKey(item);
    const readItems = getReadItems();
    // Add to read items if not already present
    if (!readItems.includes(key)) {
        readItems.push(key);
        saveReadItems(readItems);
        // Trigger cloud sync
        triggerCloudSync();
    }
    // Update UI - add read class
    element.classList.add('news-read');
}
/**
 * Mark all currently visible primary/success news items as read.
 * Sets a timestamp threshold: all items at or before this time are considered read.
 * Also clears the individual key array since the threshold covers everything.
 * Pre-condition: news items are rendered in reverse chronological order (live.ts sorts before rendering),
 * so the first [data-news-key] element has the highest timestamp.
 */
export function markAllNewsAsRead() {
    const newsBody = document.querySelector('#news-body');
    if (!newsBody) {
        return;
    }
    const firstItem = newsBody.querySelector('[data-news-time]');
    if (!firstItem) {
        return;
    }
    const newestTime = Number(firstItem.dataset.newsTime);
    if (!newestTime) {
        return;
    }
    for (const element of newsBody.querySelectorAll('[data-news-key]')) {
        element.classList.add('news-read');
    }
    const currentThreshold = getAllReadThreshold();
    const newThreshold = currentThreshold === undefined ? newestTime : Math.max(currentThreshold, newestTime);
    if (newThreshold === currentThreshold) {
        return;
    }
    localStorage.setItem(ALL_READ_TIMESTAMP_KEY, String(newThreshold));
    localStorage.removeItem(READ_COLLECTION_KEY);
    triggerCloudSync();
}
/**
 * Remove read items that no longer exist in current news data, or are covered by the threshold.
 * Called before cloud sync to prevent stale data accumulation.
 * Only runs if News card is present in DOM.
 */
export function pruneStaleNewsRead() {
    const newsBody = document.querySelector('#news-body');
    if (!newsBody) {
        return;
    } // News card not present, skip pruning
    const readItems = getReadItems();
    if (readItems.length === 0) {
        return;
    } // Nothing to prune
    // Get all valid keys from currently displayed news items
    const validKeys = new Set();
    for (const element of newsBody.querySelectorAll('[data-news-key]')) {
        const key = element.dataset.newsKey;
        if (key) {
            validKeys.add(key);
        }
    }
    // Guard: Skip pruning if no news items in DOM
    // This prevents clearing all data when news hasn't loaded yet
    if (validKeys.size === 0) {
        return;
    }
    // Keep only keys that still exist in current news data
    const cleanedRead = readItems.filter(key => validKeys.has(key));
    // Save cleaned list (or remove key if empty)
    if (cleanedRead.length > 0) {
        saveReadItems(cleanedRead);
    }
    else {
        localStorage.removeItem(READ_COLLECTION_KEY);
    }
}
/**
 * Get read items from localStorage
 */
function getReadItems() {
    const stored = localStorage.getItem(READ_COLLECTION_KEY);
    if (!stored) {
        return [];
    }
    try {
        return JSON.parse(stored);
    }
    catch (error) {
        console.error('Failed to parse news_items_read from localStorage:', error);
        return [];
    }
}
/**
 * Get the bulk-read timestamp threshold from localStorage, or undefined if not set
 */
function getAllReadThreshold() {
    const stored = localStorage.getItem(ALL_READ_TIMESTAMP_KEY);
    if (!stored) {
        return undefined;
    }
    const value = Number(stored);
    return Number.isNaN(value) ? undefined : value;
}
/**
 * Save read items to localStorage
 */
function saveReadItems(items) {
    if (items.length > 0) {
        localStorage.setItem(READ_COLLECTION_KEY, JSON.stringify(items));
    }
    else {
        localStorage.removeItem(READ_COLLECTION_KEY);
    }
}
/**
 * Initialize mark-as-read UI handlers
 * Sets up "Mark all as read" button
 */
export function initializeMarkAsRead() {
    const markAllBtn = document.querySelector('#news-mark-all-read');
    if (markAllBtn) {
        markAllBtn.addEventListener('click', event => {
            event.preventDefault();
            markAllNewsAsRead();
        });
    }
}
window.initializeMarkAsRead = initializeMarkAsRead;
window.isNewsItemRead = isNewsItemRead;
window.markAllNewsAsRead = markAllNewsAsRead;
window.markNewsItemAsRead = markNewsItemAsRead;
window.pruneStaleNewsRead = pruneStaleNewsRead;
window.setNewsItemData = setNewsItemData;
//# sourceMappingURL=news-mark-read.js.map