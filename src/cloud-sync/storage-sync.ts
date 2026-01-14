/**
 * Storage sync service for cloud sync
 *
 * Handles bidirectional synchronization between localStorage and cloud database.
 * Implements 5-second debouncing for efficient batching of rapid changes.
 */

import { db } from './database.js'
import { AuthService } from './auth.js'
import type { UserData } from './types.js'
import { logger } from '../logger.js'

export class StorageSyncService {
  private static instance: StorageSyncService
  private syncing = false
  private pushTimer: number | null = null
  private realtimeChannel: any = null
  private justPushed = false  // Track when we just pushed to avoid pulling our own update
  private hasSubscribedBefore = false  // Track initial subscription

  // localStorage key prefixes
  private static readonly NOTIF_PREFIX = 'live.notif.'
  private static readonly COLLAPSE_PREFIX = 'live.collapse.'
  private static readonly LAST_MODIFIED_KEY = '_last_modified'
  private static readonly DEBOUNCE_MS = 5000  // 5 seconds - aggressive batching for long-lived tabs

  private constructor() {}

  static getInstance(): StorageSyncService {
    if (!StorageSyncService.instance) {
      StorageSyncService.instance = new StorageSyncService()
    }
    return StorageSyncService.instance
  }

  /**
   * Called when user logs in
   */
  async handleFirstLogin() {
    if (this.syncing) return

    try {
      this.syncing = true
      const discordUserId = AuthService.getInstance().getDiscordUserId()
      if (!discordUserId) {
        throw new Error('No Discord User ID available')
      }

      // Fetch remote data with timestamp
      const { data: remoteData, error } = await db
        .from('user_data')
        .select('data, updated_at')
        .eq('discord_user_id', discordUserId)
        .single()

      if (error || !remoteData) {
        // First time login - upload localStorage to database
        await this.pushToDatabase(discordUserId)
        console.log('Your data has been backed up to the cloud')
      } else {
        // Compare timestamps: remote vs local
        const localLastModified = localStorage.getItem(StorageSyncService.LAST_MODIFIED_KEY)
        const remoteLastModified = remoteData.updated_at

        if (!localLastModified || new Date(remoteLastModified) > new Date(localLastModified)) {
          // Remote is newer - pull from database
          await this.pullFromDatabase(discordUserId)
          console.log('Synced data from cloud')
        } else {
          // Local is newer or tie - push to database
          await this.pushToDatabase(discordUserId)
          console.log('Synced data to cloud')
        }
      }

      // Enable real-time sync for cross-device/cross-tab updates
      this.subscribeToRealtimeUpdates(discordUserId)
    } finally {
      this.syncing = false
    }
  }

