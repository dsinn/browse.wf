/**
 * Connection health monitor
 *
 * Tracks WebSocket connection health via periodic heartbeat.
 * Falls back to HTTP pull when tab becomes visible after a stale connection.
 */
import { logger } from '../logger.js';
export class CloudSyncHealthMonitor {
    /** Must be greater than heartbeat interval (5s) */
    static get quickReconnectThresholdMs() {
        return 10_000;
    }
    static get heartbeatIntervalMs() {
        return 5000;
    }
    /** Minimum interval between visibility-triggered pulls */
    static get visibilityPullThrottleMs() {
        return 60_000;
    }
    /**
     * Start periodic heartbeat to track connection health.
     * Updates lastFreshTimestamp only when channel is in 'joined' state.
     */
    startHeartbeat(getChannelState, setLastFreshTimestamp) {
        globalThis.setInterval(() => {
            if (getChannelState() === 'joined') {
                setLastFreshTimestamp(Date.now());
                logger.debug('💓 Heartbeat: Connection healthy');
            }
        }, CloudSyncHealthMonitor.heartbeatIntervalMs);
    }
    /**
     * Pull fresh data when tab becomes visible and WebSocket is unhealthy.
     * Handles the case where the WebSocket can't reconnect (e.g., extended
     * connectivity issues) so completion checkboxes and other synced state
     * still get refreshed when the user returns to the tab.
     */
    startVisibilityFallback(options) {
        const { getCurrentUserId, getChannelState, isSyncing, getLastFreshTimestamp, pullFn, onPullComplete, setSyncing, } = options;
        document.addEventListener('visibilitychange', () => {
            void (async () => {
                // Throttle to once per minute to avoid excessive requests when flipping tabs
                const lastFreshTs = getLastFreshTimestamp();
                const timeSinceLastFreshMs = lastFreshTs ? Date.now() - lastFreshTs : Infinity;
                if (document.hidden
                    || !getCurrentUserId()
                    || isSyncing()
                    || getChannelState() === 'joined' // WebSocket is healthy
                    || timeSinceLastFreshMs < CloudSyncHealthMonitor.visibilityPullThrottleMs) {
                    return;
                }
                const userId = getCurrentUserId();
                try {
                    setSyncing(true);
                    await pullFn(userId);
                    onPullComplete(Date.now());
                    logger.log('☁️➡️💻 Synced data from cloud (visibility fallback)');
                }
                catch (error) {
                    logger.debug('⚠️ Visibility pull fallback failed:', error);
                }
                finally {
                    setSyncing(false);
                }
            })();
        });
    }
}
//# sourceMappingURL=health-monitor.js.map