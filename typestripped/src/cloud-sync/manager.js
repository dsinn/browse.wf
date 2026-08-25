/**
 * Cloud sync manager
 *
 * Facade and coordinator for all cloud sync operations. Owns one instance of each
 * service (handler, subscription, reconnection, health monitor) and wires them
 * together via callbacks.
 */
import { logger } from '../logger.js';
import { db, isDatabaseConfigured } from './database.js';
import { AuthService } from './auth.js';
import { CloudSyncHandler } from './handler.js';
import { CloudSyncHealthMonitor } from './health-monitor.js';
import { CloudSyncSubscription } from './subscription.js';
import { CloudSyncReconnection } from './reconnection.js';
export class CloudSyncManager {
    static getInstance() {
        CloudSyncManager.instance ||= new CloudSyncManager();
        return CloudSyncManager.instance;
    }
    constructor() {
        this.loginSyncComplete = false;
        this.handler = new CloudSyncHandler();
        this.healthMonitor = new CloudSyncHealthMonitor();
        this.reconnection = new CloudSyncReconnection(userId => {
            this.subscribeToRealtimeUpdates(userId);
        }, () => this.currentUserId);
        this.subscription = new CloudSyncSubscription(this.handler, () => {
            this.reconnection.attemptReconnect();
        }, async (isResubscribe) => this.onSubscribed(isResubscribe));
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
        if (this.loginSyncComplete || this.handler.syncing) {
            return;
        }
        try {
            this.handler.syncing = true;
            const userId = AuthService.getInstance().getUserId();
            if (!userId) {
                throw new Error('No user ID available');
            }
            // Check if remote data exists
            const { data: remoteData, error } = await db
                .from('user_data')
                .select('data')
                .eq('user_id', userId)
                .single();
            if (error || !remoteData) {
                // First time login - upload localStorage to database
                await this.pushToDatabase(userId);
                logger.log('💻➡️☁️ Your data has been backed up to the cloud');
            }
            else {
                // Remote data exists - pull from cloud (cloud is source of truth)
                await this.pullFromDatabase(userId);
                logger.log('☁️➡️💻 Synced data from cloud');
            }
            // Enable real-time sync for cross-device/cross-tab updates
            this.subscribeToRealtimeUpdates(userId);
            this.loginSyncComplete = true;
            globalThis.dispatchEvent(new CustomEvent('cloud-sync-complete'));
        }
        catch (error) {
            logger.error('Cloud sync error:', error);
            globalThis.dispatchEvent(new CustomEvent('cloud-sync-error', { detail: error }));
        }
        finally {
            this.handler.syncing = false;
        }
    }
    /**
     * Upload localStorage data to database (last write wins)
     */
    async pushToDatabase(userId) {
        return this.handler.pushToDatabase(userId);
    }
    /**
     * Download database data to localStorage (single query)
     * Automatically refreshes UI after updating localStorage
     */
    async pullFromDatabase(userId) {
        return this.handler.pullFromDatabase(userId);
    }
    subscribeToRealtimeUpdates(userId) {
        this.currentUserId = userId;
        this.subscription.subscribe(userId);
    }
    /**
     * Unsubscribe from real-time updates
     */
    unsubscribeFromRealtimeUpdates() {
        this.loginSyncComplete = false;
        this.currentUserId = undefined;
        this.reconnection.clearAll();
        this.subscription.unsubscribe();
    }
    /**
     * Called by CloudSyncSubscription when SUBSCRIBED status fires
     */
    async onSubscribed(isResubscribe) {
        const { attempts } = this.reconnection;
        logger.debug('📡 WebSocket SUBSCRIBED | isResubscribe:', isResubscribe, '| reconnectAttempts:', attempts);
        if (attempts > 0) {
            logger.debug('✅ WebSocket reconnected successfully after', attempts, 'attempts');
        }
        this.reconnection.reset();
        if (isResubscribe) {
            // Calculate time since last known fresh data (heartbeat check)
            const lastFreshTs = this.reconnection.lastFreshTimestamp;
            const timeSinceLastFreshMs = lastFreshTs ? Date.now() - lastFreshTs : Infinity;
            if (timeSinceLastFreshMs <= CloudSyncHealthMonitor.quickReconnectThresholdMs) {
                logger.debug(`⚡ Reconnected with recent heartbeat (${(timeSinceLastFreshMs / 1000).toFixed(1)}s ago) - skipping pull`);
                // Recent heartbeat means connection was healthy - no need to pull
                // This handles quick reconnects like JWT expiry (hourly)
                return;
            }
            logger.debug(`🔄 Reconnected${lastFreshTs ? ` with stale heartbeat (${(timeSinceLastFreshMs / 1000).toFixed(1)}s ago)` : ''} - pulling fresh data`);
            // Stale heartbeat - pull to catch up on missed updates
            // This handles device sleep, long network outages, etc.
            if (this.currentUserId && !this.handler.syncing) {
                try {
                    this.handler.syncing = true;
                    await this.pullFromDatabase(this.currentUserId);
                    logger.log('☁️➡️💻 Synced data from cloud (reconnected)');
                }
                finally {
                    this.handler.syncing = false;
                }
            }
        }
        else {
            logger.debug('✅ First subscription established');
            // First subscription - no pull needed (already handled in handleLogin)
        }
    }
    startHeartbeat() {
        this.healthMonitor.startHeartbeat(() => this.subscription.channelState, ts => {
            this.reconnection.lastFreshTimestamp = ts;
        });
    }
    startVisibilityPullFallback() {
        this.healthMonitor.startVisibilityFallback({
            getCurrentUserId: () => this.currentUserId,
            getChannelState: () => this.subscription.channelState,
            isSyncing: () => this.handler.syncing,
            getLastFreshTimestamp: () => this.reconnection.lastFreshTimestamp,
            pullFn: async (userId) => this.pullFromDatabase(userId),
            onPullComplete: ts => {
                this.reconnection.lastFreshTimestamp = ts;
            },
            setSyncing: value => {
                this.handler.syncing = value;
            },
        });
    }
}
//# sourceMappingURL=manager.js.map