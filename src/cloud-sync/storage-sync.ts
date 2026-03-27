/**
 * Storage sync service for cloud sync
 *
 * Handles bidirectional synchronization between localStorage and cloud database.
 * Implements 5-second debouncing for efficient batching of rapid changes.
 */

import {logger} from '../logger.js';
import {db, isDatabaseConfigured} from './database.js';
import {AuthService} from './auth.js';
import type {UserData} from './types.js';

/**
 * Set a value in a nested object using dot-separated path
 * e.g., setNestedValue({}, "live.filter.news.danger", "0")
 *   → {live: {filter: {news: {danger: "0"}}}}
 */
function setNestedValue(object: Record<string, any>, path: string, value: any): void {
	const keys = path.split('.');
	let current = object;

	for (let i = 0; i < keys.length - 1; i++) {
		const key = keys[i];
		if (!(key in current)) {
			current[key] = {};
		}

		current = current[key];
	}

	// eslint-disable-next-line unicorn/prefer-at -- .at() is ES2022; this project targets ES2021
	current[keys[keys.length - 1]] = value;
}

/**
 * Flatten nested object back to dot-separated keys
 * e.g., {live: {collapse: {news: "1"}}} → {"live.collapse.news": "1"}
 */
function flattenObject(object: Record<string, any>, prefix = ''): Record<string, any> {
	const result: Record<string, any> = {};

	for (const [key, value] of Object.entries(object)) {
		const newKey = prefix ? `${prefix}.${key}` : key;

		if (value && typeof value === 'object' && !Array.isArray(value)) {
			Object.assign(result, flattenObject(value, newKey));
		} else {
			result[newKey] = value;
		}
	}

	return result;
}

export class StorageSyncService {
	static getInstance(): StorageSyncService {
		StorageSyncService.instance ||= new StorageSyncService();

		return StorageSyncService.instance;
	}

	private static instance: StorageSyncService;

	// LocalStorage keys excluded from cloud sync:
	// - sb-*-auth-token: Supabase session token; sensitive, must never leave the device
	// - profile.data*: Large Warframe profile JSON cache; device-specific, not user preferences
	private static get localOnlyKeyRegex() {
		return /^(?:sb-.*-auth-token|profile\.data)/u;
	}

	private static get heartbeatIntervalMs() {
		return 5000;
	}

	private static get quickReconnectThresholdMs() {
		return 10_000;
	} // Must be greater than HEARTBEAT_INTERVAL_MS

	private static get visibilityPullThrottleMs() {
		return 60_000;
	} // Minimum interval between visibility-triggered pulls

	private loginSyncComplete = false;
	private syncing = false;
	private realtimeChannel: any;
	private justPushed = false; // Track when we just pushed to avoid pulling our own update
	private justPushedTimeout: ReturnType<typeof setTimeout> | undefined; // Timeout for clearing justPushed flag
	private hasSubscribedBefore = false; // Track initial subscription
	private reconnectAttempts = 0; // Track reconnection attempts for exponential backoff
	private reconnectTimer: ReturnType<typeof setTimeout> | undefined; // Timer for reconnection attempts
	private currentUserId: string | undefined; // Track current user UUID for reconnection
	private lastKnownFreshDataTimestamp: number | undefined; // Track when local data was last known fresh

	private constructor() {
		if (isDatabaseConfigured()) {
			this.startHeartbeat();
			this.startVisibilityPullFallback();
		}
	}

	/**
	 * Called when user logs in
	 * Cloud is source of truth - always pull if remote data exists
	 */
	async handleLogin() {
		if (this.loginSyncComplete || this.syncing) {
			return;
		}

		try {
			this.syncing = true;
			const userId = AuthService.getInstance().getUserId();
			if (!userId) {
				throw new Error('No user ID available');
			}

			// Check if remote data exists
			const {data: remoteData, error} = await db
				.from('user_data')
				.select('data')
				.eq('user_id', userId)
				.single();

			if (error || !remoteData) {
				// First time login - upload localStorage to database
				await this.pushToDatabase(userId);
				logger.log('💻➡️☁️ Your data has been backed up to the cloud');
			} else {
				// Remote data exists - pull from cloud (cloud is source of truth)
				await this.pullFromDatabase(userId);
				logger.log('☁️➡️💻 Synced data from cloud');
			}

			// Enable real-time sync for cross-device/cross-tab updates
			this.subscribeToRealtimeUpdates(userId);
			this.loginSyncComplete = true;
			globalThis.dispatchEvent(new CustomEvent('cloud-sync-complete'));
		} catch (error) {
			console.error('Cloud sync error:', error);
			globalThis.dispatchEvent(new CustomEvent('cloud-sync-error', {detail: error}));
		} finally {
			this.syncing = false;
		}
	}

