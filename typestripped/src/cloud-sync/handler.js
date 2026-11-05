/**
 * Cloud sync handler
 *
 * Handles push/pull operations between localStorage and the cloud database.
 * Manages the justPushed deduplication flag to avoid reacting to self-updates.
 */
import { logger } from '../logger.js';
import { db } from './database.js';
import { localStorageToData, dataToLocalStorage } from './serializer.js';
export class CloudSyncHandler {
    constructor() {
        this.syncing = false;
        this.justPushed = false;
    }
    get isJustPushed() {
        return this.justPushed;
    }
    /**
     * Upload localStorage data to database (last write wins)
     */
    async pushToDatabase(userId) {
        globalThis.dispatchEvent(new CustomEvent('cloud-sync-before-push'));
        const data = localStorageToData();
        this.justPushed = true;
        // Clear any existing timeout to prevent race condition with multiple pushes
        if (this.justPushedTimeout !== undefined) {
            clearTimeout(this.justPushedTimeout);
        }
        try {
            const { error } = await db
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
        }
        catch (error) {
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
    async pullFromDatabase(userId) {
        const { data: row, error } = await db
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
        dataToLocalStorage(row.data);
        globalThis.dispatchEvent(new CustomEvent('cloud-sync-pulled'));
    }
}
//# sourceMappingURL=handler.js.map