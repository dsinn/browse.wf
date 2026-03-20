/**
 * Weekly Forecast page — renders tabs for Deep Archimedea, Temporal Archimedea, and Descendia
 * across all available weeks from worldState.
 *
 * Uses globals exposed by common.js:
 *   - getDictPromise, getOSDictPromise
 */

import {transformConquestMissions, renderConquestMissions, renderConquestFrameVariables} from './conquest-helpers.js';
import {renderDescentChallenges} from './descendia.js';
import {getSeasonLabel} from './calendar-seasons-data.js';
import {renderCalendarSeasonPane} from './calendar-seasons.js';
import {createArbyCountdownBadge} from './arbys-timer.js';
import {WarframeApiFrontProxyClient} from './warframe-api-proxy-client.js';
import {fetchExport} from './public-export-fetcher.js';

declare function getDictPromise(): Promise<Record<string, string>>;
declare function getOSDictPromise(): Promise<Record<string, string>>;

export function mongoMs(d: IMongoDate): number {
	return Number.parseInt(d.$date.$numberLong, 10);
}

export function formatTabDate(ms: number): string {
	return new Date(ms).toLocaleDateString('en', {month: 'short', day: 'numeric'});
}

/**
 * Builds a Bootstrap tab nav item and its corresponding tab pane.
 * Stores the activation timestamp on the button as data-activation for refresh identity.
 */