	/**
   * Upload localStorage data to database (last write wins)
   */
	async pushToDatabase(userId: string) {
		globalThis.dispatchEvent(new CustomEvent('cloud-sync-before-push'));

		const data = this.localStorageToData();

		this.justPushed = true;

		// Clear any existing timeout to prevent race condition with multiple pushes
		if (this.justPushedTimeout !== undefined) {
			clearTimeout(this.justPushedTimeout);
		}

		try {
			const {error} = await db
				.from('user_data')
				.upsert({
					user_id: userId,
					data,
				});

			if (error) {
				throw new Error(error.message);
			}

			// Clear flag after push completes + 5 second buffer to ignore our own real-time update
			this.justPushedTimeout = globalThis.setTimeout(() => {
				this.justPushed = false;
				this.justPushedTimeout = undefined;
			}, 5000);
		} catch (error) {
			this.justPushed = false;
			if (this.justPushedTimeout !== undefined) {
				clearTimeout(this.justPushedTimeout);
				this.justPushedTimeout = undefined;
			}

			throw error;
		}
	}

	/**
   * Download database data to localStorage (single query)
   * Automatically refreshes UI after updating localStorage
   */
	async pullFromDatabase(userId: string) {
		const {data: row, error} = await db
			.from('user_data')
			.select('data')
			.eq('user_id', userId)
			.single();

		if (error) {
			logger.error('Error pulling from database:', error);
			throw new Error(error.message);
		}

		if (!row) {
			return;
		}

		this.dataToLocalStorage(row.data as UserData);
		globalThis.dispatchEvent(new CustomEvent('cloud-sync-pulled'));
	}

	/**
   * Subscribe to real-time updates from database
   * Uses WebSockets (not polling) - efficient for free tier
   *
   * Note: You may see browser warnings about Cloudflare "__cf_bm" cookie being rejected.
   * This is harmless - it's the browser enforcing cookie security policies when Supabase
   * handles Cloudflare's bot management cookies. We cannot catch these browser warnings.
   */
	subscribeToRealtimeUpdates(userId: string) {
		// Save current user UUID for reconnection attempts
		this.currentUserId = userId;
		// Unsubscribe from previous channel if exists
		if (this.realtimeChannel) {
			this.realtimeChannel.unsubscribe();
		}

		// Subscribe to changes on this user's row
		this.realtimeChannel = db.channel(`user_data:${userId}`)
			.on('postgres_changes', {
				event: 'UPDATE',
				schema: 'public',
				table: 'user_data',
				filter: `user_id=eq.${userId}`,
			}, async (_payload: any) => {
				// Skip if this update was triggered by our own push
				if (this.justPushed) {
					return;
				}

				// Another device/tab updated our data
				// Only pull if we're not currently pushing
				if (!this.syncing) {
					try {
						this.syncing = true;
						await this.pullFromDatabase(userId);
						logger.log('☁️➡️💻 Synced data from cloud');
					} finally {
						this.syncing = false;
					}
				}
			})
			.subscribe(async (status: string) => {
				logger.debug('📡 WebSocket status:', status, '| hasSubscribedBefore:', this.hasSubscribedBefore, '| reconnectAttempts:', this.reconnectAttempts);

				// When WebSocket reconnects after sleep/network loss, pull fresh data
				if (status === 'SUBSCRIBED') {
					// Reset reconnection counter on successful connection
					if (this.reconnectAttempts > 0) {
						logger.debug('✅ WebSocket reconnected successfully after', this.reconnectAttempts, 'attempts');
					}

					this.reconnectAttempts = 0;
					if (this.reconnectTimer !== undefined) {
						clearTimeout(this.reconnectTimer);
						this.reconnectTimer = undefined;
					}

					if (this.hasSubscribedBefore) {
						// Calculate time since last known fresh data (heartbeat check)
						const timeSinceLastFreshMs = this.lastKnownFreshDataTimestamp
							? Date.now() - this.lastKnownFreshDataTimestamp
							: Infinity;

						if (timeSinceLastFreshMs <= StorageSyncService.quickReconnectThresholdMs) {
							logger.debug(`⚡ Reconnected with recent heartbeat (${(timeSinceLastFreshMs / 1000).toFixed(1)}s ago) - skipping pull`);
							// Recent heartbeat means connection was healthy - no need to pull
							// This handles quick reconnects like JWT expiry (hourly)
							return;
						}

						logger.debug(`🔄 Reconnected${this.lastKnownFreshDataTimestamp ? ` with stale heartbeat (${(timeSinceLastFreshMs / 1000).toFixed(1)}s ago)` : ''} - pulling fresh data`);
						// Stale heartbeat - pull to catch up on missed updates
						// This handles device sleep, long network outages, etc.
						if (!this.syncing) {
							try {
								this.syncing = true;
								await this.pullFromDatabase(userId);
								logger.log('☁️➡️💻 Synced data from cloud (reconnected)');
							} finally {
								this.syncing = false;
							}
						}
					} else {
						logger.debug('✅ First subscription established');
						// First subscription - no pull needed (already handled in handleLogin)
						this.hasSubscribedBefore = true;
					}
				} else if (status === 'CLOSED' || status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
					// WebSocket entered a failed state (expected when JWT expires) - attempt to reconnect
					logger.debug('⚠️ WebSocket entered failed state:', status);
					this.attemptReconnect();
				}
			});
	}

