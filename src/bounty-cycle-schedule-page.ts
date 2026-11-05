import {
	getCycleWindows, formatWindow, getDayBucket, formatDayHeading, groupWindowsByDay, isWindowPast, isWindowActive,
	getNextBoundary, MAX_WINDOWS_PER_DAY,
	type CyclePhase, type HourFormat, type CycleWindow,
} from './bounty-cycle-schedule.js';

const DAY_COUNT = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

// Keep in sync with --theme-transition-duration in src/bounty-cycle-schedule.css.
const THEME_TRANSITION_MS = 1200;

function getTimeZone(): 'local' | 'utc' {
	const select = document.querySelector<HTMLSelectElement>('#select-tz')!;
	return select.value === 'zulu' ? 'utc' : 'local';
}

function getPhase(): CyclePhase {
	const toggle = document.querySelector<HTMLInputElement>('#phase-toggle')!;
	return toggle.checked ? 'night' : 'day';
}

function getHourFormat(): HourFormat {
	const select = document.querySelector<HTMLSelectElement>('#select-hourfmt')!;
	if (select.value === 'mil' || select.value === '12') {
		return select.value;
	}

	return '24';
}

type DayColumn = {
	th: HTMLTableCellElement;
	dayBucket: number;
	dayWindows: CycleWindow[];
	/**
	 * Index of the last truly-past window, or -1 if none - where the "now" boundary belongs.
	 * Only defined for the first column, since startDayBucket in render() is always "today" in
	 * the selected timezone, so day 0 is always the one containing "now".
	 */
	lastPastIndex: number | undefined;
};

/**
 * Pairs each day's header cell and window data with a live iterator over that column's <td>
 * slots (walking straight down the fixed-size tbody rows), so a cell and the data that fills
 * it are always looked up together at the same point in the code rather than computed
 * separately and threaded through as parallel day/slot indices.
 */
function * dayColumns(headingsRow: HTMLTableRowElement, grouped: Map<number, CycleWindow[]>, now: number): Generator<DayColumn & {slots: () => Generator<HTMLTableCellElement>}> {
	const tbody = document.querySelector<HTMLTableSectionElement>('#schedule-table-body')!;

	let day = 0;
	for (const [dayBucket, dayWindows] of grouped) {
		const th = headingsRow.cells[day];
		const isFirstColumn = day === 0;

		// The "now" boundary sits directly after the last truly-past (dimmed) window, i.e.
		// right where the currently active window would start (or where the next upcoming
		// window starts, if none is active in this phase right now).
		let lastPastIndex: number | undefined;
		if (isFirstColumn) {
			lastPastIndex = -1;
			for (const [index, window] of dayWindows.entries()) {
				if (isWindowPast(window, now)) {
					lastPastIndex = index;
				}
			}
		}

		const currentDay = day;
		yield {
			th,
			dayBucket,
			dayWindows,
			lastPastIndex,
			* slots(): Generator<HTMLTableCellElement> {
				for (let slot = 0; slot < MAX_WINDOWS_PER_DAY; slot++) {
					yield tbody.rows[slot].cells[currentDay];
				}
			},
		};
		day++;
	}
}

function render(): void {
	const phase = getPhase();
	const timeZone = getTimeZone();
	const hourFormat = getHourFormat();
	const now = Date.now();

	// `startDayBucket` is always "today" in the selected timezone, so the first column (day 0)
	// is always the one containing "now" - see the :first-child rule in
	// src/bounty-cycle-schedule.css, which relies on this same invariant instead of a
	// per-render comparison.
	const startDayBucket = getDayBucket(now, timeZone);
	const windows = getCycleWindows(phase, startDayBucket, DAY_COUNT * DAY_MS);
	const grouped = groupWindowsByDay(windows, startDayBucket, DAY_COUNT, timeZone);

	const headingsRow = document.querySelector<HTMLTableRowElement>('#schedule-table-headings')!;

	for (const column of dayColumns(headingsRow, grouped, now)) {
		column.th.textContent = formatDayHeading(column.dayBucket, timeZone);

		let slot = 0;
		for (const td of column.slots()) {
			td.classList.toggle('is-now-boundary', column.lastPastIndex !== undefined && slot === column.lastPastIndex + 1);

			const window = column.dayWindows[slot];
			if (window) {
				td.classList.remove('is-empty-slot');
				td.classList.toggle('is-past', isWindowPast(window, now));
				td.classList.toggle('is-active-window', column.lastPastIndex !== undefined && isWindowActive(window, now));
				td.textContent = formatWindow(window, timeZone, hourFormat);
			} else {
				td.classList.add('is-empty-slot');
				td.textContent = '';
			}

			slot++;
		}
	}
}

