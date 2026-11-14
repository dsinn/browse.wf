/**
 Weekly Forecast page — renders tabs for Deep Archimedea, Temporal Archimedea, and Descendia
 across all available weeks from worldState.

 Uses globals exposed by common.js:
 - getDictPromise, getOSDictPromise
 */
import { renderArchimedeaTable } from './archimedea/helpers.js';
import { renderCircuitForecastTable } from './circuit/index.js';
import { renderDescentChallenges } from './descendia/index.js';
import { getSeasonLabel } from './calendar-seasons/data.js';
import { renderCalendarSeasonPane } from './calendar-seasons/index.js';
import { weekCountToActivationMs } from './clan-weekly/data.js';
import { renderClanWeeklyPane } from './clan-weekly/index.js';
import { getNextWeeklyResetMs, MILLIS_PER_WEEK } from './helpers/time-helpers.js';
import { createShortTimerBadge } from './short-timer-badge.js';
import { scheduleReload } from './timer-registry.js';
import { WarframeApiFrontProxyClient } from './warframe-api-proxy-client.js';
import { fetchExport } from './public-export-fetcher.js';
import { renderTeshinForecastHeader, renderTeshinForecastTable } from './teshin/index.js';
import { initWeeklyForecastToc, scrollToHashedSection, startSyncingUrlHash } from './weekly-forecast-toc.js';
export function mongoMs(d) {
    return Number(d.$date.$numberLong);
}
export function formatTabDate(ms) {
    return new Date(ms).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}
/**
 Builds a Bootstrap tab nav item and its corresponding tab pane.
 Stores the activation timestamp on the button as data-activation for refresh identity.
 */
export function buildTab(tabsElement, contentElement, id, label, activationMs, isActive, buildContent) {
    // Nav tab button
    const li = document.createElement('li');
    li.className = 'nav-item';
    li.setAttribute('role', 'presentation');
    const btn = document.createElement('button');
    btn.className = 'nav-link' + (isActive ? ' active' : '');
    btn.id = id + '-tab';
    btn.dataset.bsToggle = 'tab';
    btn.dataset.bsTarget = '#' + id;
    btn.setAttribute('type', 'button');
    btn.setAttribute('role', 'tab');
    btn.dataset.activation = String(activationMs);
    btn.textContent = label;
    li.append(btn);
    tabsElement.append(li);
    // Tab pane
    const pane = document.createElement('div');
    pane.className = 'tab-pane fade' + (isActive ? ' show active' : '');
    pane.id = id;
    pane.setAttribute('role', 'tabpanel');
    buildContent(pane);
    contentElement.append(pane);
}
async function renderArchimedeaTabs(tabsElement, contentElement, archimedeas, archimedeaType) {
    const now = Date.now();
    tabsElement.replaceChildren();
    contentElement.replaceChildren();
    // There's usually only one entry per Archimedea type, but handle multiple for robustness
    const firstFutureIdx = archimedeas.findIndex(a => mongoMs(a.Activation) > now);
    const defaultIdx = Math.max(firstFutureIdx, 0);
    // Build tab structure first, then render content in parallel
    const panes = [];
    for (const [i, archimedea] of archimedeas.entries()) {
        const activationMs = mongoMs(archimedea.Activation);
        const label = formatTabDate(activationMs);
        const id = archimedeaType.toLowerCase() + '-' + i;
        buildTab(tabsElement, contentElement, id, label, activationMs, i === defaultIdx, pane => {
            panes.push(pane);
        });
    }
    await Promise.all(archimedeas.map(async (archimedea, i) => renderArchimedeaTable(panes[i], archimedea, archimedeaType)));
}
async function renderDescentTabs(tabsElement, contentElement, descents) {
    const now = Date.now();
    tabsElement.replaceChildren();
    contentElement.replaceChildren();
    const dict = await getDictPromise();
    const firstFutureIdx = descents.findIndex(d => mongoMs(d.Activation) > now);
    const defaultIdx = Math.max(firstFutureIdx, 0);
    for (const [i, descent] of descents.entries()) {
        const activationMs = mongoMs(descent.Activation);
        const isActive = i === defaultIdx;
        const label = formatTabDate(activationMs);
        const id = 'descent-' + i;
        buildTab(tabsElement, contentElement, id, label, activationMs, isActive, pane => {
            const tbody = renderDescentChallenges(descent, dict);
            const table = document.createElement('table');
            table.className = 'table table-sm table-borderless table-hover descendia-challenges';
            // Header row
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            for (const text of ['#', 'Type', 'Challenge', 'Arena', 'Specs & Auras']) {
                const th = document.createElement('th');
                th.textContent = text;
                headerRow.append(th);
            }
            thead.append(headerRow);
            table.append(thead);
            table.append(tbody);
            pane.append(table);
        });
    }
}
/**
 Replaces the contents of a below-xl columns container with a two-column row of headed panes.
 */
