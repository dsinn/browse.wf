import {triggerCloudSync} from './cloud-sync/trigger.js';

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
	const {invigorationNames} = (globalThis as any);

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
	const badge = (globalThis as any).createShortTimerBadge(weekEnd, 'Pending Refresh') as HTMLSpanElement;
	timerElement.append(badge);
}

export function scheduleInvigorationReload(): void {
	const weekEnd = ((getWeekIndex(Date.now()) + 1) * 604_800) + 1_391_990_400;
	setTimeout(() => {
		location.reload();
	}, (weekEnd * 1000) - Date.now());
}

// Expose globally for use by the non-module inline script
(globalThis as any).getWeekIndex = getWeekIndex;
(globalThis as any).initInvigorationTimer = initInvigorationTimer;
(globalThis as any).scheduleInvigorationReload = scheduleInvigorationReload;
(globalThis as any).loadCache = loadCache;
(globalThis as any).populateInvigorationGrid = populateInvigorationGrid;
(globalThis as any).preFillForm = preFillForm;
(globalThis as any).saveToCache = saveToCache;
(globalThis as any).showHistory = showHistory;
(globalThis as any).showResults = showResults;
