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
// Keep imports in alphabetical order
import './arbys/settings.js';
import './arbys/tilesets.js';
import './archimedea/helpers.js';
import './calendar-seasons/data.js';
import './calendar-seasons/index.js';
import './card-filters.js';
import './cloud-sync/auth-init.js';
import './descendia/data.js';
import './descendia/index.js';
import './helpers/string-helpers.js';
import './helpers/tileset-helpers.js';
import './invigorations.js';
import './live/bounty-checkboxes.js';
import './live/bounties.js';
import './live/bounty-filters.js';
import './live/calendar-seasons.js';
import './live/checkbox-linking.js';
import './live/circuit.js';
import './live/completion-toggles.js';
import './live/fissures.js';
import './live/incursions.js';
import './live/invasions.js';
import './live/news.js';
import './live/news-mark-read.js';
import './live/prune-stale-data.js';
import './live/sortie.js';
import './live/sync.js';
import './live/weekly.js';
import './profile/enemy-stats.js';
import './profile/equipment-stats.js';
import './profile/stats-filters.js';
import './profile/stats-tooltips.js';
import './profile/syndicate-addons.js';
import './profile/workflow.js';
import './public-export-fetcher.js';
import './short-timer-badge.js';
import './tooltip.js';
import './warframe-api-proxy-client.js';
