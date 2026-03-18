/**
 * News Mark as Read System
 * Fork-specific feature to track which news items have been read
 * Excludes red text (danger) items - only applies to primary/success
 */

type NewsItem = {
	type: 'danger' | 'primary' | 'success';
	data: string;
	time: number;
	link?: string;
};

const STORAGE_KEY = 'news_items_read';

/**
 * Generate unique key for a news item
 * Format: {link}|{timestamp}
 * Items without links use empty string for URL part
 */
export function generateNewsItemKey(item: NewsItem): string {
	const linkPart = item.link || '';
	return `${linkPart}|${item.time}`;
}

/**
 * Check if a news item is marked as read
 */
export function isNewsItemRead(key: string): boolean {
	const readItems = getReadItems();
	return readItems.includes(key);
}

/**
 * Mark a news item as read
 * Updates localStorage, triggers cloud sync, and updates UI
 */
export function markNewsItemAsRead(key: string, element: HTMLElement): void {
	// Don't re-mark already read items
	if (element.classList.contains('news-read')) {
		return;
	}

	const readItems = getReadItems();

	// Add to read items if not already present
	if (!readItems.includes(key)) {
		readItems.push(key);
		saveReadItems(readItems);

		// Trigger cloud sync (use global function)
		if ((globalThis as any).triggerCloudSync) {
			(globalThis as any).triggerCloudSync();
		}
	}

	// Update UI - add read class
	element.classList.add('news-read');
}

/**
 * Mark all currently visible primary/success news items as read
 * Excludes danger (red text) items
 */
export function markAllNewsAsRead(): void {
	const newsBody = document.querySelector('#news-body');
	if (!newsBody) {
		return;
	}

	const readItems = getReadItems();
	let hasChanges = false;

	// Find all primary/success news items (those with data-news-key attribute)
	for (const element of newsBody.querySelectorAll<HTMLElement>('[data-news-key]')) {
		const key = element.dataset.newsKey;
		if (!key) {
			continue;
		}

		// Add to read items if not already present
		if (!readItems.includes(key)) {
			readItems.push(key);
			hasChanges = true;
		}

		// Update UI
		if (!element.classList.contains('news-read')) {
			element.classList.add('news-read');
		}
	}

	if (hasChanges) {
		saveReadItems(readItems);

		// Trigger cloud sync (use global function)
		if ((globalThis as any).triggerCloudSync) {
			(globalThis as any).triggerCloudSync();
		}
	}
}

/**
 * Remove read items that no longer exist in current news data
 * Called before cloud sync to prevent stale data accumulation
 * Only runs if News card is present in DOM
 */
export function pruneStaleNewsRead(): void {
	const newsBody = document.querySelector('#news-body');
	if (!newsBody) {
		return;
	} // News card not present, skip pruning

	const readItems = getReadItems();
	if (readItems.length === 0) {
		return;
	} // Nothing to prune

	// Get all valid keys from currently displayed news items
	const validKeys = new Set<string>();
	for (const element of newsBody.querySelectorAll<HTMLElement>('[data-news-key]')) {
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
	} else {
		localStorage.removeItem(STORAGE_KEY);
	}
}

/**
 * Get read items from localStorage
 */
function getReadItems(): string[] {
	const stored = localStorage.getItem(STORAGE_KEY);
	if (!stored) {
		return [];
	}

	try {
		return JSON.parse(stored);
	} catch (error) {
		console.error('Failed to parse news_items_read from localStorage:', error);
		return [];
	}
}

/**
 * Save read items to localStorage
 */
function saveReadItems(items: string[]): void {
	if (items.length > 0) {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
	} else {
		localStorage.removeItem(STORAGE_KEY);
	}
}

/**
 * Initialize mark-as-read UI handlers
 * Sets up "Mark all as read" button
 */
export function initializeMarkAsRead(): void {
	const markAllBtn = document.querySelector('#news-mark-all-read');
	if (markAllBtn) {
		markAllBtn.addEventListener('click', event => {
			event.preventDefault();
			markAllNewsAsRead();
		});
	}
}

// Expose functions globally for non-module scripts
(globalThis as any).generateNewsItemKey = generateNewsItemKey;
(globalThis as any).isNewsItemRead = isNewsItemRead;
(globalThis as any).markNewsItemAsRead = markNewsItemAsRead;
(globalThis as any).markAllNewsAsRead = markAllNewsAsRead;
(globalThis as any).pruneStaleNewsRead = pruneStaleNewsRead;
(globalThis as any).initializeMarkAsRead = initializeMarkAsRead;
