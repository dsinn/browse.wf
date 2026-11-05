/**
 * Authentication service for cloud sync
 *
 * Handles Discord OAuth authentication and manages user session state.
 * Dispatches the following events for other modules to react to:
 *
 * - **'auth-signed-in'**: Emitted on SIGNED_IN and INITIAL_SESSION with a user.
 *   detail: { userId: string }
 *
 * - **'auth-signed-out'**: Emitted on SIGNED_OUT.
 *
 * - **'auth-state-changed'**: Emitted on SIGNED_OUT, for UI refresh.
 */
import { db, isDatabaseConfigured } from './database.js';
export class AuthService {
    static getInstance() {
        AuthService.instance ||= new AuthService();
        return AuthService.instance;
    }
    constructor() {
        // Singleton — no initialization needed
    }
    async initialize() {
        if (!isDatabaseConfigured()) {
            return;
        }
        // Check current session
        const { data: { user } } = await db.auth.getUser();
        this.currentUser = user ?? undefined;
        // Listen for auth changes
        // Note: per Supabase docs, async work must be deferred with setTimeout
        // to avoid deadlocks with other Supabase operations
        db.auth.onAuthStateChange((event, session) => {
            this.currentUser = session?.user ?? undefined;
            setTimeout(() => {
                this.handleAuthChange(event, session);
            }, 0);
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
        const { data, error } = await db.auth.signInWithOAuth({
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
        const { error } = await db.auth.signOut();
        if (error) {
            throw new Error(error.message);
        }
    }
    getCurrentUser() {
        return this.currentUser;
    }
    isAuthenticated() {
        return this.currentUser !== undefined;
    }
    getUserId() {
        return this.currentUser?.id;
    }
    getDiscordUserId() {
        return this.currentUser?.user_metadata?.provider_id || undefined;
    }
    handleAuthChange(event, session) {
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            if (session?.user) {
                globalThis.dispatchEvent(new CustomEvent('auth-signed-in', {
                    detail: { userId: session.user.id },
                }));
            }
        }
        else if (event === 'SIGNED_OUT') {
            globalThis.dispatchEvent(new CustomEvent('auth-signed-out'));
            globalThis.dispatchEvent(new CustomEvent('auth-state-changed'));
        }
    }
}
//# sourceMappingURL=auth.js.map