function renderPaneColumns(columnsElement, columns) {
    const row = document.createElement('div');
    row.className = 'row';
    for (const { heading, pane } of columns) {
        const col = document.createElement('div');
        col.className = 'col-6';
        const headingElement = document.createElement('h5');
        headingElement.className = 'mb-3';
        headingElement.textContent = heading;
        col.append(headingElement, pane);
        row.append(col);
    }
    columnsElement.replaceChildren(row);
}
async function renderCalendarSeasonTabs(tabsElement, contentElement, seasons) {
    const now = Date.now();
    tabsElement.replaceChildren();
    contentElement.replaceChildren();
    const firstFutureSeasonIdx = seasons.findIndex(s => mongoMs(s.Activation) > now);
    const defaultSeasonIdx = Math.max(firstFutureSeasonIdx, 0);
    // Required for common.js' setImageSource, must be set before renderCalendarSeasonPane runs
    window.ExportImages = await fetchExport('ExportImages');
    // Render all season panes in parallel (two copies: one for tabs, one for columns)
    const [seasonPanesForTabs, seasonPanesForColumns] = await Promise.all([
        Promise.all(seasons.map(async (season) => renderCalendarSeasonPane(season))),
        Promise.all(seasons.map(async (season) => renderCalendarSeasonPane(season))),
    ]);
    // Build tabs with the rendered content (xl+)
    for (const [i, season] of seasons.entries()) {
        const activationMs = mongoMs(season.Activation);
        const isActive = i === defaultSeasonIdx;
        const label = getSeasonLabel(season.Season);
        const id = 'calendar-season-' + i;
        buildTab(tabsElement, contentElement, id, label, activationMs, isActive, pane => {
            pane.append(seasonPanesForTabs[i]);
        });
    }
    // Build two-column layout for below-xl viewports
    const columnsElement = document.querySelector('#calendar-season-columns');
    if (!columnsElement) {
        return;
    }
    renderPaneColumns(columnsElement, seasons.map((season, i) => ({ heading: getSeasonLabel(season.Season), pane: seasonPanesForColumns[i] })));
}
async function renderClanWeeklyColumns(columnsElement, entries) {
    columnsElement.replaceChildren();
    if (entries.length === 0) {
        return;
    }
    const panes = await Promise.all(entries.map(async (entry) => renderClanWeeklyPane(entry)));
    renderPaneColumns(columnsElement, entries.map((entry, i) => ({
        heading: formatTabDate(weekCountToActivationMs(entry.WeekCount)),
        pane: panes[i],
    })));
}
/**
 Returns the Unix timestamp (seconds) of the next Sunday at 23:02 UTC,
 when the weekly forecast is expected to be published (23:00 UTC) and both
 proxy hops (up to 1 minute cache each) have had time to refresh.
 If today is Sunday and it's before 23:02 UTC, returns today's target time.
 */
