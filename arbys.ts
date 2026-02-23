import type { IFaction, IRegion, TFaction } from "warframe-public-export-plus";

// common.js
declare let onLanguageUpdate: () => void;
declare function getDictPromise(): Promise<Record<string, string>>;
declare function toTitleCase(str: string): string;

// arbyTiers.js
declare const arbyTiers: Record<string, string>;

// arbys-timer.js
declare function createArbyCountdownBadge(timestamp: number): HTMLSpanElement;
declare function initializeArbyTimer(): void;

// fetch
declare let dict: Record<string, string>;
declare let ExportFactions: Record<TFaction, IFaction>;
declare let ExportRegions: Record<string, IRegion>;
declare let arbys: [number, string][];

// state
declare let currentHour: number;

const days = [ "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" ];
const months = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];

function loc(key: string): string
{
	return dict[key] ?? key;
}

function totwo(num: number): string
{
	if (num < 10)
	{
		return "0" + num;
	}
	return num.toString();
}

function formattz(offset: number): string
{
	if (offset == 0)
	{
		return "UTC+0";
	}
	offset /= 60;
	if (offset < 0)
	{
		return "UTC+" + (offset * -1);
	}
	return "UTC-" + offset;
}
document.getElementById("local-time-option").textContent += " (" + formattz(new Date().getTimezoneOffset()) + ")";

function formathour(hour: number): string
{
	switch ((document.getElementById("select-hourfmt") as HTMLSelectElement).value)
	{
	case "mil": default: // This is the default because it indicates when zulu time is used, making it easier to parse screenshots of the schedule.
		return totwo(hour) + "00" + ((document.getElementById("select-tz") as HTMLSelectElement).value == "zulu" ? "Z" : "");

	case "24":
		return totwo(hour) + ":00";

	case "12":
		return ((hour % 12) == 0 ? "12" : (hour % 12)) + (hour >= 12 ? "pm" : "am");
	}
}

// Wait for cloud sync to emit one of its events (or timeout)
const cloudSyncEvent = new Promise<string>(resolve => {
	window.addEventListener('cloud-sync-complete', () => resolve('complete'), { once: true });
	window.addEventListener('cloud-sync-unavailable', () => resolve('unavailable'), { once: true });
	window.addEventListener('cloud-sync-unauthenticated', () => resolve('unauthenticated'), { once: true });
	window.addEventListener('cloud-sync-error', () => resolve('error'), { once: true });
	setTimeout(() => resolve('timeout'), 3000);
});

// After cloud sync completes, check if saved settings exist and enable Load button if so
cloudSyncEvent.then(() => {
	checkLoadButtonState();
});

const params = new URLSearchParams(location.hash.replace("#", ""));
if (params.has("days"))
{
	(document.getElementById("select-days") as HTMLSelectElement).value = params.get("days");
}
else if ("userAgentData" in navigator && (navigator.userAgentData as { mobile?: boolean }).mobile)
{
	(document.getElementById("select-days") as HTMLSelectElement).value = "1";
}
if (params.has("tz"))
{
	(document.getElementById("select-tz") as HTMLSelectElement).value = params.get("tz");
}
if (params.has("hourfmt"))
{
	(document.getElementById("select-hourfmt") as HTMLSelectElement).value = params.get("hourfmt");
}
if (params.has("exclude"))
{
	params.get("exclude").split(".").forEach(opt =>
	{
		const checkbox = document.getElementById("filter-" + opt) as HTMLInputElement | null;
		if (checkbox)
		{
			checkbox.checked = false;
		}
	});
}

Promise.all([
	getDictPromise(),
	fetch("warframe-public-export-plus/ExportFactions.json").then(res => res.json()),
	fetch("warframe-public-export-plus/ExportRegions.json").then(res => res.json()),
	fetch("arbys.txt").then(res => res.text())
]).then(([ dict, ExportFactions, ExportRegions, arbys ]) => {
	(window as any).dict = dict;
	(window as any).ExportFactions = ExportFactions;
	(window as any).ExportRegions = ExportRegions;
	(window as any).arbys = arbys.split("\n").map(line => line.split(",")).filter(arr => arr.length == 2).map(arr => [ parseInt(arr[0]), arr[1] ]);
	onLanguageUpdate = function()
	{
		updateLog();
		updateFilterNamesForLocale();
	};
	onLanguageUpdate();
	// Initialize timer for countdown badges (minimal change to upstream)
	initializeArbyTimer();
});