export function buildTab(
	tabsElement: HTMLElement,
	contentElement: HTMLElement,
	id: string,
	label: string,
	activationMs: number,
	isActive: boolean,
	buildContent: (paneBody: HTMLElement) => void,
): void {
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

/**
 * Returns the activation timestamp of the active tab button, or null if none is active.
 */
export function getActiveTabActivation(tabsElement: HTMLElement): string | undefined {
	const active = tabsElement.querySelector<HTMLElement>('.nav-link.active');
	return active ? active.dataset.activation : undefined;
}

/**
 * Re-activates the tab whose data-activation matches the given timestamp string.
 * No-ops if not found (the tab no longer exists after a refresh).
 *
 * Directly manipulates classes instead of using Bootstrap's Tab JS API to avoid
 * stale cached instances from the previous render confusing Bootstrap's hide/show logic.
 */
export function restoreActiveTab(tabsElement: HTMLElement, activation: string): void {
	const target = tabsElement.querySelector<HTMLElement>(`.nav-link[data-activation="${activation}"]`);
	if (!target) {
		return;
	}

	// Deactivate whichever tab buildTab marked active (index 0 / current)
	tabsElement.querySelector<HTMLElement>('.nav-link.active')?.classList.remove('active');
	const contentElement = document.querySelector(`#${tabsElement.id.replace(/-tabs$/u, '-content')}`);
	contentElement?.querySelector('.tab-pane.active')?.classList.remove('show', 'active');

	// Activate the restored tab
	target.classList.add('active');
	const paneId = (target.dataset.bsTarget ?? '').slice(1);
	document.querySelector(`#${paneId}`)?.classList.add('show', 'active');
}

async function renderConquestTabs(
	tabsElement: HTMLElement,
	contentElement: HTMLElement,
	conquests: any[],
	conquestType: string,
	variantKeyPrefix: string,
	preserveActivation: string | undefined = undefined,
): Promise<void> {
	const now = Date.now();
	tabsElement.innerHTML = '';
	contentElement.innerHTML = '';

	// Pre-render all pane contents in parallel
	const paneContents = await Promise.all(conquests.map(async conquest => {
		const missions = await transformConquestMissions(conquest, conquestType);
		const [tbody, fvRow] = await Promise.all([
			renderConquestMissions(missions, variantKeyPrefix),
			renderConquestFrameVariables(conquest.Variables || []),
		]);
		return {tbody, fvRow};
	}));

	// There's usually only one entry per conquest type, but handle multiple for robustness
	for (const [i, conquest] of conquests.entries()) {
		const activationMs = mongoMs(conquest.Activation);
		const expiryMs = mongoMs(conquest.Expiry);
		const isCurrent = activationMs <= now && now < expiryMs;
		const label = formatTabDate(activationMs);
		const id = conquestType.toLowerCase() + '-' + i;

		buildTab(tabsElement, contentElement, id, label, activationMs, isCurrent || i === 0, pane => {
			const {tbody, fvRow} = paneContents[i];

			const missionsTable = document.createElement('table');
			missionsTable.className = 'table table-sm table-borderless table-hover mb-2';
			missionsTable.append(tbody);
			pane.append(missionsTable);

			const fvTable = document.createElement('table');
			fvTable.className = 'table table-sm table-borderless mb-0';
			fvTable.append(fvRow);
			pane.append(fvTable);
		});
	}

	if (preserveActivation !== undefined) {
		restoreActiveTab(tabsElement, preserveActivation);
	}
}

async function renderDescentTabs(
	tabsElement: HTMLElement,
	contentElement: HTMLElement,
	descents: any[],
	preserveActivation: string | undefined = undefined,
): Promise<void> {
	const now = Date.now();
	tabsElement.innerHTML = '';
	contentElement.innerHTML = '';

	const dict = await getDictPromise();

	const activeIdx = descents.findIndex(d =>
		mongoMs(d.Activation) <= now && now < mongoMs(d.Expiry));

	for (const [i, descent] of descents.entries()) {
		const activationMs = mongoMs(descent.Activation);
		const isActive = i === activeIdx || (activeIdx === -1 && i === 0);
		const label = formatTabDate(activationMs);
		const id = 'descent-' + i;

		buildTab(tabsElement, contentElement, id, label, activationMs, isActive, pane => {
			const tbody = renderDescentChallenges(descent, dict);

			const table = document.createElement('table');
			table.className = 'table table-sm table-borderless table-hover descendia-challenges';

			// Header row
			const thead = document.createElement('thead');
			const headerRow = document.createElement('tr');
			for (const text of ['#', 'Type', 'Challenge', 'Arena', 'Specs', 'Auras']) {
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

	if (preserveActivation !== undefined) {
		restoreActiveTab(tabsElement, preserveActivation);
	}
}

async function renderCalendarSeasonTabs(
	tabsElement: HTMLElement,
	contentElement: HTMLElement,
	seasons: any[],
	preserveActivation: string | undefined = undefined,
): Promise<void> {
	const now = Date.now();
	tabsElement.innerHTML = '';
	contentElement.innerHTML = '';

	const activeIdx = seasons.findIndex(s =>
		mongoMs(s.Activation) <= now && now < mongoMs(s.Expiry));

	// Required for common.js' setImageSource, must be set before renderCalendarSeasonPane runs
	(globalThis as any).ExportImages = await fetchExport('ExportImages');

	// Render all season panes in parallel
	const seasonPanes = await Promise.all(seasons.map(async season => renderCalendarSeasonPane(season)));

	// Build tabs with the rendered content
	for (const [i, season] of seasons.entries()) {
		const activationMs = mongoMs(season.Activation);
		const isActive = i === activeIdx || (activeIdx === -1 && i === 0);
		const label = getSeasonLabel(season.Season);
		const id = 'calendar-season-' + i;

		buildTab(tabsElement, contentElement, id, label, activationMs, isActive, pane => {
			pane.append(seasonPanes[i]);
		});
	}

	if (preserveActivation !== undefined) {
		restoreActiveTab(tabsElement, preserveActivation);
	}
}

/**
 * Returns the Unix timestamp (seconds) of the next Sunday at 23:02 UTC,
 * when the weekly forecast is expected to be published (23:00 UTC) and both
 * proxy hops (up to 1 minute cache each) have had time to refresh.
 * If today is Sunday and it's before 23:02 UTC, returns today's target time.
 */
export function nextForecastPublishedSeconds(): number {
	const now = new Date();
	// GetUTCDay(): 0 = Sunday, 1 = Monday, ..., 6 = Saturday
	const dayOfWeek = now.getUTCDay();
	const daysUntilSunday = (7 - dayOfWeek) % 7;

	const target = new Date(Date.UTC(
		now.getUTCFullYear(),
		now.getUTCMonth(),
		now.getUTCDate() + daysUntilSunday,
		23,
		2,
		0,
		0,
	));

	// If it's Sunday but already past 23:02, go to next week
	if (target.getTime() <= Date.now()) {
		target.setUTCDate(target.getUTCDate() + 7);
	}

	return Math.floor(target.getTime() / 1000);
}

/**
 * Populates the weekly missions notice with a timer badge and local-time update text.
 */
function initWeeklyMissionsNotice(): void {
	const timerElement = document.querySelector('#weekly-missions-timer');
	if (!timerElement) {
		return;
	}

	const badge = createArbyCountdownBadge(nextForecastPublishedSeconds());
	timerElement.append(badge);
}

async function initWeeklyForecast(isRefresh = false): Promise<void> {
	const labTabsElement = document.querySelector<HTMLElement>('#lab-conquest-tabs');
	const hexTabsElement = document.querySelector<HTMLElement>('#hex-conquest-tabs');
	const descentTabsElement = document.querySelector<HTMLElement>('#descendia-tabs');
	const calendarSeasonTabsElement = document.querySelector<HTMLElement>('#calendar-season-tabs');

	// Capture which tab the user is on before re-rendering (only meaningful on refresh)
	const labActivation = (isRefresh && labTabsElement) ? getActiveTabActivation(labTabsElement) : undefined;
	const hexActivation = (isRefresh && hexTabsElement) ? getActiveTabActivation(hexTabsElement) : undefined;
	const descentActivation = (isRefresh && descentTabsElement) ? getActiveTabActivation(descentTabsElement) : undefined;
	const calendarSeasonActivation = (isRefresh && calendarSeasonTabsElement) ? getActiveTabActivation(calendarSeasonTabsElement) : undefined;

	const worldState = await WarframeApiFrontProxyClient.fetchWorldState();

	// Deep Archimedea (CT_LAB)
	const labConquests = (worldState.Conquests ?? []).filter((c: any) => c.Type === 'CT_LAB');
	if (labTabsElement && labConquests.length > 0) {
		await renderConquestTabs(
			labTabsElement,
			document.querySelector<HTMLElement>('#lab-conquest-content')!,
			labConquests,
			'CT_LAB',
			'/Lotus/Language/Conquest/MissionVariant_LabConquest_',
			labActivation,
		);
	}

	// Temporal Archimedea (CT_HEX)
	const hexConquests = (worldState.Conquests ?? []).filter((c: any) => c.Type === 'CT_HEX');
	if (hexTabsElement && hexConquests.length > 0) {
		await renderConquestTabs(
			hexTabsElement,
			document.querySelector<HTMLElement>('#hex-conquest-content')!,
			hexConquests,
			'CT_HEX',
			'/Lotus/Language/Conquest/MissionVariant_HexConquest_',
			hexActivation,
		);
	}

	// Descendia
	const descents = worldState.Descents ?? [];
	if (descentTabsElement && descents.length > 0) {
		await renderDescentTabs(
			descentTabsElement,
			document.querySelector<HTMLElement>('#descendia-content')!,
			descents,
			descentActivation,
		);
	}

	// Calendar Seasons
	const calendarSeasons = worldState.KnownCalendarSeasons ?? [];
	if (calendarSeasonTabsElement && calendarSeasons.length > 0) {
		await renderCalendarSeasonTabs(
			calendarSeasonTabsElement,
			document.querySelector<HTMLElement>('#calendar-season-content')!,
			calendarSeasons,
			calendarSeasonActivation,
		);
	}

	// Schedule next refresh at 00:01 UTC
	setTimeout(() => {
		void initWeeklyForecast(true).catch(console.error);
	}, (nextForecastPublishedSeconds() * 1000) - Date.now());
}

initWeeklyMissionsNotice();
// eslint-disable-next-line unicorn/prefer-top-level-await
initWeeklyForecast().catch(console.error);