  /**
   * Convert localStorage to UserData object
   */
  private localStorageToData(): UserData {
    const data: UserData = {
      language: localStorage.getItem('lang') || 'en',
      notifications: {},
      ui_state: {},
      completions: []
    }

    // Dynamically collect all notification settings and UI collapse states
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(StorageSyncService.NOTIF_PREFIX)) {
        const notifKey = key.replace(StorageSyncService.NOTIF_PREFIX, '')
        data.notifications[notifKey] = true
      } else if (key?.startsWith(StorageSyncService.COLLAPSE_PREFIX)) {
        const stateKey = key.replace(StorageSyncService.COLLAPSE_PREFIX, '')
        data.ui_state[stateKey] = true
      }
    }

    // Get completions
    const completionsStr = localStorage.getItem('oids_completed')
    if (completionsStr) {
      try {
        data.completions = JSON.parse(completionsStr)
      } catch {
        data.completions = []
      }
    }

    return data
  }

  /**
   * Convert UserData object to localStorage
   */
  private dataToLocalStorage(data: UserData) {
    // Set language
    localStorage.setItem('lang', data.language)

    // Set notifications
    for (const [key, enabled] of Object.entries(data.notifications)) {
      if (enabled) {
        localStorage.setItem(`${StorageSyncService.NOTIF_PREFIX}${key}`, 'true')
      } else {
        localStorage.removeItem(`${StorageSyncService.NOTIF_PREFIX}${key}`)
      }
    }

    // Set UI states
    for (const [key, collapsed] of Object.entries(data.ui_state)) {
      if (collapsed) {
        localStorage.setItem(`${StorageSyncService.COLLAPSE_PREFIX}${key}`, 'true')
      } else {
        localStorage.removeItem(`${StorageSyncService.COLLAPSE_PREFIX}${key}`)
      }
    }

    // Set completions
    if (data.completions.length > 0) {
      localStorage.setItem('oids_completed', JSON.stringify(data.completions))
    } else {
      localStorage.removeItem('oids_completed')
    }

    // Update local timestamp to match remote
    localStorage.setItem(StorageSyncService.LAST_MODIFIED_KEY, new Date().toISOString())
  }

  /**
   * Upload localStorage data to database (single query)
   */
  async pushToDatabase(discordUserId: string) {
    const data = this.localStorageToData()

    const { error } = await db
      .from('user_data')
      .upsert({
        discord_user_id: discordUserId,
        data
      })

    if (error) throw error
  }

  /**
   * Download database data to localStorage (single query)
   * Automatically refreshes UI after updating localStorage
   */
  async pullFromDatabase(discordUserId: string) {
    const { data: row, error } = await db
      .from('user_data')
      .select('data')
      .eq('discord_user_id', discordUserId)
      .single()

    if (error) {
      console.error('Error pulling from database:', error)
      throw error
    }
    if (!row) return

    this.dataToLocalStorage(row.data as UserData)
    this.refreshUI()
  }

  /**
   * Save specific key to database with localStorage fallback
   * Uses 5-second debounce to batch rapid changes
   */
  async saveWithFallback(key: string, value: any) {
    // Always save to localStorage first (instant UI feedback)
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))

    // Update local timestamp
    localStorage.setItem(StorageSyncService.LAST_MODIFIED_KEY, new Date().toISOString())

    // Debounce database push to batch rapid changes
    const discordUserId = AuthService.getInstance().getDiscordUserId()
    if (discordUserId) {
      this.debouncedPush(discordUserId)
    }
  }

  /**
   * Debounced push - batches multiple rapid changes into single database write
   */
  private debouncedPush(discordUserId: string) {
    // Clear existing timer if user makes another change
    if (this.pushTimer !== null) {
      clearTimeout(this.pushTimer)
    }

    // Start new 5-second timer
    this.pushTimer = window.setTimeout(async () => {
      this.pushTimer = null
      try {
        this.justPushed = true
        await this.pushToDatabase(discordUserId)
        console.log('Synced data to cloud')
        // Clear flag after 1 second to ignore our own real-time update
        setTimeout(() => { this.justPushed = false }, 1000)
      } catch (error) {
        console.warn('Failed to sync to database, data saved locally:', error)
        this.justPushed = false
      }
    }, StorageSyncService.DEBOUNCE_MS)
  }

  /**
   * Flush pending changes immediately (called on logout or page unload)
   */
  async flushPendingChanges() {
    if (this.pushTimer !== null) {
      clearTimeout(this.pushTimer)
      this.pushTimer = null

      const discordUserId = AuthService.getInstance().getDiscordUserId()
      if (discordUserId) {
        try {
          await this.pushToDatabase(discordUserId)
        } catch (error) {
          console.warn('Failed to flush pending changes:', error)
        }
      }
    }
  }

  /**
   * Subscribe to real-time updates from database
   * Uses WebSockets (not polling) - efficient for free tier
   */
  subscribeToRealtimeUpdates(discordUserId: string) {
    // Unsubscribe from previous channel if exists
    if (this.realtimeChannel) {
      this.realtimeChannel.unsubscribe()
    }

    // Subscribe to changes on this user's row
    this.realtimeChannel = db.channel(`user_data:${discordUserId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_data',
        filter: `discord_user_id=eq.${discordUserId}`
      }, async (payload) => {
        // Skip if this update was triggered by our own push
        if (this.justPushed) {
          return
        }

        // Another device/tab updated our data
        // Only pull if we're not currently pushing
        if (!this.syncing) {
          try {
            this.syncing = true
            await this.pullFromDatabase(discordUserId)
            console.log('Synced data from cloud')
          } finally {
            this.syncing = false
          }
        }
      })
      .subscribe(async (status) => {
        logger.debug('📡 WebSocket status:', status, '| hasSubscribedBefore:', this.hasSubscribedBefore)

        // When WebSocket reconnects after sleep/network loss, pull fresh data
        if (status === 'SUBSCRIBED') {
          if (this.hasSubscribedBefore) {
            logger.debug('🔄 Reconnection detected - pulling fresh data')
            // This is a reconnection - pull to catch up on missed updates
            if (!this.syncing) {
              try {
                this.syncing = true
                await this.pullFromDatabase(discordUserId)
                console.log('Synced data from cloud (reconnected)')
              } finally {
                this.syncing = false
              }
            }
          } else {
            logger.debug('✅ First subscription established')
            // First subscription - no pull needed (already handled in handleFirstLogin)
            this.hasSubscribedBefore = true
          }
        }
      })
  }

  /**
   * Refresh UI after pulling data from cloud
   */
  private refreshUI() {
    // Refresh completion checkboxes (objectives)
    if ((window as any).refreshAllCompletionToggles) {
      (window as any).refreshAllCompletionToggles()
    }

    // Refresh collapse states using existing function
    if ((window as any).refreshCollapseStatus) {
      document.querySelectorAll<HTMLElement>("[data-collapse-toggle]").forEach(elm => {
        (window as any).refreshCollapseStatus(elm)
      })
    }

    // Refresh notification states using existing function
    if ((window as any).refreshNotifStatus) {
      document.querySelectorAll<HTMLElement>("[data-notif-toggle]").forEach(elm => {
        (window as any).refreshNotifStatus(elm)
      })
    }
  }

  /**
   * Unsubscribe from real-time updates
   */
  unsubscribeFromRealtimeUpdates(discordUserId: string) {
    if (this.realtimeChannel) {
      this.realtimeChannel.unsubscribe()
      this.realtimeChannel = null
    }
  }
}