function updateFilterNamesForLocale(): void
{
	document.querySelector("label[for=filter-MT_SURVIVAL]").textContent = toTitleCase(dict["/Lotus/Language/Missions/MissionName_Survival"]);
	document.querySelector("label[for=filter-MT_DEFENSE]").textContent = toTitleCase(dict["/Lotus/Language/Missions/MissionName_Defense"]);
	document.querySelector("label[for=filter-MT_TERRITORY]").textContent = toTitleCase(dict["/Lotus/Language/Missions/MissionName_Territory"]);
	document.querySelector("label[for=filter-MT_EXCAVATE]").textContent = toTitleCase(dict["/Lotus/Language/Missions/MissionName_Excavation"]);
	document.querySelector("label[for=filter-MT_PURIFY]").textContent = toTitleCase(dict["/Lotus/Language/Missions/MissionName_Purify"]);
	document.querySelector("label[for=filter-MT_EVACUATION]").textContent = toTitleCase(dict["/Lotus/Language/Missions/MissionName_Evacuation"]);
	document.querySelector("label[for=filter-MT_ARTIFACT]").textContent = toTitleCase(dict["/Lotus/Language/Missions/MissionName_Artifact"]);
	document.querySelector("label[for=filter-MT_CORRUPTION]").textContent = toTitleCase(dict["/Lotus/Language/Missions/MissionName_Corruption"]);
	document.querySelector("label[for=filter-MT_VOID_CASCADE]").textContent = toTitleCase(dict["/Lotus/Language/Missions/MissionName_VoidCascade"]);
	document.querySelector("label[for=filter-MT_ARMAGEDDON]").textContent = toTitleCase(dict["/Lotus/Language/Missions/MissionName_Armageddon"]);
	document.querySelector("label[for=filter-MT_ALCHEMY]").textContent = toTitleCase(dict["/Lotus/Language/Missions/MissionName_Alchemy"]);

	document.querySelector("label[for=filter-FC_GRINEER]").textContent = dict["/Lotus/Language/Game/Faction_GrineerUC"];
	document.querySelector("label[for=filter-FC_CORPUS]").textContent = dict["/Lotus/Language/Game/Faction_CorpusUC"];
	document.querySelector("label[for=filter-FC_INFESTATION]").textContent = dict["/Lotus/Language/Game/Faction_InfestationUC"];
	document.querySelector("label[for=filter-FC_OROKIN]").textContent = dict["/Lotus/Language/Game/Faction_OrokinUC"];
	document.querySelector("label[for=filter-FC_MITW]").textContent = dict["/Lotus/Language/Game/Faction_MITW"];
}