export function nextForecastPublishedMs() {
    // The forecast is published at Sunday 23:02 UTC, which is 58 minutes before the Monday 00:00 weekly reset.
    const candidate = getNextWeeklyResetMs() - (58 * 60 * 1000);
    // If we're in the 58-minute window between Sunday 23:02 and Monday 00:00, candidate is in the past.
    return candidate > Date.now() ? candidate : candidate + MILLIS_PER_WEEK;
}
/**
 Populates the weekly missions notice with a timer badge and local-time update text.
 */
export function initWeeklyMissionsNotice() {
    const timerElement = document.querySelector('#weekly-missions-timer');
    if (!timerElement) {
        return;
    }
    const expiryMs = nextForecastPublishedMs();
    const badge = createShortTimerBadge(expiryMs / 1000, 'Pending Refresh');
    timerElement.append(badge);
    scheduleReload(expiryMs);
}
/**
 Renders the forecasts that are pure client-side rotation math, with no worldState dependency:
 The Circuit and Steel Path Honors (Teshin).
 */
async function renderClientSideForecasts() {
    const circuitForecastBodyElement = document.querySelector('#circuit-forecast-body');
    if (circuitForecastBodyElement) {
        const dict = await getDictPromise();
        renderCircuitForecastTable(circuitForecastBodyElement, dict);
    }
    const teshinForecastHeaderElement = document.querySelector('#teshin-forecast-header');
    if (teshinForecastHeaderElement) {
        renderTeshinForecastHeader(teshinForecastHeaderElement);
    }
    const teshinForecastBodyElement = document.querySelector('#teshin-forecast-body');
    if (teshinForecastBodyElement) {
        renderTeshinForecastTable(teshinForecastBodyElement);
    }
}
export async function initWeeklyForecast() {
    const deepTabsElement = document.querySelector('#deep-archimedea-tabs');
    const temporalTabsElement = document.querySelector('#temporal-archimedea-tabs');
    const descentTabsElement = document.querySelector('#descendia-tabs');
    const calendarSeasonTabsElement = document.querySelector('#calendar-season-tabs');
    const clanWeeklyColumnsElement = document.querySelector('#clan-weekly-columns');
    const worldState = await WarframeApiFrontProxyClient.fetchWorldState();
    // Deep Archimedea (CT_LAB)
    const deepArchimedeas = (worldState.Conquests ?? []).filter((c) => c.Type === 'CT_LAB');
    if (deepTabsElement && deepArchimedeas.length > 0) {
        await renderArchimedeaTabs(deepTabsElement, document.querySelector('#deep-archimedea-content'), deepArchimedeas, 'CT_LAB');
    }
    // Temporal Archimedea (CT_HEX)
    const temporalArchimedeas = (worldState.Conquests ?? []).filter((c) => c.Type === 'CT_HEX');
    if (temporalTabsElement && temporalArchimedeas.length > 0) {
        await renderArchimedeaTabs(temporalTabsElement, document.querySelector('#temporal-archimedea-content'), temporalArchimedeas, 'CT_HEX');
    }
    // Descendia
    const descents = worldState.Descents ?? [];
    if (descentTabsElement && descents.length > 0) {
        await renderDescentTabs(descentTabsElement, document.querySelector('#descendia-content'), descents);
    }
    // Calendar Seasons
    const calendarSeasons = worldState.KnownCalendarSeasons ?? [];
    if (calendarSeasonTabsElement && calendarSeasons.length > 0) {
        await renderCalendarSeasonTabs(calendarSeasonTabsElement, document.querySelector('#calendar-season-content'), calendarSeasons);
    }
    // Clan Weekly Initiatives
    const clanWeeklyEntries = worldState.WeeklyVaultBonusRewards ?? [];
    if (clanWeeklyColumnsElement && clanWeeklyEntries.length > 0) {
        window.ExportImages = await fetchExport('ExportImages');
        await renderClanWeeklyColumns(clanWeeklyColumnsElement, clanWeeklyEntries);
    }
    await renderClientSideForecasts();
}
initWeeklyForecastToc();
initWeeklyMissionsNotice();
await initWeeklyForecast();
scrollToHashedSection();
startSyncingUrlHash();
//# sourceMappingURL=weekly-forecast.js.map