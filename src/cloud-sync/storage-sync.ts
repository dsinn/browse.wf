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

/**
 * Set a value in a nested object using dot-separated path
 * e.g., setNestedValue({}, "live.filter.news.danger", "0")
 *   → {live: {filter: {news: {danger: "0"}}}}
 */
function setNestedValue(obj: Record<string, any>, path: string, value: any): void {
  const keys = path.split('.')
  let current = obj

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (!(key in current)) {
      current[key] = {}
    }
    current = current[key]
  }

  current[keys[keys.length - 1]] = value
}

/**
 * Flatten nested object back to dot-separated keys
 * e.g., {live: {collapse: {news: "1"}}} → {"live.collapse.news": "1"}
 */
function flattenObject(obj: Record<string, any>, prefix = ''): Record<string, any> {
  const result: Record<string, any> = {}

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey))
    } else {
      result[newKey] = value
    }
  }

  return result
}

export class StorageSyncService {
  private static instance: StorageSyncService
  private syncing = false
  private pushTimer: number | null = null
  private realtimeChannel: any = null
  private justPushed = false  // Track when we just pushed to avoid pulling our own update
  private hasSubscribedBefore = false  // Track initial subscription
  private reconnectAttempts = 0  // Track reconnection attempts for exponential backoff
  private reconnectTimer: number | null = null  // Timer for reconnection attempts
  private currentUserId: string | null = null  // Track current user UUID for reconnection

  // localStorage key patterns
  private static readonly LOCAL_ONLY_KEY_REGEX = /^sb-.*-auth-token$/  // Supabase auth token - never sync to cloud
  private static readonly OIDS_KEY = 'oids_completed'
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
   * Cloud is source of truth - always pull if remote data exists
   */
  async handleFirstLogin() {
    if (this.syncing) return

    try {
      this.syncing = true
      const userId = AuthService.getInstance().getUserId()
      if (!userId) {
        throw new Error('No user ID available')
      }

      // Check if remote data exists
      const { data: remoteData, error } = await db
        .from('user_data')
        .select('data')
        .eq('user_id', userId)
        .single()

      if (error || !remoteData) {
        // First time login - upload localStorage to database
        await this.pushToDatabase(userId)
        logger.log('💻➡️☁️ Your data has been backed up to the cloud')
      } else {
        // Remote data exists - pull from cloud (cloud is source of truth)
        await this.pullFromDatabase(userId)
        logger.log('☁️➡️💻 Synced data from cloud')
      }

      // Enable real-time sync for cross-device/cross-tab updates
      this.subscribeToRealtimeUpdates(userId)
    } finally {
      this.syncing = false
    }
  }

  /**
   * Clean up stale objective completions from localStorage
   * Keeps only objectives that still exist in the DOM
   */
  private pruneStaleOids(): void {
    const oidsValue = localStorage.getItem(StorageSyncService.OIDS_KEY)
    if (!oidsValue) return

    try {
      const allOids = JSON.parse(oidsValue)
      // Get all valid OIDs currently in the DOM
      const validOids = new Set<string>()
      document.querySelectorAll('[data-oid]').forEach(el => {
        const oid = el.getAttribute('data-oid')
        if (oid) validOids.add(oid)
      })
      // Keep only OIDs that still exist in the DOM
      const cleanedOids = allOids.filter((oid: string) => validOids.has(oid))
      // Update localStorage with cleaned array
      if (cleanedOids.length > 0) {
        localStorage.setItem(StorageSyncService.OIDS_KEY, JSON.stringify(cleanedOids))
      } else {
        localStorage.removeItem(StorageSyncService.OIDS_KEY)
      }
    } catch {
      // Invalid JSON - remove it
      localStorage.removeItem(StorageSyncService.OIDS_KEY)
    }
  }

  /**
   * Convert localStorage to nested object based on dot-separated keys
   * Stores values exactly as they appear in localStorage (no transformations)
   */
  private localStorageToData(): Record<string, any> {
    const data: Record<string, any> = {}

    // Iterate through all localStorage keys and serialize
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || StorageSyncService.LOCAL_ONLY_KEY_REGEX.test(key)) continue

      const value = localStorage.getItem(key)
      if (value === null) continue

