/**
 * Realtime subscription manager
 *
 * Manages the Supabase WebSocket channel lifecycle: subscribe, unsubscribe,
 * and routing of incoming UPDATE events to the pull handler.
 */
import { logger } from '../logger.js';
import { db } from './database.js';
export class CloudSyncSubscription {
    constructor(syncHandler, onFailedStatus, onSubscribed) {
        this.syncHandler = syncHandler;
        this.onFailedStatus = onFailedStatus;
        this.onSubscribed = onSubscribed;
        this.hasSubscribedBefore = false;
        // Injected dependencies set via constructor parameters
    }
    get channelState() {
        return this.channel?.state;
    }
    subscribe(userId) {
        // Unsubscribe from previous channel if exists
        if (this.channel) {
            this.channel.unsubscribe();
        }
        this.channel = db.channel(`user_data:${userId}`)
            .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_data',
            filter: `user_id=eq.${userId}`,
        }, async (_payload) => {
            // Skip if this update was triggered by our own push
            if (this.syncHandler.isJustPushed) {
                return;
            }
            // Another device/tab updated our data
            // Only pull if we're not currently syncing
            if (!this.syncHandler.syncing) {
                try {
                    this.syncHandler.syncing = true;
                    await this.syncHandler.pullFromDatabase(userId);
                    logger.log('☁️➡️💻 Synced data from cloud');
                }
                finally {
                    this.syncHandler.syncing = false;
                }
            }
        })
            .subscribe(async (status) => {
            await this.onStatusChange(status);
        });
    }
    unsubscribe() {
        if (this.channel) {
            this.channel.unsubscribe();
            this.channel = undefined;
        }
    }
    async onStatusChange(status) {
        if (status === 'SUBSCRIBED') {
            await this.onSubscribed(this.hasSubscribedBefore);
            this.hasSubscribedBefore = true;
        }
        else if (status === 'CLOSED' || status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
            logger.debug('⚠️ WebSocket entered failed state:', status);
            this.onFailedStatus();
        }
    }
}
//# sourceMappingURL=subscription.js.map