function updateLog(): void
{
	console.time("updateLog");

	const zulu = ((document.getElementById("select-tz") as HTMLSelectElement).value == "zulu");

	currentHour = Math.trunc(Date.now() / 3600000) * 3600;

	const epochHour = arbys[0][0];
	const currentHourIndex = (currentHour - epochHour) / 3600;

	// Update log
	const currentYear = zulu ? new Date().getUTCFullYear() : new Date().getFullYear();
	let remainingArbys = parseInt((document.getElementById("select-days") as HTMLSelectElement).value) * 24;
	let lastArbyDay = -1;
	document.getElementById("log").innerHTML = "";
	for (let i = currentHourIndex; i != arbys.length && remainingArbys-- > 0; ++i)
	{
		const arr = arbys[i];

		const thisArbyGrade = (arbyTiers[arr[1]] ?? "F");
		if (!(document.getElementById("filter-tier-" + thisArbyGrade) as HTMLInputElement).checked)
		{
			continue;
		}

		const node = ExportRegions[arr[1]];
		if (!(document.getElementById("filter-" + node.missionType) as HTMLInputElement).checked
			|| !(document.getElementById("filter-" + node.faction) as HTMLInputElement).checked
			)
		{
			continue;
		}

		// Check tileset filter
		const nodeTileset = (window as any).getTileset(node, arr[1]);
		if (nodeTileset) {
			const tilesetCheckbox = document.getElementById(`filter-${nodeTileset}`) as HTMLInputElement | null;
			if (tilesetCheckbox && !tilesetCheckbox.checked) {
				continue;
			}
		}

		const date = new Date(arr[0] * 1000);
		const thisArbyHour = zulu ? date.getUTCHours() : date.getHours();
		const thisArbyDay = zulu ? date.getUTCDate() : date.getDate();

		if (thisArbyDay != lastArbyDay)
		{
			lastArbyDay = thisArbyDay;
			const thisArbyWeekDay = zulu ? date.getUTCDay() : date.getDay();
			const thisArbyMonth = zulu ? date.getUTCMonth() : date.getMonth();
			const thisArbyYear = zulu ? date.getUTCFullYear() : date.getFullYear();
			let h3 = document.createElement("h3");
			h3.textContent = days[thisArbyWeekDay] + ", " + months[thisArbyMonth] + " " + thisArbyDay;
			if (thisArbyYear != currentYear)
			{
				h3.textContent += ", " + thisArbyYear;
			}
			document.getElementById("log").appendChild(h3);
		}

		let span = document.createElement(arr[0] == currentHour ? "b" : "span");
		span.setAttribute("data-timestamp", arr[0].toString());
		span.textContent = formathour(thisArbyHour) + " • " + toTitleCase(loc(node.missionName)) + " - " + dict[ExportFactions[node.faction].name] + " @ " + loc(node.name) + ", " + loc(node.systemName) + " (" + thisArbyGrade + " tier";
		if ("darkSectorData" in node)
		{
			span.textContent += ", " + (node.darkSectorData.resourceBonus * 100).toFixed(0) + "% resource bonus";
		}
		const formattedTileset = (window as any).formatTileset(nodeTileset);
		if (formattedTileset)
		{
			span.textContent += `, ${formattedTileset}`;
		}
		span.textContent += ")";
		document.getElementById("log").appendChild(span);

		span.prepend(createArbyCountdownBadge(arr[0]));
	}
	if (document.getElementById("log").children.length == 0)
	{
		let span = document.createElement("span");
		span.textContent = "I've looked through " + (arbys.length - currentHourIndex) + " arbitrations but not a one matches your filters. :/";
		document.getElementById("log").appendChild(span);
	}

	// Update table (skip category heading rows)
	document.querySelectorAll("table tbody tr:not(.category-heading)").forEach(tr => {
		tr.setAttribute("data-starved", "true");
		tr.children[1].innerHTML = "N/A";
		tr.children[2].innerHTML = "N/A";
	});
	for (let i = currentHourIndex; i != arbys.length && document.querySelector("[data-starved]"); ++i)
	{
		const arr = arbys[i];

		const date = new Date(arr[0] * 1000);
		const node = ExportRegions[arr[1]];

		const thisArbyHour = zulu ? date.getUTCHours() : date.getHours();
		const thisArbyDay = zulu ? date.getUTCDate() : date.getDate();
		const thisArbyWeekDay = zulu ? date.getUTCDay() : date.getDay();
		const thisArbyMonth = zulu ? date.getUTCMonth() : date.getMonth();

		const thisArbyGrade = (arbyTiers[arr[1]] ?? "F");

		{
			const tr = document.getElementById("next-tier-" + thisArbyGrade);
			if (tr.children[1].innerHTML == "N/A")
			{
				tr.removeAttribute("data-starved");
				tr.children[1].setAttribute("data-timestamp", arr[0].toString());
				tr.children[1].textContent = days[thisArbyWeekDay] + ", " + months[thisArbyMonth] + " " + thisArbyDay + ", " + formathour(thisArbyHour);
				tr.children[2].textContent = toTitleCase(loc(node.missionName)) + " - " + dict[ExportFactions[node.faction].name] + " @ " + loc(node.name) + ", " + loc(node.systemName);
				if ("darkSectorData" in node)
				{
					tr.children[2].textContent += " (" + (node.darkSectorData.resourceBonus * 100).toFixed(0) + "% resource bonus)";
				}
			}
		}
		{
			const tr = document.getElementById("next-" + node.missionType);
			if (tr.children[1].innerHTML == "N/A")
			{
				tr.removeAttribute("data-starved");
				tr.children[1].setAttribute("data-timestamp", arr[0].toString());
				tr.children[1].textContent = days[thisArbyWeekDay] + ", " + months[thisArbyMonth] + " " + thisArbyDay + ", " + formathour(thisArbyHour);
				tr.children[2].textContent = dict[ExportFactions[node.faction].name] + " @ " + loc(node.name) + ", " + loc(node.systemName);
				if ("darkSectorData" in node)
				{
					tr.children[2].textContent += " (" + (node.darkSectorData.resourceBonus * 100).toFixed(0) + "% resource bonus)";
				}
			}
		}
		{
			const tr = document.getElementById("next-" + node.faction);
			if (tr.children[1].innerHTML == "N/A")
			{
				tr.removeAttribute("data-starved");
				tr.children[1].setAttribute("data-timestamp", arr[0].toString());
				tr.children[1].textContent = days[thisArbyWeekDay] + ", " + months[thisArbyMonth] + " " + thisArbyDay + ", " + formathour(thisArbyHour);
				tr.children[2].textContent = toTitleCase(loc(node.missionName)) + " - " + loc(node.name) + ", " + loc(node.systemName);
				if ("darkSectorData" in node)
				{
					tr.children[2].textContent += " (" + (node.darkSectorData.resourceBonus * 100).toFixed(0) + "% resource bonus)";
				}
			}
		}
		{
			const nodeTileset = (window as any).getTileset(node, arr[1]);
			if (nodeTileset) {
				const tr = document.getElementById(`next-${nodeTileset}`);
				if (tr.children[1].innerHTML == "N/A") {
					tr.removeAttribute("data-starved");
					tr.children[1].setAttribute("data-timestamp", arr[0].toString());
					tr.children[1].textContent = `${days[thisArbyWeekDay]}, ${months[thisArbyMonth]} ${thisArbyDay}, ${formathour(thisArbyHour)}`;
					tr.children[2].textContent = `${toTitleCase(loc(node.missionName))} - ${dict[ExportFactions[node.faction].name]} @ ${loc(node.name)}, ${loc(node.systemName)}`;
					if ("darkSectorData" in node)
					{
						tr.children[2].textContent += ` (${(node.darkSectorData.resourceBonus * 100).toFixed(0)}% resource bonus)`;
					}
				}
			}
		}
	}

	// Ensure data stays up-to-date
	if (!("updater" in window))
	{
		(window as any).updater = setInterval(function()
		{
			if (currentHour != (Math.trunc((Date.now() / 1000) / 3600) * 3600))
			{
				updateLog();
			}
		}, 1000);
	}

	console.timeEnd("updateLog");
}

