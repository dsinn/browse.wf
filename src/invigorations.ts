import {triggerCloudSync} from './cloud-sync/trigger.js';
import {createShortTimerBadge} from './short-timer-badge.js';

type InvigorationRequest = {
	n: string;
	s: string[];
	p: boolean;
};

type InvigorationResponse = {
	suits: string[];
	offensiveUpgrades: string[];
	defensiveUpgrades: string[];
};

type InvigorationCacheEntry = {
	request: InvigorationRequest;
	response: InvigorationResponse;
};

type InvigorationCache = Record<number, InvigorationCacheEntry>;

let invigorationNames: Record<string, string> = {};

export function initInvigorations(names: Record<string, string>): void {
	invigorationNames = names;
	initInvigorationTimer();
}

export function getWeekIndex(timestamp: number): number {
	return Math.trunc(((timestamp / 1000) - 1_391_990_400) / 604_800);
}

export function loadCache(): InvigorationCache {
	const cacheString = localStorage.getItem('invigorations.cache');
	if (!cacheString) {
		return {};
	}

	try {
		const parsed = JSON.parse(cacheString);
		// Must be an object (not array, null, etc.)
		if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
			return {};
		}

		return parsed;
	} catch (error) {
		console.error('Failed to parse invigoration cache:', error);
		return {};
	}
}

export function populateInvigorationGrid(prefix: string, response: InvigorationResponse, suits?: string[]): void {
	const {baseSuitTypes} = (globalThis as any);
	const {dict} = (globalThis as any);

	const displaySuits = (suits?.length === response.suits.length) ? suits : response.suits;
	for (let i = 0; i < response.suits.length; i++) {
		const suitData = baseSuitTypes[displaySuits[i]];
		// Fall back to untranslated response in case of new content
		const suitElement = document.querySelector(`#${prefix}-suit-${i}`);
		const offElement = document.querySelector(`#${prefix}-off-${i}`);
		const defElement = document.querySelector(`#${prefix}-def-${i}`);
		if (suitElement) {
			suitElement.textContent = suitData ? dict[suitData.name] : displaySuits[i];
		}

		if (offElement) {
			offElement.textContent = invigorationNames[response.offensiveUpgrades[i]] || response.offensiveUpgrades[i];
		}

		if (defElement) {
			defElement.textContent = invigorationNames[response.defensiveUpgrades[i]] || response.defensiveUpgrades[i];
		}
	}
}

export function preFillForm(username: string, peek: boolean, suits: string[]): void {
	const usernameInput = document.querySelector<HTMLInputElement>('#username');
	const peekCheckbox = document.querySelector<HTMLInputElement>('#peek');
	const suitSelects = document.querySelectorAll<HTMLSelectElement>('.suit-select');

	if (usernameInput) {
		usernameInput.value = username;
	}

	if (peekCheckbox) {
		peekCheckbox.checked = peek;
		peekCheckbox.dispatchEvent(new Event('change'));
	}

	for (const [i, suit] of suits.entries()) {
		suitSelects[i].value = suit;
	}
}

export function saveToCache(request: InvigorationRequest, response: InvigorationResponse): void {
	const currentWeek = getWeekIndex(Date.now());
	const targetWeek = request.p ? currentWeek + 1 : currentWeek;

	const cache = loadCache();
	cache[targetWeek] = {request, response};

	const prunedCache: InvigorationCache = {};
	for (const week of [currentWeek - 1, currentWeek, currentWeek + 1]) {
		if (cache[week]) {
			prunedCache[week] = cache[week];
		}
	}

	localStorage.setItem('invigorations.cache', JSON.stringify(prunedCache));
	triggerCloudSync();
}

export function showHistory(currentWeek: number, cache: InvigorationCache): void {
	const currentData = cache[currentWeek];
	const lastWeekData = cache[currentWeek - 1];
	const nextWeekData = cache[currentWeek + 1];

	const historyDiv = document.querySelector('#history');
	const thisWeekDiv = document.querySelector('#history-this-week');
	const lastWeekDiv = document.querySelector('#history-last-week');

	if (!currentData && !lastWeekData) {
		historyDiv?.classList.add('d-none');
		return;
	}

	historyDiv?.classList.remove('d-none');

	if (currentData) {
		// Prefer next week's request suits: they represent what the user confirmed as this week's offerings
		const thisWeekSuits = nextWeekData ? nextWeekData.request.s : undefined;
		populateInvigorationGrid('this-week', currentData.response, thisWeekSuits);
		thisWeekDiv?.classList.remove('d-none');
	} else {
		thisWeekDiv?.classList.add('d-none');
	}

	if (lastWeekData) {
		// Prefer current week's request suits: they represent what the user confirmed as last week's offerings
		const lastWeekSuits = currentData ? currentData.request.s : undefined;
		populateInvigorationGrid('last-week', lastWeekData.response, lastWeekSuits);
		lastWeekDiv?.classList.remove('d-none');
	} else {
		lastWeekDiv?.classList.add('d-none');
	}
}

