/**
 * Authentication service for cloud sync
 *
 * Handles Discord OAuth authentication and manages user session state.
 */

import { db, isDatabaseConfigured } from './database.js'
import type { User } from '@supabase/supabase-js'

export class AuthService {
  private static instance: AuthService
  private currentUser: User | null = null
  private initialSyncComplete = false

  private constructor() {}

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService()
    }
    return AuthService.instance
  }

  async initialize() {
    if (!isDatabaseConfigured()) return

    // Check current session
    const { data: { user } } = await db.auth.getUser()
    this.currentUser = user

    // Listen for auth changes
    db.auth.onAuthStateChange((event, session) => {
      this.currentUser = session?.user ?? null
      this.handleAuthChange(event, session)
    })
  }

  async signInWithDiscord() {
    if (!isDatabaseConfigured()) {
      throw new Error('Database not configured')
    }

    // Save current hash (if it's not OAuth-related) to restore after redirect
    const currentHash = window.location.hash
    if (currentHash && !currentHash.includes('access_token') && !currentHash.includes('refresh_token')) {
      sessionStorage.setItem('pre_auth_hash', currentHash)
    }

    // Strip any hash from current URL to avoid double-hash issues
    const cleanRedirectUrl = window.location.origin + window.location.pathname + window.location.search

    const { data, error } = await db.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: cleanRedirectUrl
      }
    })

    if (error) throw error
    return data
  }

  async signOut() {
    if (!isDatabaseConfigured()) return

    const { error } = await db.auth.signOut()
    if (error) throw error
  }

  getCurrentUser(): User | null {
    return this.currentUser
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null
  }

  getUserId(): string | null {
    if (!this.currentUser) return null
    // Return Supabase UUID (secure, immutable)
    return this.currentUser.id
  }

  getDiscordUserId(): string | null {
    if (!this.currentUser) return null
    // Discord User ID is in user_metadata.provider_id (for display only, not security)
    return this.currentUser.user_metadata?.provider_id || null
  }

  private async handleAuthChange(event: string, session: any) {
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      // Only perform initial sync once per session
      if (!this.initialSyncComplete && session?.user) {
        this.initialSyncComplete = true
        const syncService = (await import('./storage-sync.js')).StorageSyncService.getInstance()
        await syncService.handleFirstLogin()
      }
    } else if (event === 'SIGNED_OUT') {
      this.initialSyncComplete = false
      if (this.currentUser) {
        const syncService = (await import('./storage-sync.js')).StorageSyncService.getInstance()
        // Flush any pending changes before logout
        await syncService.flushPendingChanges()
        // Unsubscribe from real-time updates
        syncService.unsubscribeFromRealtimeUpdates()
      }
      // Dispatch event to update UI
      window.dispatchEvent(new CustomEvent('auth-state-changed'))
    }
  }
}
