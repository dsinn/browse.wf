/**
 * TypeScript types for cloud sync feature
 *
 * This module defines the data structure for user preferences stored in the cloud.
 */

export interface UserData {
  language: string
  notifications: Record<string, boolean>
  ui_state: Record<string, boolean>
  completions: string[]
}