function saveSettings(): void
{
	let hash = "days=" + encodeURIComponent((document.getElementById("select-days") as HTMLSelectElement).value)
			+ "&tz=" + encodeURIComponent((document.getElementById("select-tz") as HTMLSelectElement).value)
			+ "&hourfmt=" + encodeURIComponent((document.getElementById("select-hourfmt") as HTMLSelectElement).value)
			;

	const filtered_away = [];
	document.querySelectorAll<HTMLInputElement>("input[type=checkbox]").forEach(elm =>
	{
		if (!elm.checked)
		{
			filtered_away.push(elm.id.substring(7)); // "filter-"
		}
	});
	if (filtered_away.length != 0)
	{
		hash += "&exclude=" + encodeURIComponent(filtered_away.join("."));
	}

	location.hash = hash;
}

function saveToLocalStorage(): void
{
	const settings: any = {
		select_days: (document.getElementById("select-days") as HTMLSelectElement).value,
		select_tz: (document.getElementById("select-tz") as HTMLSelectElement).value,
		select_hourfmt: (document.getElementById("select-hourfmt") as HTMLSelectElement).value,
		filters: {}
	};

	// Save all filter checkbox states
	document.querySelectorAll<HTMLInputElement>('input[type=checkbox][id^="filter-"]').forEach(checkbox => {
		const filterId = checkbox.id.substring(7); // Remove "filter-" prefix
		settings.filters[filterId] = checkbox.checked;
	});

	localStorage.setItem("arbys.settings", JSON.stringify(settings));
}

