import type {IFaction, IRegion, TFaction} from 'warframe-public-export-plus';
import {makeArchwingIcon} from './archwing-icon.js';
import {escapeHtml} from './helpers/string-helpers.js';
import {getDaysInMonth, localDateToUtcDayTimestamp} from './helpers/time-helpers.js';
import {FACTION_ICON_PATHS} from './faction-icons.js';

// `common.js`
declare function getDictPromise(): Promise<Record<string, string>>;
declare function fetchExport(name: string): Promise<Record<string, any>>;
declare function toTitleCase(string_: string): string;
declare function setImageSource(img: HTMLImageElement, icon: string): void;

// Fetch
declare let dict: Record<string, string>;
declare let ExportFactions: Record<TFaction, IFaction>;
declare let ExportRegions: Record<string, IRegion>;

// `src/helpers/tileset-helpers.js` (from bundle)
declare function getTileset(node: IRegion): string | undefined;
declare function formatTileset(tileset: string | undefined): string | undefined;

// `tooltip.js` (from bundle)
declare function addTooltip(element: HTMLElement, title: string): void;

const SECONDS_PER_DAY = 86_400;
const DATE_HEADING_FORMAT = new Intl.DateTimeFormat(undefined, {weekday: 'short', month: 'short', day: 'numeric'});

// Incursion data: [timestamp_seconds, "node1,node2,...,node6"]
let incursions: Array<[number, string]> = [];
let epochDay = -1; // Timestamp of first entry in seconds
let dataStartYear = -1;
let dataEndYear = -1;

// View state
function getDefaultViewMode(): 'calendar' | 'list' | 'table' {
	if (window.innerWidth >= 1200) { // Bootstrap xl
		return 'calendar';
	}

	if (window.innerWidth >= 992) { // Bootstrap lg
		return 'table';
	}

	return 'list';
}

let viewMode: 'calendar' | 'list' | 'table' = getDefaultViewMode();
let viewAnchorDate: Date = getLocalToday();