function setCelestialBody(element: HTMLElement, active: boolean, animate: boolean): void {
	element.classList.remove('is-entering', 'is-exiting');
	if (!animate) {
		element.classList.toggle('is-active', active);
		element.classList.toggle('is-exited', !active);
		return;
	}

	element.classList.remove('is-active', 'is-exited');
	if (active) {
		element.classList.add('is-entering');
	} else {
		element.classList.add('is-exiting');
	}

	element.addEventListener('animationend', () => {
		element.classList.remove('is-entering', 'is-exiting');
		element.classList.toggle('is-active', active);
		element.classList.toggle('is-exited', !active);
	}, {once: true});
}

function setCelestialState(phase: CyclePhase, animate: boolean): void {
	const sun = document.querySelector<HTMLSpanElement>('#celestial-sun')!;
	const moon = document.querySelector<HTMLSpanElement>('#celestial-moon')!;
	setCelestialBody(sun, phase === 'day', animate);
	setCelestialBody(moon, phase === 'night', animate);
}

function updatePhaseLabels(phase: CyclePhase): void {
	document.querySelector<HTMLSpanElement>('#phase-label-day')!.classList.toggle('is-active-phase', phase === 'day');
	document.querySelector<HTMLSpanElement>('#phase-label-night')!.classList.toggle('is-active-phase', phase === 'night');
}

function applyTheme(phase: CyclePhase): void {
	const theme = phase === 'night' ? 'dark' : 'light';
	document.documentElement.dataset.bsTheme = theme;
	document.body.dataset.bsTheme = theme;
}

let scheduledMidTransitionRender: ReturnType<typeof setTimeout> | undefined;

function onPhaseChange(): void {
	const phase = getPhase();
	applyTheme(phase);
	setCelestialState(phase, true);
	updatePhaseLabels(phase);

	// Swap the table data at the transition's midpoint rather than immediately: the fast-slow-
	// fast theme easing lingers on the blended midpoint color, which is also the lowest-
	// contrast point against the text, so the content change is least jarring right there.
	// Cancel any still-pending swap from a previous toggle so rapid re-toggling can't stack up
	// redundant renders.
	clearTimeout(scheduledMidTransitionRender);
	scheduledMidTransitionRender = setTimeout(render, THEME_TRANSITION_MS / 2);
}

let scheduledRerender: ReturnType<typeof setTimeout> | undefined;

// Re-render exactly when something visible would change (a phase transition or day rollover),
// rather than polling on a fixed interval. Mirrors live.ts's updateDayNightCycle scheduling.
function scheduleNextRerender(): void {
	clearTimeout(scheduledRerender);
	const now = Date.now();
	const nextBoundary = getNextBoundary(now, getTimeZone());
	scheduledRerender = setTimeout(() => {
		render();
		scheduleNextRerender();
	}, nextBoundary - now);
}

function onTimeZoneChange(): void {
	render();
	// The next boundary depends on the timezone (day rollover shifts), so re-arm the schedule.
	scheduleNextRerender();
}

document.querySelector<HTMLInputElement>('#phase-toggle')!.addEventListener('change', onPhaseChange);
document.querySelector<HTMLSelectElement>('#select-tz')!.addEventListener('change', onTimeZoneChange);
document.querySelector<HTMLSelectElement>('#select-hourfmt')!.addEventListener('change', render);

applyTheme(getPhase());
setCelestialState(getPhase(), false);
updatePhaseLabels(getPhase());
render();
scheduleNextRerender();
