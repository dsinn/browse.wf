/**
 * Entry point for the esbuild bundle (typestripped/src-bundle.js).
 *
 * Each module self-registers its public API on `window` as a side effect,
 * so side-effect imports are all that's needed here.  esbuild bundles
 * everything into a single IIFE (typestripped/src-bundle.js) that upstream
 * non-module scripts can consume via the window globals.
 *
 * Cloud-sync modules (including Supabase) are bundled here as well,
 * eliminating the need for a separate importmap or ES module script tag.
 */

/* eslint-disable import-x/no-unassigned-import */
import './arbys-timer.js';
import './bounty-checkboxes.js';
import './bounty-filters.js';
import './calendar-seasons-data.js';
import './calendar-seasons.js';
import './card-filters.js';
import './checkbox-linking.js';
import './cloud-sync/auth-init.js';
import './conquest-helpers.js';
import './descendia-data.js';
import './descendia.js';
import './invasions.js';
import './invigorations.js';
import './live/calendar-seasons.js';
import './live/sync.js';
import './news-mark-read.js';
import './profile/stats-filters.js';
import './profile/syndicate-addons.js';
import './public-export-fetcher.js';
import './string-helpers.js';
import './tileset-helpers.js';
import './tooltip.js';
import './warframe-api-proxy-client.js';