      // Create nested structure based on dots in the key
      setNestedValue(data, key, value)
    }

    return data
  }

  /**
   * Convert nested object to localStorage using dot-separated keys
   * Stores values exactly as they are (no transformations)
   */
  private dataToLocalStorage(data: Record<string, any>) {
    // Clear all localStorage except local-only keys (e.g., auth token)
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key && !StorageSyncService.LOCAL_ONLY_KEY_REGEX.test(key)) {
        localStorage.removeItem(key)
      }
    }

    // Flatten nested structure back to localStorage keys
    const flattened = flattenObject(data)

    // Store all values exactly as they are
    for (const [key, value] of Object.entries(flattened)) {
      localStorage.setItem(key, String(value))
    }
  }

  /**
   * Upload localStorage data to database (last write wins)
   */
  async pushToDatabase(userId: string) {
    // Clean up stale objectives before serializing
    this.pruneStaleOids()

    const data = this.localStorageToData()

    const { error } = await db
      .from('user_data')
      .upsert({
        user_id: userId,
        data
      })

    if (error) throw error
  }

  /**
   * Download database data to localStorage (single query)
   * Automatically refreshes UI after updating localStorage
   */
  async pullFromDatabase(userId: string) {
    const { data: row, error } = await db
      .from('user_data')
      .select('data')
      .eq('user_id', userId)
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

    // Debounce database push to batch rapid changes
    const userId = AuthService.getInstance().getUserId()
    if (userId) {
      this.debouncedPush(userId)
    }
  }

  /**
   * Debounced push - batches multiple rapid changes into single database write
   */
  private debouncedPush(userId: string) {
    // Clear existing timer if user makes another change
    if (this.pushTimer !== null) {
      clearTimeout(this.pushTimer)
    }

    // Start new 5-second timer
    this.pushTimer = window.setTimeout(async () => {
      this.pushTimer = null
      try {
        this.justPushed = true
        await this.pushToDatabase(userId)
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

      const userId = AuthService.getInstance().getUserId()
      if (userId) {
        try {
          await this.pushToDatabase(userId)
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
      if (this.currentUserId) {
        logger.debug('🔌 Attempting to reestablish WebSocket connection...')

        // Ensure we have a fresh session token before reconnecting
        // This handles the case where JWT expired during long sleep
        try {
          const { data: { session }, error } = await db.auth.refreshSession()
          if (error) {
            logger.debug('⚠️ Session refresh failed:', error.message)
            // Don't give up - attempt reconnection anyway in case it's a transient error
          } else if (session) {
            logger.debug('✅ Session refreshed successfully')
          }
        } catch (error) {
          logger.debug('⚠️ Session refresh exception:', error)
          // Continue with reconnection attempt
        }

        this.subscribeToRealtimeUpdates(this.currentUserId)
      }
    }, delayMs)
  }

  /**
   * Subscribe to real-time updates from database
   * Uses WebSockets (not polling) - efficient for free tier
   *
   * Note: You may see browser warnings about Cloudflare "__cf_bm" cookie being rejected.
   * This is harmless - it's the browser enforcing cookie security policies when Supabase
   * handles Cloudflare's bot management cookies. We cannot catch these browser warnings.
   */
  subscribeToRealtimeUpdates(userId: string) {
    // Save current user UUID for reconnection attempts
    this.currentUserId = userId
    // Unsubscribe from previous channel if exists
    if (this.realtimeChannel) {
      this.realtimeChannel.unsubscribe()
    }

    // Subscribe to changes on this user's row
    this.realtimeChannel = db.channel(`user_data:${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_data',
        filter: `user_id=eq.${userId}`
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
            await this.pullFromDatabase(userId)
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
                await this.pullFromDatabase(userId)
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
          // WebSocket entered a failed state (expected when JWT expires) - attempt to reconnect
          logger.debug('⚠️ WebSocket entered failed state:', status)
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
  unsubscribeFromRealtimeUpdates() {
    // Clear reconnection timer
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    // Reset reconnection state
    this.reconnectAttempts = 0
    this.currentUserId = null

    if (this.realtimeChannel) {
      this.realtimeChannel.unsubscribe()
      this.realtimeChannel = null
    }
  }
}
