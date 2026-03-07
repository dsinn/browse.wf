interface InvigorationRequest {
	n: string;
	s: string[];
	p: boolean;
}

interface InvigorationResponse {
	suits: string[];
	offensiveUpgrades: string[];
	defensiveUpgrades: string[];
}

interface InvigorationCacheEntry {
	request: InvigorationRequest;
	response: InvigorationResponse;
}

interface InvigorationCache {
	[weekIndex: number]: InvigorationCacheEntry;
}

function getWeekIndex(timestamp: number): number
{
	return Math.trunc(((timestamp / 1000) - 1391990400) / 604800);
}

function loadCache(): InvigorationCache
{
	const cacheStr = localStorage.getItem("invigorations.cache");
	if (!cacheStr)
	{
		return {};
	}

	try
	{
		const parsed = JSON.parse(cacheStr);
		// Must be an object (not array, null, etc.)
		if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
		{
			return {};
		}
		return parsed;
	}
	catch (e)
	{
		console.error("Failed to parse invigoration cache:", e);
		return {};
	}
}

function populateInvigorationGrid(prefix: string, response: InvigorationResponse, suits?: string[]): void
{
	const baseSuitTypes: Record<string, { name: string }> = (window as any).baseSuitTypes;
	const dict: Record<string, string> = (window as any).dict;
	const invigorationNames: Record<string, string> = (window as any).invigorationNames;

	const displaySuits = (suits && suits.length === response.suits.length) ? suits : response.suits;
	for (let i = 0; i < response.suits.length; i++)
	{
		const suitData = baseSuitTypes[displaySuits[i]];
		// Fall back to untranslated response in case of new content
		document.getElementById(prefix + "-suit-" + i)!.textContent = suitData ? dict[suitData.name] : displaySuits[i];
		document.getElementById(prefix + "-off-" + i)!.textContent = invigorationNames[response.offensiveUpgrades[i]] || response.offensiveUpgrades[i];
		document.getElementById(prefix + "-def-" + i)!.textContent = invigorationNames[response.defensiveUpgrades[i]] || response.defensiveUpgrades[i];
	}
}

function preFillForm(username: string, peek: boolean, suits: string[]): void
{
	const usernameInput = document.getElementById("username") as HTMLInputElement;
	const peekCheckbox = document.getElementById("peek") as HTMLInputElement;
	const suitSelects = document.querySelectorAll<HTMLSelectElement>(".suit-select");

	usernameInput.value = username;
	peekCheckbox.checked = peek;
	peekCheckbox.onchange!(new Event('change'));
	suits.forEach((suit, i) => suitSelects[i].value = suit);
}

function saveToCache(request: InvigorationRequest, response: InvigorationResponse): void
{
	const currentWeek = getWeekIndex(Date.now());
	const targetWeek = request.p ? currentWeek + 1 : currentWeek;

	const cache = loadCache();
	cache[targetWeek] = { request, response };

	const prunedCache = [currentWeek - 1, currentWeek, currentWeek + 1].reduce((acc: InvigorationCache, week) =>
	{
		if (cache[week]) acc[week] = cache[week];
		return acc;
	}, {});

	localStorage.setItem("invigorations.cache", JSON.stringify(prunedCache));
	if ((window as any).triggerCloudSync)
	{
		(window as any).triggerCloudSync();
	}
}

function showHistory(currentWeek: number, cache: InvigorationCache): void
{
	const currentData = cache[currentWeek];
	const lastWeekData = cache[currentWeek - 1];
	const nextWeekData = cache[currentWeek + 1];

	const historyDiv = document.getElementById("history")!;
	const thisWeekDiv = document.getElementById("history-this-week")!;
	const lastWeekDiv = document.getElementById("history-last-week")!;

	if (!currentData && !lastWeekData)
	{
		historyDiv.classList.add("d-none");
		return;
	}

	historyDiv.classList.remove("d-none");

	if (currentData)
	{
		// Prefer next week's request suits: they represent what the user confirmed as this week's offerings
		const thisWeekSuits = nextWeekData ? nextWeekData.request.s : undefined;
		populateInvigorationGrid("this-week", currentData.response, thisWeekSuits);
		thisWeekDiv.classList.remove("d-none");
	}
	else
	{
		thisWeekDiv.classList.add("d-none");
	}

	if (lastWeekData)
	{
		// Prefer current week's request suits: they represent what the user confirmed as last week's offerings
		const lastWeekSuits = currentData ? currentData.request.s : undefined;
		populateInvigorationGrid("last-week", lastWeekData.response, lastWeekSuits);
		lastWeekDiv.classList.remove("d-none");
	}
	else
	{
		lastWeekDiv.classList.add("d-none");
	}
}

function showResults(response: InvigorationResponse, request: InvigorationRequest): void
{
	const resultsDiv = document.getElementById("results")!;
	resultsDiv.classList.remove("d-none");

	// Update heading
	(document.querySelector("#results h4") as HTMLElement).textContent = request.p ? "Next Week's Offerings" : "Current Offerings";

	// Update explainer text
	document.querySelectorAll(".explainer").forEach(x => { x.classList.add("d-none") });
	if (request.s.length != response.suits.length)
	{
		document.querySelector("#explain-noprev")!.classList.remove("d-none");
	}
	else if (!request.p)
	{
		document.querySelector("#explain-current")!.classList.remove("d-none");
	}
	else
	{
		document.querySelector("#explain-peek")!.classList.remove("d-none");
	}
	document.querySelectorAll("#results b").forEach(x => { x.textContent = request.n });
	populateInvigorationGrid("out", response);
}

// Expose globally for use by the non-module inline script
(window as any).getWeekIndex = getWeekIndex;
(window as any).loadCache = loadCache;
(window as any).populateInvigorationGrid = populateInvigorationGrid;
(window as any).preFillForm = preFillForm;
(window as any).saveToCache = saveToCache;
(window as any).showHistory = showHistory;
(window as any).showResults = showResults;
