/**
 * Realtime subscription manager
 *
 * Manages the Supabase WebSocket channel lifecycle: subscribe, unsubscribe,
 * and routing of incoming UPDATE events to the pull handler.
 */

import {logger} from '../logger.js';
import {db} from './database.js';
import type {CloudSyncHandler} from './handler.js';

export class CloudSyncSubscription {
	private hasSubscribedBefore = false;
	private channel: any;

	constructor(
		private readonly syncHandler: CloudSyncHandler,
		private readonly onFailedStatus: () => void,
		private readonly onSubscribed: (isResubscribe: boolean) => Promise<void>,
	) {
		// Injected dependencies set via constructor parameters
	}

	get channelState(): string | undefined {
		return this.channel?.state;
	}

	subscribe(userId: string): void {
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
			}, async (_payload: any) => {
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
					} finally {
						this.syncHandler.syncing = false;
					}
				}
			})
			.subscribe(async (status: string) => {
				await this.onStatusChange(status);
			});
	}

	unsubscribe(): void {
		if (this.channel) {
			this.channel.unsubscribe();
			this.channel = undefined;
		}
	}

	private async onStatusChange(status: string): Promise<void> {
		if (status === 'SUBSCRIBED') {
			await this.onSubscribed(this.hasSubscribedBefore);
			this.hasSubscribedBefore = true;
		} else if (status === 'CLOSED' || status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
			logger.debug('⚠️ WebSocket entered failed state:', status);
			this.onFailedStatus();
		}
	}
}