	/**
   * Unsubscribe from real-time updates
   */
	unsubscribeFromRealtimeUpdates() {
		// Clear reconnection timer
		if (this.reconnectTimer !== undefined) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = undefined;
		}

		// Reset reconnection state and login sync guard (allows re-sync on next login)
		this.reconnectAttempts = 0;
		this.loginSyncComplete = false;
		this.currentUserId = undefined;
		this.lastKnownFreshDataTimestamp = undefined;

		if (this.realtimeChannel) {
			this.realtimeChannel.unsubscribe();
			this.realtimeChannel = undefined;
		}
	}

	/**
   * Convert localStorage to nested object based on dot-separated keys
   * Stores values exactly as they appear in localStorage (no transformations)
   */
	private localStorageToData(): Record<string, any> {
		const data: Record<string, any> = {};

		// Iterate through all localStorage keys and serialize
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (!key || StorageSyncService.localOnlyKeyRegex.test(key)) {
				continue;
			}

			const value = localStorage.getItem(key);
			if (value === null) {
				continue;
			}

			// Create nested structure based on dots in the key
			setNestedValue(data, key, value);
		}

		return data;
	}

	/**
   * Convert nested object to localStorage using dot-separated keys
   * Stores values exactly as they are (no transformations)
   */
	private dataToLocalStorage(data: Record<string, any>) {
		// Clear all localStorage except local-only keys (e.g., auth token)
		for (let i = localStorage.length - 1; i >= 0; i--) {
			const key = localStorage.key(i);
			if (key && !StorageSyncService.localOnlyKeyRegex.test(key)) {
				localStorage.removeItem(key);
			}
		}

		// Flatten nested structure back to localStorage keys
		const flattened = flattenObject(data);

		// Store all values exactly as they are
		for (const [key, value] of Object.entries(flattened)) {
			localStorage.setItem(key, String(value));
		}
	}

	/**
   * Start periodic heartbeat to track connection health
   * Runs continuously - only updates timestamp when channel is in 'joined' state
   */
	private startHeartbeat() {
		globalThis.setInterval(() => {
			if (this.realtimeChannel?.state === 'joined') {
				this.lastKnownFreshDataTimestamp = Date.now();
				logger.debug('💓 Heartbeat: Connection healthy');
			}
		}, StorageSyncService.heartbeatIntervalMs);
	}

	/**
   * Pull fresh data when tab becomes visible and WebSocket is unhealthy.
   * Handles the case where the WebSocket can't reconnect (e.g., extended
   * connectivity issues) so completion checkboxes and other synced state
   * still get refreshed when the user returns to the tab.
   */
	private startVisibilityPullFallback() {
		document.addEventListener('visibilitychange', () => {
			void (async () => {
				// Throttle to once per minute to avoid excessive requests when flipping tabs
				const timeSinceLastFreshMs = this.lastKnownFreshDataTimestamp
					? Date.now() - this.lastKnownFreshDataTimestamp
					: Infinity;

				if (document.hidden
					|| !this.currentUserId
					|| this.syncing
					|| this.realtimeChannel?.state === 'joined' // WebSocket is healthy
					|| timeSinceLastFreshMs < StorageSyncService.visibilityPullThrottleMs
				) {
					return;
				}

				try {
					this.syncing = true;
					await this.pullFromDatabase(this.currentUserId);
					this.lastKnownFreshDataTimestamp = Date.now();
					logger.log('☁️➡️💻 Synced data from cloud (visibility fallback)');
				} catch (error) {
					logger.debug('⚠️ Visibility pull fallback failed:', error);
				} finally {
					this.syncing = false;
				}
			})();
		});
	}

	/**
   * Attempt to reconnect to realtime updates with exponential backoff
   * Called when websocket enters a failed state (CLOSED, TIMED_OUT, CHANNEL_ERROR)
   */
	private attemptReconnect() {
		// Clear any existing reconnect timer
		if (this.reconnectTimer !== undefined) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = undefined;
		}

		// Exponential backoff: 1.875s, 3.75s, 7.5s, 15s, 30s, 60s, 120s, 240s, then cap at 5 minutes
		// No max attempts - retry indefinitely during extended outages
		const INITIAL_BACKOFF_MS = 1875; // Start at 1.875 seconds
		const MAX_BACKOFF_MS = 5 * 60 * 1000; // 5 minutes
		const delayMs = Math.min(INITIAL_BACKOFF_MS * (2 ** this.reconnectAttempts), MAX_BACKOFF_MS);
		this.reconnectAttempts++;

		// Format error message with attempt count and last connection timestamp
		const lastConnectedMessage = this.lastKnownFreshDataTimestamp
			? `Last connected: ${new Date(this.lastKnownFreshDataTimestamp).toLocaleTimeString()}`
			: 'Never successfully connected';

		// Use logger.error when delay is >= 1 minute to make long outages more visible
		const ERROR_THRESHOLD_MS = 60 * 1000; // 1 minute
		if (delayMs >= ERROR_THRESHOLD_MS) {
			const delayDisplay = delayMs >= 60_000
				? `${delayMs / 60_000} minute${delayMs / 60_000 > 1 ? 's' : ''}`
				: `${delayMs / 1000}s`;
			logger.error(`❌ WebSocket disconnected. Retrying in ${delayDisplay} (attempt ${this.reconnectAttempts}). ${lastConnectedMessage}`);
		} else {
			logger.debug(`🔄 WebSocket disconnected. Reconnecting in ${delayMs / 1000}s (attempt ${this.reconnectAttempts}). ${lastConnectedMessage}`);
		}

		this.reconnectTimer = globalThis.setTimeout(() => {
			this.reconnectTimer = undefined;
			void (async () => {
				if (this.currentUserId) {
					logger.debug('🔌 Attempting to reestablish WebSocket connection...');

					// Ensure we have a fresh session token before reconnecting
					// This handles the case where JWT expired during long sleep
					try {
						const {data: {session}, error} = await db.auth.refreshSession();
						if (error) {
							logger.debug('⚠️ Session refresh failed:', error.message);
							// Don't give up - attempt reconnection anyway in case it's a transient error
						} else if (session) {
							logger.debug('✅ Session refreshed successfully');
						}
					} catch (error) {
						logger.debug('⚠️ Session refresh exception:', error);
						// Continue with reconnection attempt
					}

					this.subscribeToRealtimeUpdates(this.currentUserId);
				}
			})();
		}, delayMs);
	}
}