function getLocalToday(): Date {
	const now = new Date();
	return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getUtcToday(): number {
	return Math.trunc(Date.now() / (SECONDS_PER_DAY * 1000)) * SECONDS_PER_DAY;
}

function getIncursionsForDay(utcDayTimestamp: number): string[] | undefined {
	if (epochDay === -1) {
		return undefined;
	}

	const index = (utcDayTimestamp - epochDay) / SECONDS_PER_DAY;
	if (index < 0 || index >= incursions.length) {
		return undefined;
	}

	return incursions[index][1].split(',');
}

function syncDropdownsToAnchor(): void {
	document.querySelector<HTMLSelectElement>('#select-month')!.value = viewAnchorDate.getMonth().toString();
	document.querySelector<HTMLSelectElement>('#select-year')!.value = viewAnchorDate.getFullYear().toString();
}

function getNavbarHeight(): number {
	return document.querySelector('#navbar-spacer')!.clientHeight;
}

function scrollToToday(): void {
	const todayCell = document.querySelector('.is-today');
	if (todayCell) {
		const controls = document.querySelector('#incursions-controls')!;
		const offset = getNavbarHeight() + controls.clientHeight;
		window.scrollTo({top: todayCell.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth'});
	}
}

const VIEW_MODE_BUTTONS = {
	calendar: 'btn-view-calendar',
	list: 'btn-view-list',
	table: 'btn-view-table',
} as const;

function updateViewButtons(): void {
	for (const id of Object.values(VIEW_MODE_BUTTONS)) {
		document.querySelector('#' + id)!.className = (id === VIEW_MODE_BUTTONS[viewMode])
			? 'btn btn-primary'
			: 'btn btn-secondary';
	}
}

function setViewMode(mode: typeof viewMode): void {
	viewMode = mode;
	updateViewButtons();
	renderSchedule();
	scrollToToday();
}

function navigate(direction: number): void {
	viewAnchorDate.setMonth(viewAnchorDate.getMonth() + direction);
	syncDropdownsToAnchor();
	renderSchedule();
}

function goToToday(): void {
	viewAnchorDate = getLocalToday();
	syncDropdownsToAnchor();
	renderSchedule();
	scrollToToday();
}

function makeFactionIcon(node: IRegion): HTMLElement {
	const factionName = node.faction ? (dict[ExportFactions[node.faction]?.name] ?? node.faction) : '';
	const levelRange = `${100 + node.minEnemyLevel}-${100 + node.maxEnemyLevel}`;
	const iconPath = node.faction ? FACTION_ICON_PATHS[node.faction] : undefined;

	if (iconPath) {
		const img = document.createElement('img');
		img.className = 'incursion-faction-icon';
		setImageSource(img, iconPath);
		addTooltip(img, `${toTitleCase(factionName)} (${levelRange})`);
		return img;
	}

	const fallback = document.createElement('span');
	fallback.className = 'incursion-faction-icon';
	fallback.textContent = '\u2754'; // ❔
	addTooltip(fallback, `(${levelRange})`);
	return fallback;
}

function makeArchwingIconIfApplicable(node: IRegion): HTMLImageElement | undefined {
	if (!node.tileset?.includes('Archwing')) {
		return undefined;
	}

	return makeArchwingIcon('incursion-archwing-icon');
}

function makePlanetAbbr(node: IRegion, nodeId: string): HTMLElement {
	const locationName = dict[node.name] ?? nodeId;
	const systemName = dict[node.systemName] ?? '';
	const formattedTileset = formatTileset(getTileset(node));

	const abbr = document.createElement('abbr');
	abbr.className = 'incursion-planet';
	abbr.textContent = systemName;

	let tooltipContent = `${escapeHtml(locationName)}, ${escapeHtml(systemName)}`;
	if (formattedTileset) {
		tooltipContent += `<br>${escapeHtml(formattedTileset)}`;
	}

	abbr.dataset.bsHtml = 'true';
	addTooltip(abbr, `<span class="text-nowrap">${tooltipContent}</span>`);
	return abbr;
}

function makePlanetAbbrFull(node: IRegion, nodeId: string): HTMLElement {
	const locationName = dict[node.name] ?? nodeId;
	const systemName = dict[node.systemName] ?? '';
	const formattedTileset = formatTileset(getTileset(node));

	const abbr = document.createElement('abbr');
	abbr.className = 'incursion-planet';
	abbr.textContent = `${locationName}, ${systemName}`;

	if (formattedTileset) {
		abbr.dataset.bsHtml = 'true';
		addTooltip(abbr, `<span class="text-nowrap">${escapeHtml(formattedTileset)}</span>`);
	}

	return abbr;
}

function renderDayCell(cellDate: Date, todayUtc: number): HTMLDivElement {
	const utcTimestamp = localDateToUtcDayTimestamp(cellDate);
	const nodes = getIncursionsForDay(utcTimestamp);
	const isToday = utcTimestamp === todayUtc;
	const isPast = utcTimestamp < todayUtc;

	const cell = document.createElement('div');
	cell.className = 'incursion-day';
	if (isToday) {
		cell.classList.add('is-today');
	}

	if (isPast) {
		cell.classList.add('is-past');
	}

	// Date label
	const dateLabel = document.createElement('div');
	dateLabel.className = 'incursion-date-label';
	dateLabel.textContent = cellDate.getDate().toString();

	cell.append(dateLabel);

	if (nodes) {
		const list = document.createElement('div');
		list.className = 'incursion-missions';
		for (const nodeId of nodes) {
			const node = ExportRegions[nodeId];
			if (!node) {
				continue;
			}

			const pill = document.createElement('div');
			pill.className = 'incursion-mission';
			pill.append(makeFactionIcon(node));
			const missionName = document.createElement('span');
			missionName.className = 'incursion-mission-name';
			missionName.textContent = toTitleCase(dict[node.missionName] ?? node.missionName);
			const archwingIcon = makeArchwingIconIfApplicable(node);
			pill.append(missionName, ' @ ', makePlanetAbbr(node, nodeId), ...(archwingIcon ? [archwingIcon] : []));
			list.append(pill);
		}

		cell.append(list);
	} else {
		const noData = document.createElement('div');
		noData.className = 'incursion-no-data';
		noData.textContent = 'No data';
		cell.append(noData);
	}

	return cell;
}

function renderTableRow(cellDate: Date, todayUtc: number): HTMLTableRowElement {
	const utcTimestamp = localDateToUtcDayTimestamp(cellDate);
	const nodes = getIncursionsForDay(utcTimestamp);
	const isToday = utcTimestamp === todayUtc;
	const isPast = utcTimestamp < todayUtc;

	const row = document.createElement('tr');
	row.className = 'incursion-table-row';
	if (isToday) {
		row.classList.add('is-today');
	}

	if (isPast) {
		row.classList.add('is-past');
	}

	// Date heading cell
	const dateCell = document.createElement('th');
	dateCell.className = 'incursion-table-date';
	dateCell.scope = 'row';
	dateCell.textContent = DATE_HEADING_FORMAT.format(cellDate);
	row.append(dateCell);

	// One cell per mission
	if (nodes) {
		for (const nodeId of nodes) {
			const node = ExportRegions[nodeId];
			const cell = document.createElement('td');
			cell.className = 'incursion-table-missions';
			if (node) {
				const archwingIcon = makeArchwingIconIfApplicable(node);
				cell.append(
					makeFactionIcon(node),
					' ',
					toTitleCase(dict[node.missionName] ?? node.missionName),
					' @ ',
					makePlanetAbbr(node, nodeId),
					...(archwingIcon ? [' ', archwingIcon] : []),
				);
			}

			row.append(cell);
		}
	} else {
		const cell = document.createElement('td');
		cell.className = 'incursion-table-missions incursion-no-data';
		cell.colSpan = 6;
		cell.textContent = 'No data';
		row.append(cell);
	}

	return row;
}

function renderCalendar(container: Element, totalDays: number, viewStart: Date, todayUtc: number): void {
	container.className = 'incursions-grid';

	// Day-of-week headers
	const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
	for (const name of dayHeaders) {
		const header = document.createElement('div');
		header.className = 'incursion-day-header';
		header.textContent = name;
		container.append(header);
	}

	// Leading empty cells (align to day of week, Monday-based)
	const startDow = viewStart.getDay(); // 0=Sun
	const leadingBlanks = (startDow === 0 ? 6 : startDow - 1);
	for (let i = 0; i < leadingBlanks; i++) {
		const blank = document.createElement('div');
		blank.className = 'incursion-day incursion-day-blank';
		container.append(blank);
	}

	for (let d = 0; d < totalDays; d++) {
		const cellDate = new Date(viewStart);
		cellDate.setDate(viewStart.getDate() + d);
		container.append(renderDayCell(cellDate, todayUtc));
	}

	// Trailing empty cells to complete the grid row
	const totalCells = leadingBlanks + totalDays;
	const trailingBlanks = (7 - (totalCells % 7)) % 7;
	for (let i = 0; i < trailingBlanks; i++) {
		const blank = document.createElement('div');
		blank.className = 'incursion-day incursion-day-blank';
		container.append(blank);
	}
}

function renderTable(container: Element, totalDays: number, viewStart: Date, todayUtc: number): void {
	const table = document.createElement('table');
	table.className = 'table incursions-table';
	const tbody = document.createElement('tbody');

	for (let d = 0; d < totalDays; d++) {
		const cellDate = new Date(viewStart);
		cellDate.setDate(viewStart.getDate() + d);
		tbody.append(renderTableRow(cellDate, todayUtc));
	}

	table.append(tbody);
	container.append(table);
}

function renderList(container: Element, totalDays: number, viewStart: Date, todayUtc: number): void {
	container.className = 'incursions-list';

	for (let d = 0; d < totalDays; d++) {
		const cellDate = new Date(viewStart);
		cellDate.setDate(viewStart.getDate() + d);

		const utcTimestamp = localDateToUtcDayTimestamp(cellDate);
		const nodes = getIncursionsForDay(utcTimestamp);
		const isToday = utcTimestamp === todayUtc;
		const isPast = utcTimestamp < todayUtc;

		// Date heading
		const heading = document.createElement('h3');
		heading.className = 'incursion-list-heading';
		if (isToday) {
			heading.classList.add('is-today');
		}

		if (isPast) {
			heading.classList.add('is-past');
		}

		heading.textContent = DATE_HEADING_FORMAT.format(cellDate);
		container.append(heading);

		// Missions
		if (nodes) {
			for (const nodeId of nodes) {
				const node = ExportRegions[nodeId];
				if (!node) {
					continue;
				}

				const pill = document.createElement('div');
				pill.className = 'incursion-mission';
				if (isPast) {
					pill.classList.add('is-past');
				}

				pill.append(makeFactionIcon(node));
				const missionName = document.createElement('span');
				missionName.className = 'incursion-mission-name';
				missionName.textContent = toTitleCase(dict[node.missionName] ?? node.missionName);
				const archwingIcon = makeArchwingIconIfApplicable(node);
				pill.append(missionName, ' @ ', makePlanetAbbrFull(node, nodeId), ...(archwingIcon ? [archwingIcon] : []));
				container.append(pill);
			}
		} else {
			const noData = document.createElement('div');
			noData.className = 'incursion-no-data';
			noData.textContent = 'No data';
			container.append(noData);
		}
	}
}

function renderSchedule(): void {
	const container = document.querySelector('#schedule')!;

	const viewStart = new Date(viewAnchorDate.getFullYear(), viewAnchorDate.getMonth(), 1);
	const totalDays = getDaysInMonth(viewStart);
	const todayUtc = getUtcToday();
	container.innerHTML = '';
	container.className = (viewMode === 'calendar') ? 'incursions-grid-wrapper' : '';

	switch (viewMode) {
		case 'calendar': {
			const grid = document.createElement('div');
			renderCalendar(grid, totalDays, viewStart, todayUtc);
			container.append(grid);
			break;
		}

		case 'list': {
			renderList(container, totalDays, viewStart, todayUtc);
			break;
		}

		case 'table': {
			renderTable(container, totalDays, viewStart, todayUtc);
			break;
		}
	}
}

function populateYearDropdown(): void {
	const select = document.querySelector('#select-year')!;
	for (let year = dataStartYear; year <= dataEndYear; year++) {
		const option = document.createElement('option');
		option.value = year.toString();
		option.textContent = year.toString();
		select.append(option);
	}
}

export async function init(): Promise<void> {
	// Keep sticky controls top in sync with navbar height
	const incursionsControls = document.querySelector<HTMLElement>('#incursions-controls')!;
	new ResizeObserver(() => {
		incursionsControls.style.top = `${getNavbarHeight()}px`;
	}).observe(document.querySelector('#navbar-spacer')!);

	updateViewButtons();

	// Event listeners
	document.querySelector('#btn-prev')!.addEventListener('click', () => {
		navigate(-1);
	});
	document.querySelector('#btn-next')!.addEventListener('click', () => {
		navigate(1);
	});
	document.querySelector('#btn-today')!.addEventListener('click', () => {
		goToToday();
	});
	document.querySelector('#btn-view-calendar')!.addEventListener('click', () => {
		setViewMode('calendar');
	});
	document.querySelector('#btn-view-list')!.addEventListener('click', () => {
		setViewMode('list');
	});
	document.querySelector('#btn-view-table')!.addEventListener('click', () => {
		setViewMode('table');
	});

	// Month/Year dropdown handlers
	document.querySelector<HTMLSelectElement>('#select-month')!.addEventListener('change', function () {
		viewAnchorDate.setMonth(Number.parseInt(this.value, 10));
		renderSchedule();
	});
	document.querySelector<HTMLSelectElement>('#select-year')!.addEventListener('change', function () {
		viewAnchorDate.setFullYear(Number.parseInt(this.value, 10));
		renderSchedule();
	});

	// Initialize Bootstrap tooltips for static elements once Bootstrap JS loads
	window.addEventListener('load', () => {
		for (const element of document.querySelectorAll('[data-bs-toggle="tooltip"]')) {
			void new (globalThis as any).bootstrap.Tooltip(element);
		}
	});

	await loadData();
}

export async function loadData(): Promise<void> {
	const [dictData, factions, regions, images, incursionText] = await Promise.all([
		getDictPromise(),
		fetchExport('ExportFactions'),
		fetchExport('ExportRegions'),
		fetchExport('ExportImages'),
		fetch('sp-incursions.txt').then(async response => response.text()),
	]);

	(globalThis as any).dict = dictData;
	(globalThis as any).ExportFactions = factions;
	(globalThis as any).ExportRegions = regions;
	(globalThis as any).ExportImages = images;

	incursions = incursionText.split('\n')
		.map(line => line.split(';'))
		.filter(array => array.length === 2)
		.map(array => [Number.parseInt(array[0], 10), array[1]] as [number, string]);

	epochDay = incursions[0][0];

	// Derive year range from data
	const firstDate = new Date(incursions[0][0] * 1000);
	// eslint-disable-next-line unicorn/prefer-at
	const lastDate = new Date(incursions[incursions.length - 1][0] * 1000);
	dataStartYear = firstDate.getUTCFullYear();
	dataEndYear = lastDate.getUTCFullYear();

	populateYearDropdown();
	syncDropdownsToAnchor();
	renderSchedule();

	// Scroll today into view on initial load
	scrollToToday();
}

await init();