function loadFromLocalStorage(): void
{
	const settingsJson = localStorage.getItem("arbys.settings");
	if (!settingsJson) return;

	try {
		const settings = JSON.parse(settingsJson);

		// Restore dropdown values
		if (settings.select_days) {
			(document.getElementById("select-days") as HTMLSelectElement).value = settings.select_days;
		}
		if (settings.select_tz) {
			(document.getElementById("select-tz") as HTMLSelectElement).value = settings.select_tz;
		}
		if (settings.select_hourfmt) {
			(document.getElementById("select-hourfmt") as HTMLSelectElement).value = settings.select_hourfmt;
		}

		// Restore checkbox states
		if (settings.filters) {
			for (const [filterId, checked] of Object.entries(settings.filters)) {
				const checkbox = document.getElementById(`filter-${filterId}`) as HTMLInputElement | null;
				if (checkbox) {
					checkbox.checked = checked as boolean;
				}
			}
		}
	} catch (e) {
		console.error("Failed to parse saved settings:", e);
	}
}

function checkLoadButtonState(): void
{
	const btnLoad = document.getElementById("btn-load-settings") as HTMLButtonElement | null;
	if (!btnLoad) return;

	let shouldDisable = true;
	const settingsJson = localStorage.getItem("arbys.settings");
	if (settingsJson) {
		try {
			JSON.parse(settingsJson); // Validate it's valid JSON
			shouldDisable = false;
		} catch {
		}
	}

	btnLoad.disabled = shouldDisable
}

// Expose checkLoadButtonState globally for cloud sync to call
(window as any).checkLoadButtonState = checkLoadButtonState;

// Save button handler
document.getElementById("btn-save-settings")?.addEventListener("click", function() {
	const btn = this as HTMLButtonElement;
	const originalText = btn.textContent;
	btn.disabled = true;
	btn.textContent = "Saving...";

	try {
		// Save to localStorage
		saveToLocalStorage();

		// Trigger cloud sync if available
		if ((window as any).triggerCloudSync) {
			(window as any).triggerCloudSync();
		}

		btn.textContent = "Saved!";

		// Enable Load button since settings now exist
		checkLoadButtonState();

		setTimeout(() => {
			btn.textContent = originalText;
			btn.disabled = false;
		}, 3000);
	} catch (error) {
		console.error("Failed to save settings:", error);
		btn.textContent = "Error";
		setTimeout(() => {
			btn.textContent = originalText;
			btn.disabled = false;
		}, 3000);
	}
});

// Load button handler
document.getElementById("btn-load-settings")?.addEventListener("click", function() {
	const btn = this as HTMLButtonElement;
	const originalText = btn.textContent;
	btn.disabled = true;
	btn.textContent = "Loading...";

	try {
		// Load from localStorage
		loadFromLocalStorage();

		// Update display
		if ("arbys" in window) {
			updateLog();
		}

		// Update URL hash to match loaded settings
		saveSettings();

		btn.textContent = "Loaded!";
		setTimeout(() => {
			btn.textContent = originalText;
			btn.disabled = false;
		}, 3000);
	} catch (error) {
		console.error("Failed to load settings:", error);
		btn.textContent = "Error";
		setTimeout(() => {
			btn.textContent = originalText;
			btn.disabled = false;
		}, 3000);
	}
});

document.querySelectorAll<HTMLSelectElement | HTMLInputElement>("select, input[type=checkbox]").forEach(elm =>
{
	elm.onchange = function()
	{
		if ("arbys" in window)
		{
			updateLog();
		}
		saveSettings();
	};
});
