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
  private reconnectAttempts = 0  // Track reconnection attempts for exponential backoff
  private reconnectTimer: number | null = null  // Timer for reconnection attempts
  private currentDiscordUserId: string | null = null  // Track current user for reconnection

  // localStorage key prefixes
  private static readonly NOTIF_PREFIX = 'live.notif.'
  private static readonly COLLAPSE_PREFIX = 'live.collapse.'
  private static readonly FILTER_PREFIX = 'live.filter.'
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
        logger.log('💻➡️☁️ Your data has been backed up to the cloud')
      } else {
        // Compare timestamps: remote vs local
        const localLastModified = localStorage.getItem(StorageSyncService.LAST_MODIFIED_KEY)
        const remoteLastModified = remoteData.updated_at

        if (!localLastModified || new Date(remoteLastModified) > new Date(localLastModified)) {
          // Remote is newer - pull from database
          await this.pullFromDatabase(discordUserId)
          logger.log('☁️➡️💻 Synced data from cloud')
        } else {
          // Local is newer or tie - push to database
          await this.pushToDatabase(discordUserId)
          logger.log('💻➡️☁️ Synced data to cloud')
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

    // Dynamically collect all notification settings, UI collapse states, and filter preferences
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(StorageSyncService.NOTIF_PREFIX)) {
        const notifKey = key.replace(StorageSyncService.NOTIF_PREFIX, '')
        data.notifications[notifKey] = true
      } else if (key?.startsWith(StorageSyncService.COLLAPSE_PREFIX)) {
        const stateKey = key.replace(StorageSyncService.COLLAPSE_PREFIX, '')
        data.ui_state[stateKey] = true
      } else if (key?.startsWith(StorageSyncService.FILTER_PREFIX)) {
        const filterKey = key.replace(StorageSyncService.FILTER_PREFIX, '')
        const value = localStorage.getItem(key)
        // Store actual string value to support both checkbox filters ("0"/"1") and dropdown filters ("-1"-"7")
        // Only store if value exists - don't create defaults for untouched filters
        if (value !== null) {
          data.ui_state[`filter.${filterKey}`] = value
        }
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

    // Set UI states (collapse states and filters)
    for (const [key, value] of Object.entries(data.ui_state)) {
      if (key.startsWith('filter.')) {
        // Handle filter preferences - store actual string value for both checkboxes and dropdowns
        const filterKey = key.replace('filter.', '')
        if (typeof value === 'string') {
          // Dropdown filter (string value like "0"-"7")
          localStorage.setItem(`${StorageSyncService.FILTER_PREFIX}${filterKey}`, value)
        } else {
          // Checkbox filter (boolean value)
          localStorage.setItem(`${StorageSyncService.FILTER_PREFIX}${filterKey}`, value ? '1' : '0')
        }
      } else {
        // Handle collapse states (store truthy or remove)
        if (value) {
          localStorage.setItem(`${StorageSyncService.COLLAPSE_PREFIX}${key}`, 'true')
        } else {
          localStorage.removeItem(`${StorageSyncService.COLLAPSE_PREFIX}${key}`)
        }
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
   * Merges with existing data to avoid losing settings from other devices
   */
  async pushToDatabase(discordUserId: string) {
    const localData = this.localStorageToData()

    // Try to fetch existing data from database to merge with
    const { data: existingRow } = await db
      .from('user_data')
      .select('data')
      .eq('discord_user_id', discordUserId)
      .maybeSingle() // Returns null if no row exists, doesn't error

    // Merge local data with existing database data (if any)
    const mergedData: UserData = existingRow?.data
      ? {
          language: localData.language, // Local language always wins
          notifications: { ...existingRow.data.notifications, ...localData.notifications },
          ui_state: { ...existingRow.data.ui_state, ...localData.ui_state },
          completions: localData.completions // Local completions always win (they're append-only)
        }
      : localData // No existing data - just use local

    const { error } = await db
      .from('user_data')
      .upsert({
        discord_user_id: discordUserId,
        data: mergedData
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
      logger.error('Error pulling from database:', error)
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
        logger.log('💻➡️☁️ Synced data to cloud')
        // Clear flag after 1 second to ignore our own real-time update
        setTimeout(() => { this.justPushed = false }, 1000)
      } catch (error) {
        logger.warn('Failed to sync to database, data saved locally:', error)
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
          logger.warn('Failed to flush pending changes:', error)
        }
      }
    }
  }

  /**
   * Attempt to reconnect to realtime updates with exponential backoff
   * Called when websocket enters a failed state (CLOSED, TIMED_OUT, CHANNEL_ERROR)
   */
  private attemptReconnect() {
    // Clear any existing reconnect timer
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    const maxAttempts = 10
    if (this.reconnectAttempts >= maxAttempts) {
      logger.error('❌ Max reconnection attempts reached. Please refresh the page.')
      return
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, 64s, 128s, 256s, 512s
    const delayMs = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 512000)
    this.reconnectAttempts++

    logger.debug(`🔄 WebSocket disconnected. Reconnecting in ${delayMs / 1000}s (attempt ${this.reconnectAttempts}/${maxAttempts})`)

    this.reconnectTimer = window.setTimeout(async () => {
      this.reconnectTimer = null
      if (this.currentDiscordUserId) {
        logger.debug('🔌 Attempting to reestablish WebSocket connection...')

        // Ensure we have a fresh session token before reconnecting
        // This handles the case where JWT expired during long sleep
        try {
          const { data: { session }, error } = await db.auth.refreshSession()
          if (error) {
            logger.warn('⚠️ Session refresh failed:', error.message)
            // Don't give up - attempt reconnection anyway in case it's a transient error
          } else if (session) {
            logger.debug('✅ Session refreshed successfully')
          }
        } catch (error) {
          logger.warn('⚠️ Session refresh exception:', error)
          // Continue with reconnection attempt
        }

        this.subscribeToRealtimeUpdates(this.currentDiscordUserId)
      }
    }, delayMs)
  }

  /**
   * Subscribe to real-time updates from database
   * Uses WebSockets (not polling) - efficient for free tier
   */
  subscribeToRealtimeUpdates(discordUserId: string) {
    // Save current user for reconnection attempts
    this.currentDiscordUserId = discordUserId
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
            logger.log('☁️➡️💻 Synced data from cloud')
          } finally {
            this.syncing = false
          }
        }
      })
      .subscribe(async (status) => {
        logger.debug('📡 WebSocket status:', status, '| hasSubscribedBefore:', this.hasSubscribedBefore, '| reconnectAttempts:', this.reconnectAttempts)

        // When WebSocket reconnects after sleep/network loss, pull fresh data
        if (status === 'SUBSCRIBED') {
          // Reset reconnection counter on successful connection
          if (this.reconnectAttempts > 0) {
            logger.debug('✅ WebSocket reconnected successfully after', this.reconnectAttempts, 'attempts')
          }
          this.reconnectAttempts = 0
          if (this.reconnectTimer !== null) {
            clearTimeout(this.reconnectTimer)
            this.reconnectTimer = null
          }

          if (this.hasSubscribedBefore) {
            logger.debug('🔄 Reconnection detected - pulling fresh data')
            // This is a reconnection - pull to catch up on missed updates
            if (!this.syncing) {
              try {
                this.syncing = true
                await this.pullFromDatabase(discordUserId)
                logger.log('☁️➡️💻 Synced data from cloud (reconnected)')
              } finally {
                this.syncing = false
              }
            }
          } else {
            logger.debug('✅ First subscription established')
            // First subscription - no pull needed (already handled in handleFirstLogin)
            this.hasSubscribedBefore = true
          }
        } else if (status === 'CLOSED' || status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
          // WebSocket entered a failed state - attempt to reconnect
          logger.warn('⚠️ WebSocket entered failed state:', status)
          this.attemptReconnect()
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

    // Refresh filter states using existing function
    if ((window as any).refreshFilterStatus) {
      document.querySelectorAll<HTMLElement>("[data-filter-toggle]").forEach(elm => {
        (window as any).refreshFilterStatus(elm)
      })
    }

    // Refresh filter checkboxes
    document.querySelectorAll<HTMLInputElement>("[data-filter-type]").forEach(checkbox => {
      const filterType = checkbox.getAttribute("data-filter-type")
      if (filterType) {
        // Extract card name from checkbox ID (e.g., "filter-news-danger" -> "news")
        const cardName = checkbox.id.split('-')[1]
        const storageKey = `live.filter.${cardName}.${filterType}`
        const savedState = localStorage.getItem(storageKey)
        if (savedState !== null) {
          checkbox.checked = savedState === "1"
        }
      }
    })

    // Refresh bounty filter dropdowns
    if ((window as any).initializeBountyFilters_all) {
      (window as any).initializeBountyFilters_all()
    }

    // Refresh card content to apply filters
    if ((window as any).updateNewsTicker) {
      (window as any).updateNewsTicker()
    }
    if ((window as any).updateBountyCycleLocalised) {
      (window as any).updateBountyCycleLocalised()
    }
    if ((window as any).updateIncursionsLocalised) {
      (window as any).updateIncursionsLocalised()
    }
  }

  /**
   * Unsubscribe from real-time updates
   */
  unsubscribeFromRealtimeUpdates(discordUserId: string) {
    // Clear reconnection timer
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    // Reset reconnection state
    this.reconnectAttempts = 0
    this.currentDiscordUserId = null

    if (this.realtimeChannel) {
      this.realtimeChannel.unsubscribe()
      this.realtimeChannel = null
    }
  }
}