export function showResults(response: InvigorationResponse, request: InvigorationRequest): void {
	const resultsDiv = document.querySelector('#results');
	resultsDiv?.classList.remove('d-none');

	// Update heading
	const heading = document.querySelector('#results h4');
	if (heading) {
		heading.textContent = request.p ? 'Next Week\'s Offerings' : 'Current Offerings';
	}

	// Update explainer text
	for (const x of document.querySelectorAll('.explainer')) {
		x.classList.add('d-none');
	}

	if (request.s.length !== response.suits.length) {
		document.querySelector('#explain-noprev')?.classList.remove('d-none');
	} else if (request.p) {
		document.querySelector('#explain-peek')?.classList.remove('d-none');
	} else {
		document.querySelector('#explain-current')?.classList.remove('d-none');
	}

	for (const x of document.querySelectorAll('#results b')) {
		x.textContent = request.n;
	}

	populateInvigorationGrid('out', response);
}

export function initInvigorationTimer(): void {
	const timerElement = document.querySelector('#invigoration-timer');
	if (!timerElement) {
		return;
	}

	const weekEnd = ((getWeekIndex(Date.now()) + 1) * 604_800) + 1_391_990_400;
	const badge = createShortTimerBadge(weekEnd, 'Pending Refresh');
	timerElement.append(badge);
}

export function scheduleInvigorationReload(): void {
	const weekEnd = ((getWeekIndex(Date.now()) + 1) * 604_800) + 1_391_990_400;
	setTimeout(() => {
		location.reload();
	}, (weekEnd * 1000) - Date.now());
}

export function showCacheAlert(type: string, message: string): void {
	const alert = document.querySelector('#cache-alert');
	if (!alert) {
		return;
	}

	alert.className = `alert alert-${type} mb-3`;
	alert.textContent = message;
	alert.classList.remove('d-none');
}

export function initInvigorationsFromCache(inventoryDataUsed: boolean): void {
	if (inventoryDataUsed) {
		return;
	}

	const cache = loadCache();
	const currentWeek = getWeekIndex(Date.now());
	const lastWeekData = cache[currentWeek - 1];
	const currentWeekData = cache[currentWeek];
	const nextWeekData = cache[currentWeek + 1];

	// Priority: next week > current week > last week (always use most recent data)
	if (nextWeekData) {
		// Next week data exists (most recent) - we have results, so peek=true
		preFillForm(nextWeekData.request.n, true, nextWeekData.request.s);
		showResults(nextWeekData.response, nextWeekData.request);
		showCacheAlert('success', 'Loaded fresh data from cache');
		showHistory(currentWeek, cache);
	} else if (currentWeekData) {
		// Current week data exists - we have results, so peek=true
		// Use response suits: this week's offerings are the output of last week's peek request
		preFillForm(currentWeekData.request.n, true, currentWeekData.response.suits);
		// Force p=false: data saved as "next week" last week is now this week's data
		showResults(currentWeekData.response, {...currentWeekData.request, p: false});
		showCacheAlert('info', 'Pre-filled form with data for this week only from cache. For next week\'s invigorations, please verify and re-calculate.');
		showHistory(currentWeek, cache);
	} else if (lastWeekData) {
		// Last week data only - pre-fill for convenience, but no results shown
		preFillForm(lastWeekData.request.n, false, lastWeekData.response.suits);
		showCacheAlert('info', 'Pre-filled form with stale data from last week\'s cache');
		showHistory(currentWeek, cache);
	} else {
		// No recent data - check for older data
		let newestWeek = -Infinity;
		for (const key of Object.keys(cache)) {
			const week = Number.parseInt(key, 10);
			if (!Number.isNaN(week) && week > newestWeek) {
				newestWeek = week;
			}
		}

		if (newestWeek !== -Infinity && currentWeek - newestWeek >= 2) {
			const newestData = cache[newestWeek];
			if (newestData) {
				const weeksOld = currentWeek - newestWeek;
				preFillForm(newestData.request.n, false, []);
				showCacheAlert('warning', `Cached data is ${weeksOld} weeks old - too stale to pre-fill form`);
			}
		}
	}

	if (lastWeekData || currentWeekData || nextWeekData) {
		scheduleInvigorationReload();
	}
}

(globalThis as any).getWeekIndex = getWeekIndex;
(globalThis as any).initInvigorations = initInvigorations;
(globalThis as any).initInvigorationsFromCache = initInvigorationsFromCache;
(globalThis as any).saveToCache = saveToCache;
(globalThis as any).showResults = showResults;
