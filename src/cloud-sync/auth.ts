/**
 * Authentication service for cloud sync
 *
 * Handles Discord OAuth authentication and manages user session state.
 *
 * ## Cloud Sync Events
 *
 * This module dispatches the following custom events to communicate cloud sync state:
 *
 * - **'cloud-sync-complete'**: Emitted when initial pull from database succeeds.
 *   Dispatched by: auth.ts (handleAuthChange)
 *   Listeners: profile.ts (waits for this before loading profile data)
 *
 * - **'cloud-sync-unavailable'**: Emitted when database is not configured (no Vite env vars).
 *   Dispatched by: auth-init.ts (initializeAuth)
 *   Listeners: profile.ts (falls back to default profile)
 *
 * - **'cloud-sync-unauthenticated'**: Emitted when user is not authenticated.
 *   Dispatched by: auth-init.ts (initializeAuth)
 *   Listeners: profile.ts (falls back to default profile)
 *
 * - **'cloud-sync-error'**: Emitted when initial pull from database fails.
 *   Dispatched by: auth.ts (handleAuthChange)
 *   Listeners: profile.ts (falls back to default profile)
 *
 * These events are used to coordinate profile loading with cloud sync initialization.
 * profile.ts waits for one of these events (or 3s timeout) before proceeding with
 * profile data initialization.
 */

import type {User} from '@supabase/supabase-js';
import {db, isDatabaseConfigured} from './database.js';

export class AuthService {
	static getInstance(): AuthService {
		AuthService.instance ||= new AuthService();

		return AuthService.instance;
	}

	private static instance: AuthService;

	private currentUser: User | undefined = null;
	private initialSyncComplete = false;

	private constructor() {
		// Singleton — no initialization needed
	}

	async initialize() {
		if (!isDatabaseConfigured()) {
			return;
		}

		// Check current session
		const {data: {user}} = await db.auth.getUser();
		this.currentUser = user;

		// Listen for auth changes
		db.auth.onAuthStateChange((event, session) => {
			this.currentUser = session?.user ?? null;
			void this.handleAuthChange(event, session);
		});
	}

	async signInWithDiscord() {
		if (!isDatabaseConfigured()) {
			throw new Error('Database not configured');
		}

		// Save current hash (if it's not OAuth-related) to restore after redirect
		const currentHash = globalThis.location.hash;
		if (currentHash && !currentHash.includes('access_token') && !currentHash.includes('refresh_token')) {
			sessionStorage.setItem('pre_auth_hash', currentHash);
		}

		// Strip any hash from current URL to avoid double-hash issues
		const cleanRedirectUrl = globalThis.location.origin + globalThis.location.pathname + globalThis.location.search;

		const {data, error} = await db.auth.signInWithOAuth({
			provider: 'discord',
			options: {
				redirectTo: cleanRedirectUrl,
			},
		});

		if (error) {
			throw new Error(error.message);
		}

		return data;
	}

	async signOut() {
		if (!isDatabaseConfigured()) {
			return;
		}

		const {error} = await db.auth.signOut();
		if (error) {
			throw new Error(error.message);
		}
	}

	getCurrentUser(): User | undefined {
		return this.currentUser;
	}

	isAuthenticated(): boolean {
		return this.currentUser !== null;
	}

	getUserId(): string | undefined {
		if (!this.currentUser) {
			return null;
		}

		// Return Supabase UUID (secure, immutable)
		return this.currentUser.id;
	}

	getDiscordUserId(): string | undefined {
		if (!this.currentUser) {
			return null;
		}

		// Discord User ID is in user_metadata.provider_id (for display only, not security)
		return this.currentUser.user_metadata?.provider_id || null;
	}

	private async handleAuthChange(event: string, session: any) {
		if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
			// Only perform initial sync once per session
			if (!this.initialSyncComplete && session?.user) {
				this.initialSyncComplete = true;
				const {StorageSyncService} = await import('./storage-sync.js');
				const syncService = StorageSyncService.getInstance();
				try {
					await syncService.handleFirstLogin();
					globalThis.dispatchEvent(new CustomEvent('cloud-sync-complete'));
				} catch (error) {
					console.error('Cloud sync error:', error);
					globalThis.dispatchEvent(new CustomEvent('cloud-sync-error', {detail: error}));
				}
			}
		} else if (event === 'SIGNED_OUT') {
			this.initialSyncComplete = false;
			if (this.currentUser) {
				const {StorageSyncService} = await import('./storage-sync.js');
				const syncService = StorageSyncService.getInstance();
				// Flush any pending changes before logout
				await syncService.flushPendingChanges();
				// Unsubscribe from real-time updates
				syncService.unsubscribeFromRealtimeUpdates();
			}

			// Dispatch event to update UI
			globalThis.dispatchEvent(new CustomEvent('auth-state-changed'));
		}
	}
}
