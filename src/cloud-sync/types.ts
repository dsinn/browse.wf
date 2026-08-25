/**
 * TypeScript types for cloud sync feature
 *
 * This module defines the data structure for user preferences stored in the cloud.
 */

/**
 * Flexible storage structure - nested objects mirror localStorage dot-separated keys
 * e.g., live.collapse.news → {live: {collapse: {news: "1"}}}
 */
export type UserData = Record<string, any>;
