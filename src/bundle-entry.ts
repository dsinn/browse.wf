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

import './arbys-timer.js'; // eslint-disable-line import-x/no-unassigned-import
import './bounty-checkboxes.js'; // eslint-disable-line import-x/no-unassigned-import
import './bounty-filters.js'; // eslint-disable-line import-x/no-unassigned-import
import './calendar-seasons-data.js'; // eslint-disable-line import-x/no-unassigned-import
import './calendar-seasons.js'; // eslint-disable-line import-x/no-unassigned-import
import './card-filters.js'; // eslint-disable-line import-x/no-unassigned-import
import './checkbox-linking.js'; // eslint-disable-line import-x/no-unassigned-import
import './cloud-sync/auth-init.js'; // eslint-disable-line import-x/no-unassigned-import
import './conquest-helpers.js'; // eslint-disable-line import-x/no-unassigned-import
import './descendia-data.js'; // eslint-disable-line import-x/no-unassigned-import
import './descendia.js'; // eslint-disable-line import-x/no-unassigned-import
import './invasions.js'; // eslint-disable-line import-x/no-unassigned-import
import './invigorations.js'; // eslint-disable-line import-x/no-unassigned-import
import './news-mark-read.js'; // eslint-disable-line import-x/no-unassigned-import
import './profile-stats-filters.js'; // eslint-disable-line import-x/no-unassigned-import
import './string-helpers.js'; // eslint-disable-line import-x/no-unassigned-import
import './tileset-helpers.js'; // eslint-disable-line import-x/no-unassigned-import
import './tooltip.js'; // eslint-disable-line import-x/no-unassigned-import
import './warframe-api-proxy-client.js'; // eslint-disable-line import-x/no-unassigned-import
