/**
 * Reconnection manager with exponential backoff
 *
 * Handles WebSocket reconnection after failures (CLOSED, TIMED_OUT, CHANNEL_ERROR).
 * Uses exponential backoff starting at 1.875s, capping at 5 minutes.
 * Retries indefinitely — no max attempt limit.
 */

import {logger} from '../logger.js';
import {db} from './database.js';

export class CloudSyncReconnection {
	private reconnectAttempts = 0;
	private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
	private lastKnownFreshDataTimestamp: number | undefined;

	private static get initialBackoffMs() {
		return 1875;
	}

	private static get maxBackoffMs() {
		return 5 * 60 * 1000; // 5 minutes
	}

	private static get errorThresholdMs() {
		return 60 * 1000; // 1 minute — escalate to logger.error above this
	}

	constructor(
		private readonly onReconnect: (userId: string) => void,
		private readonly getCurrentUserId: () => string | undefined,
	) {
		// Injected dependencies: onReconnect triggers resubscription,
		// getCurrentUserId is read lazily so logout between schedule and fire is respected
	}

	get attempts(): number {
		return this.reconnectAttempts;
	}

	get timer(): ReturnType<typeof setTimeout> | undefined {
		return this.reconnectTimer;
	}

	get lastFreshTimestamp(): number | undefined {
		return this.lastKnownFreshDataTimestamp;
	}

	set lastFreshTimestamp(value: number | undefined) {
		this.lastKnownFreshDataTimestamp = value;
	}

	/**
	 * Clear reconnect counter and pending timer (e.g. on successful connection).
	 * Does NOT clear lastFreshTimestamp — use clearAll() for that.
	 */
	reset(): void {
		this.reconnectAttempts = 0;
		if (this.reconnectTimer !== undefined) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = undefined;
		}
	}

	/**
	 * Clear all state including the fresh timestamp (e.g. on logout/unsubscribe).
	 */
	clearAll(): void {
		this.reset();
		this.lastKnownFreshDataTimestamp = undefined;
	}

	/**
	 * Schedule a reconnection attempt with exponential backoff.
	 * Clears any pending timer before scheduling a new one.
	 * The user ID is read lazily when the timer fires, so logout between
	 * schedule and fire is respected.
	 */
	attemptReconnect(): void {
		// Clear any existing reconnect timer
		if (this.reconnectTimer !== undefined) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = undefined;
		}

		const delayMs = Math.min(
			CloudSyncReconnection.initialBackoffMs * (2 ** this.reconnectAttempts),
			CloudSyncReconnection.maxBackoffMs,
		);
		this.reconnectAttempts++;

		const lastConnectedMessage = this.lastKnownFreshDataTimestamp
			? `Last connected: ${new Date(this.lastKnownFreshDataTimestamp).toLocaleTimeString()}`
			: 'Never successfully connected';

		if (delayMs >= CloudSyncReconnection.errorThresholdMs) {
			const minutes = delayMs / 60_000;
			const delayDisplay = `${minutes} minute${minutes > 1 ? 's' : ''}`;
			logger.error(`❌ WebSocket disconnected. Retrying in ${delayDisplay} (attempt ${this.reconnectAttempts}). ${lastConnectedMessage}`);
		} else {
			logger.debug(`🔄 WebSocket disconnected. Reconnecting in ${delayMs / 1000}s (attempt ${this.reconnectAttempts}). ${lastConnectedMessage}`);
		}

		this.reconnectTimer = globalThis.setTimeout(() => {
			this.reconnectTimer = undefined;
			void (async () => {
				const userId = this.getCurrentUserId();
				if (userId) {
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

					this.onReconnect(userId);
				}
			})();
		}, delayMs);
	}
}
