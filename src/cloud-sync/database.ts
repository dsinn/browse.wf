/**
 * Database client setup for cloud sync
 *
 * This module creates and exports a database client instance.
 * If credentials are not configured, the app falls back to localStorage-only mode.
 */

import {createClient} from '@supabase/supabase-js';
import {logger} from '../logger.js';

// Environment variables - support both local dev and production
// Local dev (PHP server): env-config.php reads from .env file
// Production (GitHub Pages): env-config.php reads from GitHub Actions environment
// Both inject window.__ENV__ which gets baked into the static HTML
const databaseUrl = (globalThis as any).__ENV__?.VITE_DATABASE_URL;
const databaseKey = (globalThis as any).__ENV__?.VITE_DATABASE_ANON_KEY;

// Only create Supabase client if credentials are configured
// When missing, all usage sites check isDatabaseConfigured() before accessing db
export const db = (databaseUrl && databaseKey)
	? createClient(databaseUrl, databaseKey, {
		auth: {
			persistSession: true,
			autoRefreshToken: true,
		},
	})
	: (() => {
		logger.info('Database not configured - running in local-only mode. All data will be stored in localStorage only.');
		logger.info('To enable cloud sync, see the README: https://github.com/dsinn/browse.wf');
		return null as any; // Stub client - never accessed since usage sites check isDatabaseConfigured()
	})();

/**
 * Check if database is configured
 * @returns true if database credentials are set, false otherwise
 */
export const isDatabaseConfigured = () => Boolean(databaseUrl && databaseKey);
