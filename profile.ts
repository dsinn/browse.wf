import type { IAchievement, IColour, ICustom, IExportEnemies, IExportNightwave, IFaction, IFlavourItem, IPowersuit, IRegion, ISentinel, ISyndicate, IWeapon, TFaction } from "warframe-public-export-plus";

// PlutoScript
declare const pluto_require: (file: string) => Promise<void>;
declare function pluto_invoke(name: string, ...args: any[]): Promise<any>;

// common.js
declare let onLanguageUpdate: () => void;
declare function getDictPromise(): Promise<Record<string, string>>;
declare function toTitleCase(str: string): string;
declare function setImageSource(img: HTMLImageElement, icon: string): void;
declare function initStatsFilterBar(filterBar: HTMLElement, tbody: HTMLElement, entries: Array<{ key: string; label: string; icon: string }>, presentKeys: Set<string>, onFilter?: () => void): void;

// fetch
declare let dict: Record<string, string>;
declare let ExportAchievements: Record<string, IAchievement>;
declare let ExportCustoms: Record<string, ICustom>;
declare let ExportEnemies: IExportEnemies;
declare let ExportFactions: Record<TFaction, IFaction>;
declare let ExportFlavour: Record<string, IFlavourItem>;
declare let ExportNightwave: IExportNightwave;
declare let ExportRegions: Record<string, IRegion>;
declare let ExportSentinels: Record<string, ISentinel>;
declare let ExportSyndicates: Record<string, ISyndicate>;
declare let ExportWarframes: Record<string, IPowersuit>;
declare let ExportWeapons: Record<string, IWeapon>;

// state
declare let profile: any;

const platform_suffix_pluto_promise = pluto_require("platform-suffix.pluto");

/*document.getElementById("username").onfocus = function()
{
	this.select();
};*/

// Keep in sync with VALID_PLAYER_ID_REGEX in warframe-api-front-proxy/profile.js
const VALID_PLAYER_ID_REGEX = /^[0-9a-f]{24}$/;

const guideTiers = [0, "Junior Guide of the Lotus", "Senior Guide of the Lotus"];
const founderTiers = [0, "Disciple", "Hunter", "Master", "Grand Master"];
const clanTiers = [0, "Ghost", "Shadow", "Storm", "Mountain", "Moon"];
const syndicateTags = [
	"ArbitersSyndicate",
	"CephalonSudaSyndicate",
	"PerrinSyndicate",
	"NewLokaSyndicate",
	"RedVeilSyndicate",
	"SteelMeridianSyndicate",

	"CetusSyndicate",
	"QuillsSyndicate",

	"SolarisSyndicate",
	"VentKidsSyndicate",
	"VoxSyndicate",

	"ZarimanSyndicate",

	"EntratiSyndicate",
	"NecraloidSyndicate",
	"EntratiLabSyndicate",
	"HexSyndicate",

	"KahlSyndicate",
	"NIGHTWAVE",
	"LibrarySyndicate",
	"ConclaveSyndicate",
	"EventSyndicate",
];
const vallisRaceNames = [0, "Puffin’ Pastures", "Bomb the Spaceport", "Shaving Nef", "Anyo’s Ointment", "Grinding the Void", "Fortuna’s Folley", "Taxman’s Curve", "Kubrodon Twist", "Mumsie Dadsie", "Catalyst", "Skeggin’ Out", "Deathgrip", "Dog Line", "River Run", "The Hard Way", "Sky-Eye", "Pobber’s Drop", "Lord of the Board", "Breakdown Or Bust", "Frost Merchant", "Roky’s Roll", "Meat and Greet"];
const platformNames = {
	"pc": "PC",
	"ps4": "PlayStation",
	"xb1": "Xbox",
	"swi": "Switch",
	"mob": "iOS",
	"and": "Android",
};

function peColourToHex(colour: IColour): string
{
	return "#" + colour.value.substring(4);
}

function peColourToRgb(colour: IColour): [number, number, number]
{
	return [
		parseInt(colour.value.substring(4, 6), 16),
		parseInt(colour.value.substring(6, 8), 16),
		parseInt(colour.value.substring(8, 10), 16)
	];
}

function parseRgbaInt(val: number): [number, number, number, number]
{
	return [
		(val >> 16) & 0xff,
		(val >> 8) & 0xff,
		val & 0xff,
		(val >> 24) & 0xff
	];
}

function toHexString(r: number, g: number, b: number): string
{
	return "#" + (r.toString(16).padStart(2, "0") + g.toString(16).padStart(2, "0") + b.toString(16).padStart(2, "0")).toUpperCase();
}

function makeColourFilter(colour: IColour): string
{
	const [red, green, blue] = peColourToRgb(colour);
	const svg = `<svg xmlns="http://www.w3.org/2000/svg"><filter id="a"><feColorMatrix color-interpolation-filters="sRGB" in="SourceGraphic" type="matrix" values="${red / 255} 0 0 0 0 0 ${green / 255} 0 0 0 0 0 ${blue / 255} 0 0 0 0 0 1 0" /></filter></svg>`;
	return "url('data:image/svg+xml," + svg + "#a')";
}

function makeSyndicateLogoElement(syndicate: ISyndicate): HTMLDivElement
{
	const div = document.createElement("div");
	div.style.backgroundColor /* [sic] */ = peColourToHex(syndicate.backgroundColour);
	{
		const img = document.createElement("img");
		img.src = "https://browse.wf" + syndicate.icon;
		img.style.filter = makeColourFilter(syndicate.colour);
		div.appendChild(img);
	}
	return div;
}

const params = new URLSearchParams(location.hash.replace("#", ""));

const platformSelect: HTMLSelectElement = document.getElementById("platform-select") as HTMLSelectElement;
const platformStorageKey = "profile.platform";
const accountIdStorageKey = "profile.accountId";
const profileDataStorageKey = "profile.data";
const profileTimestampStorageKey = "profile.dataFetchedAt";
const nextFetchAvailableAtStorageKey = "profile.nextFetchAvailableAt";

let currentAccountId = "";

// Wait for cloud sync to emit one of its events (or timeout)
const cloudSyncEvent = new Promise<string>(resolve => {
	window.addEventListener('cloud-sync-complete', () => resolve('complete'), { once: true });
	window.addEventListener('cloud-sync-unavailable', () => resolve('unavailable'), { once: true });
	window.addEventListener('cloud-sync-unauthenticated', () => resolve('unauthenticated'), { once: true });
	window.addEventListener('cloud-sync-error', () => resolve('error'), { once: true });
	setTimeout(() => resolve('timeout'), 3000);
});

// Get initial profile (from localStorage or fallback)
const initialProfilePromise = cloudSyncEvent.then(() => {
	const profileJson = localStorage.getItem(profileDataStorageKey);
	if (profileJson) {
		return JSON.parse(profileJson);
	}
	return fetch("supplemental-data/profile-[DE]Rebecca.json").then(res => res.json());
});

Promise.all([
	getDictPromise(),
	fetch("warframe-public-export-plus/ExportAchievements.json").then(res => res.json()),
	fetch("warframe-public-export-plus/ExportCustoms.json").then(res => res.json()),
	fetch("warframe-public-export-plus/ExportEnemies.json").then(res => res.json()),
	fetch("warframe-public-export-plus/ExportFactions.json").then(res => res.json()),
	fetch("warframe-public-export-plus/ExportFlavour.json").then(res => res.json()),
	fetch("warframe-public-export-plus/ExportImages.json").then(res => res.json()),
	fetch("warframe-public-export-plus/ExportNightwave.json").then(res => res.json()),
	fetch("warframe-public-export-plus/ExportRegions.json").then(res => res.json()),
	fetch("warframe-public-export-plus/ExportSentinels.json").then(res => res.json()),
	fetch("warframe-public-export-plus/ExportSyndicates.json").then(res => res.json()),
	fetch("warframe-public-export-plus/ExportWarframes.json").then(res => res.json()),
	fetch("warframe-public-export-plus/ExportWeapons.json").then(res => res.json()),
	cloudSyncEvent, // Wait for cloud sync event before proceeding
	initialProfilePromise
	]).then(([
		dict,
		ExportAchievements,
		ExportCustoms,
		ExportEnemies,
		ExportFactions,
		ExportFlavour,
		ExportImages,
		ExportNightwave,
		ExportRegions,
		ExportSentinels,
		ExportSyndicates,
		ExportWarframes,
		ExportWeapons,
		syncResult,
		initialProfile
	]) =>
{
	const useAutoFetch = syncResult === 'complete';
	const storedNextFetch = parseInt(localStorage.getItem(nextFetchAvailableAtStorageKey) ?? "0");
	const msUntilAvailable = storedNextFetch - Date.now();
	const isRateLimited = useAutoFetch && msUntilAvailable > 0;
	const showAutoFetchFlow = useAutoFetch && !isRateLimited;

	// Show manual flow steps via CSS when not in auto-fetch flow
	document.getElementById("steps")?.classList.toggle("manual-flow", !showAutoFetchFlow);

	if (isRateLimited) {
		showRateLimitNotice(storedNextFetch);
	}

	(window as any).dict = dict;
	(window as any).ExportAchievements = ExportAchievements;
	(window as any).ExportCustoms = ExportCustoms;
	(window as any).ExportEnemies = ExportEnemies;
	(window as any).ExportFactions = ExportFactions;
	(window as any).ExportFlavour = ExportFlavour;
	(window as any).ExportImages = ExportImages;
	(window as any).ExportRegions = ExportRegions;
	(window as any).ExportSentinels = ExportSentinels;
	(window as any).ExportSyndicates = ExportSyndicates;
	(window as any).ExportWarframes = ExportWarframes;
	(window as any).ExportWeapons = ExportWeapons;
	(window as any).profile = initialProfile;
	(window as any).__showAutoFetchFlow = showAutoFetchFlow;

	for (let i = 0; i != syndicateTags.length; ++i)
	{
		if (syndicateTags[i] == "NIGHTWAVE")
		{
			syndicateTags[i] = ExportNightwave.affiliationTag;
		}
	}

	document.getElementById("profile-nav").classList.remove("d-none");
	activateTab(params.has("tab") ? params.get("tab") : "fashion"); // default tab

	renderProfile();
	profileLoadedManually = false;
	onLanguageUpdate = function()
	{
		renderProfile();
	};

	updateFormFromLocalStorage();
	refreshAllStepIndicators();

	// Trigger validation/updates in case browser autofilled or localStorage restored values
	if (platformSelect.value) {
		onPlatformChange();
	}
});

function isXplatName(name: string): boolean
{
	return name.charCodeAt(name.length - 1) >= 0xE000;
}

function xplatNameToPlatformId(name: string): number
{
	return name.charCodeAt(name.length - 1) - 0xE000;
}

function sanitiseName(name: string): string
{
	if (name.charCodeAt(name.length - 1) >= 0xE000)
	{
		name = name.substring(0, name.length - 1);
	}
	return name;
}

let profileLoadedManually = false;

function updateStepStatus(selector: string, completed: boolean): void
{
	document.querySelector(selector)?.classList.toggle("complete", completed);
}

function refreshAllStepIndicators(): void
{
	updateStepStatus("#step1-container", !!platformSelect.value);
	// Step 2 (account ID) and beyond are updated by their respective handlers
}

function copyWarframePath(event: Event): void
{
	navigator.clipboard.writeText("%localappdata%\\Warframe\\").then(() => {
		const button = event.target as HTMLButtonElement;
		const originalText = button.textContent;
		button.textContent = "Copied!";
		setTimeout(() => { button.textContent = originalText; }, 5000);
	}).catch(err => {
		console.error("Failed to copy:", err);
		alert("Failed to copy to clipboard");
	});
}

function onPlatformChange(): void
{
	profileLoadedManually = false;

	const platform = platformSelect.value;

	updateStepStatus("#step1-container", !!platform);
}

function validateAccountId(accountId: string): boolean
{
	return VALID_PLAYER_ID_REGEX.test(accountId);
}

function loadEELog(file?: File): void
{
	if (!file) {
		return;
	}

	// User is interacting with form - restore indicators
	profileLoadedManually = false;

	document.querySelector("#status span").textContent = "Parsing EE.log...";
	document.querySelector("#status").classList.remove("d-none");

	const reader = new FileReader();
	reader.onload = function(e)
	{
		try
		{
			const content = e.target.result as string;

			// Extract account ID from EE.log
			const logPattern = /(?:Logged|Player).*\b([0-9a-f]{24})\b/;
			const match = content.match(logPattern);

			if (match) {
				const accountId = match[1];

				currentAccountId = accountId;
				localStorage.setItem(accountIdStorageKey, accountId);
				updateRefreshAlert();

				if ((window as any).__showAutoFetchFlow) {
					// Auto-fetch profile via proxy (logged in, not rate-limited)
					fetchAndRenderProfile(platformSelect.value, accountId, true);
				} else {
					// Manual flow: populate account ID field and mark step 2 done
					const accountIdInput = document.getElementById("account-id") as HTMLInputElement | null;
					if (accountIdInput) {
						accountIdInput.value = accountId;
					}
					updateStepStatus("#step2-container", true);
					updateDownloadLink();
					document.querySelector("#status").classList.add("d-none");
				}
			} else {
				alert("Could not find account ID in EE.log. Make sure you've logged in and the file contains a \"Logged in\" line.");
				document.querySelector("#status").classList.add("d-none");
			}
		}
		catch (err)
		{
			console.error(err);
			alert("Failed to parse EE.log file: " + err.message);
			document.querySelector("#status").classList.add("d-none");
		}
	};
	reader.readAsText(file);
}


function updateRefreshAlert(): void
{
	const refreshAlert = document.getElementById("refresh-alert");
	if (refreshAlert) {
		refreshAlert.classList.toggle("d-none", !currentAccountId);
	}
}

function showRateLimitNotice(epochMs: number): void
{
	const countdown = document.getElementById("rate-limit-countdown");
	if (countdown) {
		countdown.replaceChildren((window as any).createArbyCountdownBadge(Math.floor(epochMs / 1000)));
	}
	document.getElementById("rate-limit-notice")?.classList.remove("d-none");
}

function switchToManualFlow(message: string): void
{
	document.getElementById("steps")?.classList.add("manual-flow");
	updateDownloadLink();
	showStatusError(message);
}

function showStatusError(message: string): void
{
	document.querySelector("#status span").textContent = message;
	document.querySelector("#status").classList.remove("d-none");
	setTimeout(() => { document.querySelector("#status").classList.add("d-none"); }, 5000);
}

function fetchAndRenderProfile(platform: string, accountId: string, fromEELog: boolean): void
{
	document.querySelector("#status span").textContent = "Fetching profile...";
	document.querySelector("#status").classList.remove("d-none");

	const accountIdInput = document.getElementById("account-id") as HTMLInputElement | null;
	if (accountIdInput) {
		accountIdInput.value = accountId;
	}

	(window as any).WarframeApiFrontProxyClient.fetchProfile(platform, accountId).then(({ status, data, nextFetchAvailableAt }: { status: number; data: any; nextFetchAvailableAt: number | null }) =>
	{
		if (status === 429) {
			if (nextFetchAvailableAt) {
				localStorage.setItem(nextFetchAvailableAtStorageKey, nextFetchAvailableAt.toString());
				showRateLimitNotice(nextFetchAvailableAt);
			}
			updateStepStatus("#step2-container", true);
			updateDownloadLink();
			document.getElementById("steps")?.classList.add("manual-flow");
			document.querySelector("#status").classList.add("d-none");
			return;
		}
		if (status === 401) {
			switchToManualFlow("Sign-in session expired. Please log in again.");
			return;
		}
		if (!data) {
			showStatusError("Failed to fetch profile. Try downloading manually.");
			return;
		}

		if (nextFetchAvailableAt) {
			localStorage.setItem(nextFetchAvailableAtStorageKey, nextFetchAvailableAt.toString());
		}

		(window as any).profile = data;
		if (fromEELog) {
			document.getElementById("profile-nav").classList.remove("d-none");
			activateTab(params.has("tab") ? params.get("tab") : "fashion");
			if (!params.has("tab")) {
				location.hash = "tab=fashion";
			}
		}
		renderProfile();

		profileLoadedManually = true;
		updateStepStatus("#step2-container", true);
		updateDownloadLink();
		localStorage.setItem(platformStorageKey, platform);
		localStorage.setItem(accountIdStorageKey, accountId);
		localStorage.setItem(profileDataStorageKey, JSON.stringify(data));
		localStorage.setItem(profileTimestampStorageKey, Date.now().toString());
		updateProfileAge();

		if ((window as any).triggerCloudSync) {
			(window as any).triggerCloudSync();
		}

		document.getElementById("refresh-alert")?.classList.add("d-none");
		document.querySelector("#status").classList.add("d-none");
	}).catch((err: Error) =>
	{
		console.error(err);
		document.querySelector("#status span").textContent = "Failed to fetch profile. Try downloading manually.";
		setTimeout(() => { document.querySelector("#status").classList.add("d-none"); }, 5000);
	});
}

function updateDownloadLink(): void
{
	const platform = platformSelect.value;
	const accountId = (document.getElementById("account-id") as HTMLInputElement | null)?.value ?? "";
	const downloadLink = document.getElementById("download-link") as HTMLAnchorElement | null;
	if (downloadLink && platform && validateAccountId(accountId)) {
		const platformStr = platform === "pc" ? "" : `-${platform}`;
		downloadLink.href = `http://content${platformStr}.warframe.com/dynamic/getProfileViewingData.php?playerId=${encodeURIComponent(accountId)}`;
	}
}

function loadProfile(file?: File): void
{
	if (!file) { return; }

	const reader = new FileReader();
	reader.onload = function(e)
	{
		try
		{
			const data = JSON.parse(e.target.result as string);
			(window as any).profile = data;
			document.getElementById("profile-nav").classList.remove("d-none");
			activateTab(params.has("tab") ? params.get("tab") : "fashion");
			renderProfile();

			profileLoadedManually = true;
			updateStepStatus("#step4-container", true);
			localStorage.setItem(platformStorageKey, platformSelect.value);
			localStorage.setItem(profileDataStorageKey, JSON.stringify(data));
			localStorage.setItem(profileTimestampStorageKey, Date.now().toString());
			updateProfileAge();

			if ((window as any).triggerCloudSync) {
				(window as any).triggerCloudSync();
			}
		}
		catch (err: any)
		{
			console.error(err);
			alert("Failed to parse profile file: " + err.message);
		}
	};
	reader.readAsText(file);
}

let invalidCharsMinTimeElapsed = false;
let invalidCharsHideTimer: number | null = null;

function onAccountIdManualInput(): void
{
	const input = document.getElementById("account-id") as HTMLInputElement | null;
	if (!input) { return; }

	// Strip non-hex characters and lowercase, preserving cursor position
	const raw = input.value;
	const cleaned = raw.toLowerCase().replace(/[^0-9a-f]/g, "");
	const hadInvalidChars = cleaned.length !== raw.length;
	if (cleaned !== raw) {
		const selectionStart = input.selectionStart ?? cleaned.length;
		const removed = raw.length - cleaned.length;
		input.value = cleaned;
		input.setSelectionRange(Math.max(0, selectionStart - removed), Math.max(0, selectionStart - removed));
	}

	const notice = document.getElementById("account-id-invalid-chars");
	if (hadInvalidChars) {
		invalidCharsMinTimeElapsed = false;
		if (notice) {
			notice.classList.remove("d-none");
		}
		if (invalidCharsHideTimer !== null) {
			clearTimeout(invalidCharsHideTimer);
		}
		invalidCharsHideTimer = window.setTimeout(() => {
			invalidCharsMinTimeElapsed = true;
			invalidCharsHideTimer = null;
		}, 3000);
	} else if (invalidCharsMinTimeElapsed && notice) {
		notice.classList.add("d-none");
		invalidCharsMinTimeElapsed = false;
	}

	const accountId = cleaned.trim();
	const charCount = document.getElementById("account-id-char-count");
	if (charCount) {
		charCount.textContent = accountId.length.toString();
	}
	const feedback = document.getElementById("account-id-feedback");
	if (validateAccountId(accountId)) {
		input.classList.remove("is-invalid");
		input.classList.add("is-valid");
		if (feedback) {
			feedback.classList.remove("invalid-feedback");
			feedback.classList.add("valid-feedback");
		}
		currentAccountId = accountId;
		localStorage.setItem(accountIdStorageKey, accountId);
		updateStepStatus("#step2-container", true);
		updateDownloadLink();
	} else {
		input.classList.remove("is-valid");
		if (feedback) {
			feedback.classList.remove("valid-feedback");
			feedback.classList.add("invalid-feedback");
		}
		updateStepStatus("#step2-container", false);
		if (accountId.length === 0) {
			input.classList.remove("is-invalid");
		} else {
			input.classList.add("is-invalid");
		}
	}
}

function onDownloadLinkLeftClick(event: Event): void
{
	event.preventDefault();
	document.getElementById("download-warning")?.classList.remove("d-none");
}

function onDownloadLinkRightClick(_event: Event): void
{
	document.getElementById("step3-manual-container")?.classList.add("complete");
	document.getElementById("download-warning")?.classList.add("d-none");
}

function fetchProfile(): void
{
	fetchAndRenderProfile(platformSelect.value, currentAccountId, false);
}


function updateFormFromLocalStorage(): void
{
	const savedPlatform = localStorage.getItem(platformStorageKey);
	const savedAccountId = localStorage.getItem(accountIdStorageKey);

	if (savedPlatform) {
		platformSelect.value = savedPlatform;
	}

	if (savedAccountId && validateAccountId(savedAccountId)) {
		currentAccountId = savedAccountId;
		const accountIdInput = document.getElementById("account-id") as HTMLInputElement | null;
		if (accountIdInput) {
			accountIdInput.value = savedAccountId;
		}
		updateStepStatus("#step2-container", true);
		updateDownloadLink();
		updateRefreshAlert();
	}
}


// Expose functions globally for onclick handlers
(window as any).copyWarframePath = copyWarframePath;
(window as any).fetchProfile = fetchProfile;
(window as any).loadEELog = loadEELog;
(window as any).loadProfile = loadProfile;
(window as any).onAccountIdManualInput = onAccountIdManualInput;
(window as any).onDownloadLinkLeftClick = onDownloadLinkLeftClick;
(window as any).onDownloadLinkRightClick = onDownloadLinkRightClick;
(window as any).onPlatformChange = onPlatformChange;

let profileAgeUpdateTimer: number | null = null;

function updateProfileAge(): void
{
	const fetchedAt = localStorage.getItem(profileTimestampStorageKey);
	if (!fetchedAt) {
		return;
	}

	const fetchDate = new Date(parseInt(fetchedAt));
	const now = new Date();
	const diffMs = now.getTime() - fetchDate.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	let timeAgo = "";
	let nextUpdateMs = 0;

	if (diffMins < 1) {
		timeAgo = "just now";
		// Update when we reach 1 minute
		nextUpdateMs = 60000 - (diffMs % 60000);
	} else if (diffMins < 60) {
		timeAgo = `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
		// Update at the top of the next minute
		nextUpdateMs = 60000 - (diffMs % 60000);
	} else if (diffHours < 24) {
		timeAgo = `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
		// Update at the top of the next hour
		nextUpdateMs = 3600000 - (diffMs % 3600000);
	} else {
		timeAgo = `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
		// Update at the top of the next day
		nextUpdateMs = 86400000 - (diffMs % 86400000);
	}

	// Format absolute timestamp for tooltip
	const absoluteTime = fetchDate.toLocaleString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});

	const timeSpan = document.querySelector("#profile-fetched span") as HTMLSpanElement;
	if (timeSpan) {
		timeSpan.textContent = timeAgo;
		timeSpan.title = absoluteTime;
		timeSpan.style.cursor = "help";
		timeSpan.style.textDecoration = "underline dotted";
	}
	document.querySelector("#profile-fetched")?.classList.remove("d-none");

	// Clear any existing timer
	if (profileAgeUpdateTimer !== null) {
		clearTimeout(profileAgeUpdateTimer);
	}

	// Schedule next update
	profileAgeUpdateTimer = window.setTimeout(() => {
		updateProfileAge();
	}, nextUpdateMs);
}

let equipmentRankObserver: MutationObserver | undefined;
let enemyRankObserver: MutationObserver | undefined;

function renderProfile(): void
{
	document.querySelector("#status").classList.add("d-none");

	const sanitisedName = sanitiseName(profile.Results[0].DisplayName);
	document.getElementById("profile-name").textContent = sanitisedName;
	document.getElementById("profile-discriminator").textContent = "";
	if (isXplatName(profile.Results[0].DisplayName))
	{
		platform_suffix_pluto_promise.then(() => {
			pluto_invoke("get_discriminator", sanitisedName, xplatNameToPlatformId(profile.Results[0].DisplayName)).then(discriminator => {
				document.getElementById("profile-discriminator").textContent = "#" + discriminator.toString().padStart(3, "0");
			});
		});
	}

	const createdAt = parseInt(profile.Results[0].AccountId.$oid.substr(0, 8), 16);
	document.querySelector("#mr").classList.remove("d-none");
	document.querySelector("#mr b").textContent = (profile.Results[0].PlayerLevel ?? 0);
	document.querySelector("#mr span").textContent = new Date(createdAt * 1000).toLocaleDateString();

	const accolades = [];
	if (profile.Results[0].Staff)
	{
		accolades.push("Digital Extremes Staff");
	}
	else
	{
		if (profile.Results[0].Founder)
		{
			accolades.push("Founder (" + founderTiers[profile.Results[0].Founder] + ")");
		}
		if (profile.Results[0].Guide)
		{
			accolades.push(guideTiers[profile.Results[0].Guide]);
		}
		if (profile.Results[0].Moderator)
		{
			accolades.push("Moderator");
		}
		if (profile.Results[0].Partner)
		{
			accolades.push("Warframe Creator");
		}
		if (createdAt < 1363651200)
		{
			accolades.push("Closed Beta Player");
		}
		if (profile.Results[0].Accolades?.Heirloom)
		{
			accolades.push("Ten Year Supporter");
		}
	}
	if (accolades.length != 0)
	{
		document.querySelector("#accolades span").textContent = accolades.join(", ");
		document.querySelector("#accolades").classList.remove("d-none");
	}
	else
	{
		document.querySelector("#accolades").classList.add("d-none");
	}

	if (profile.Results[0].GuildName)
	{
		document.querySelector("#clan span").textContent = profile.Results[0].GuildName + ", " + clanTiers[profile.Results[0].GuildTier] + " Clan Rank " + profile.Results[0].GuildClass;
		document.querySelector("#clan").classList.remove("d-none");
	}
	else
	{
		document.querySelector("#clan").classList.add("d-none");
	}

	document.getElementById("syndicates").innerHTML = "";
	for (const tag of syndicateTags)
	{
		const syndicate = ExportSyndicates[tag];
		const affiliation = profile.Results[0].Affiliations?.find(x => x.Tag == tag);

		const col = document.createElement("div");
		col.className = "col-md-6 p-1";
		{
			const card = document.createElement("div");
			card.className = "card";
			{
				const row = document.createElement("div");
				row.className = "row g-0";
				{
					const logo = makeSyndicateLogoElement(syndicate);
					logo.className = "col-xxl-2 col-lg-3 col-md-4 col-3 rounded-start";
					logo.children[0].className = "img-fluid rounded-start";
					row.appendChild(logo);
				}
				{
					const body = document.createElement("div");
					body.className = "col-xxl-10 col-lg-9 col-md-8 col-9";
					body.style.padding = "14px 16px";
					{
						const title = document.createElement("h5");
						title.className = "card-title";
						title.textContent = dict[syndicate.name];
						body.appendChild(title);
					}
					const level = (affiliation?.Title ?? 0);
					const title = syndicate.titles?.find(x => x.level == level);
					{
						const subtitle = document.createElement("h6");
						subtitle.className = "card-subtitle mb-2 text-body-secondary";
						subtitle.textContent = "Rank " + level;
						if (title)
						{
							subtitle.textContent += " · " + toTitleCase(dict[title.name]);
						}
						body.appendChild(subtitle);
					}
					{
						const standing = affiliation?.Standing ?? 0;
						const minStanding = (level < 0 ? title?.maxStanding : title?.minStanding) ?? 0;
						const text = document.createElement("p");
						text.className = "card-text";
						text.textContent = "Standing: " + (standing - minStanding).toLocaleString();
						if (minStanding != 0)
						{
							text.textContent += " (" + standing.toLocaleString() + " in total)";
						}
						body.appendChild(text);
					}
					row.appendChild(body);
				}
				card.appendChild(row);
			}
			col.appendChild(card);
		}
		document.getElementById("syndicates").appendChild(col);
	}

	document.getElementById("achievements").innerHTML = "";
	Object.entries(ExportAchievements)
	.sort((a, b) => (a[1].hidden ? 1 : 0) - (b[1].hidden ? 1 : 0))
	.forEach(([tag, achievement]) =>
	{
		if (achievement.icon || achievement.hidden)
		{
			const col = document.createElement("div");
			col.className = "col-md-6 p-1";
			{
				const card = document.createElement("div");
				card.className = "card";
				{
					const row = document.createElement("div");
					row.className = "row g-0";
					if (achievement.icon)
					{
						const div = document.createElement("div");
						div.className = "col-xxl-2 col-lg-3 col-md-4 col-3 rounded-start";
						{
							const img = document.createElement("img");
							img.className = "img-fluid rounded-start";
							img.src = "https://browse.wf" + achievement.icon;
							div.appendChild(img);
						}
						row.appendChild(div);
					}
					{
						const body = document.createElement("div");
						if (achievement.icon)
						{
							body.className = "col-xxl-10 col-lg-9 col-md-8 col-9";
						}
						body.style.padding = "9px";
						{
							const title = document.createElement("h5");
							title.className = "card-title";
							title.textContent = dict[achievement.name] ?? tag;
							if (tag.substring(0, 14) == "OrbVallisRacer")
							{
								title.textContent += " (" + vallisRaceNames[tag.substring(14)] + ")";
							}
							body.appendChild(title);
						}
						if (achievement.description)
						{
							const text = document.createElement("p");
							text.className = "card-text";
							text.textContent = dict[achievement.description];
							body.appendChild(text);
						}
						const progress = (profile.Results[0].ChallengeProgress?.find(x => x.Name == tag)?.Progress ?? 0);
						const requiredCount = (achievement.requiredCount ?? 1);
						body.innerHTML += `<div class="progress" role="progressbar"><div class="progress-bar" style="width: ${(progress / requiredCount) * 100}%">${progress.toLocaleString()}/${requiredCount.toLocaleString()}</div></div>`;
						row.appendChild(body);
					}
					card.appendChild(row);
				}
				col.appendChild(card);
			}
			document.getElementById("achievements").appendChild(col);
		}
	});

	profile.Results[0].Missions ??= [];
	document.querySelector("#missions tbody").innerHTML = "";
	Object.keys(ExportRegions).forEach(tag =>
	{
		if (tag != "EventNode763"
			&& !profile.Results[0].Missions.find(x => x.Tag == tag)
			)
		{
			profile.Results[0].Missions.push({ Tag: tag, Completes: 0 });
		}
	});
	profile.Results[0].Missions
	.sort((a, b) => b.Completes - a.Completes)
	.forEach(mission =>
	{
		const node = ExportRegions[mission.Tag];

		if (node)
		{
			if (node.nodeType == 3 /* NT_HUB */ && mission.Completes == 0)
			{
				return;
			}
			if (node.nodeType == 6 /* NT_SHORTCUT */)
			{
				return;
			}
		}

		const tr = document.createElement("tr");
		{
			const td = document.createElement("td");
			if (node)
			{
				td.textContent = dict[node.name];
				if (node.systemName && node.systemIndex != 19)
				{
					td.textContent += ", " + (dict[node.systemName] ?? node.systemName);
					if (node.missionType != "MT_PVP")
					{
						td.textContent += " (" + toTitleCase(dict[node.missionName])
						if (node.faction && node.systemIndex != 21)
						{
							td.textContent += " - " + toTitleCase(dict[ExportFactions[node.faction].name]);
						}
						td.textContent += ")";
					}
				}
			}
			else
			{
				td.textContent = mission.Tag;
			}
			tr.appendChild(td);
		}
		{
			const td = document.createElement("td");
			td.textContent = mission.Completes;
			tr.appendChild(td);
		}
		{
			const td = document.createElement("td");
			td.textContent = (mission.Tier ? "✓" : "");
			tr.appendChild(td);
		}
		{
			const td = document.createElement("td");
			if (node && node.masteryExp)
			{
				if (mission.Completes == 0)
				{
					td.textContent = "Missing out on " + (node.masteryExp * 2) + " mastery exp ";
				}
				else if (!mission.Tier)
				{
					td.textContent = "Missing out on " + node.masteryExp + " mastery exp.";
				}
			}
			tr.appendChild(td);
		}
		document.querySelector("#missions tbody").appendChild(tr);
	});

	profile.Results[0].LoadOutPreset ??= {};
	profile.Results[0].LoadOutInventory ??= {};

	/*if (profile.Results[0].LoadOutPreset.n)
	{
		document.querySelector("#loadout-name span").textContent = profile.Results[0].LoadOutPreset.n;
		document.getElementById("loadout-name").classList.remove("d-none");
	}
	else
	{
		document.getElementById("loadout-name").classList.add("d-none");
	}*/

	for (const category of ["Suits", "LongGuns", "Pistols", "Melee"])
	{
		document.getElementById(category + "-config").innerHTML = `<option value="0">Config A</option><option value="1">Config B</option><option value="2">Config C</option><option value="3">Config D</option><option value="4">Config E</option><option value="5">Config F</option>`;

		const key = category.substring(0, 1).toLowerCase();
		if (profile.Results[0].LoadOutPreset[key] && "cus" in profile.Results[0].LoadOutPreset[key])
		{
			document.querySelector("#" + category + "-config [value='" + profile.Results[0].LoadOutPreset[key].cus + "']").textContent += " (Active)";
			(document.getElementById(category + "-config") as HTMLSelectElement).value = profile.Results[0].LoadOutPreset[key].cus;
		}

		if (category != "Suits")
		{
			if (profile.Results[0].LoadOutPreset[key]?.ItemId)
			{
				document.getElementById(category + "-div").classList.remove("d-none");
			}
			else
			{
				document.getElementById(category + "-div").classList.add("d-none");
			}

			if (profile.Results[0].LoadOutPreset[key]?.hide)
			{
				document.getElementById(category + "-hide").classList.remove("d-none");
			}
			else
			{
				document.getElementById(category + "-hide").classList.add("d-none");
			}
		}
	}
	updateFashion();

	/*if (profile.Results[0].OperatorLoadOuts)
	{
		for (let i = 0; i != 17; ++i)
		{
			displaySkin("Operator", i, profile.Results[0].OperatorLoadOuts[0].Skins[i]);
		}
	}
	else
	{
		for (let i = 0; i != 17; ++i)
		{
			displaySkin("Operator", i, "");
		}
	}*/

	// Calculate total missions for percentage calculations
	const missionStats = ["MissionsCompleted", "MissionsFailed", "MissionsQuit", "MissionsInterrupted", "MissionsDumped"];
	const totalMissions = missionStats.reduce((sum, stat) => sum + (profile.Stats?.[stat] || 0), 0);

	// Calculate total ciphers for percentage calculations
	const cipherStats = ["CiphersSolved", "CiphersFailed"];
	const totalCiphers = cipherStats.reduce((sum, stat) => sum + (profile.Stats?.[stat] || 0), 0);

	for (const stat of ["TimePlayedSec", "Income", "MissionsCompleted", "MissionsFailed", "MissionsQuit", "MissionsInterrupted", "MissionsDumped", "CiphersSolved", "CiphersFailed", "CipherTime", "ReviveCount", "HealCount", "Deaths"/*, "MeleeKills"*/])
	{
		const value = (profile.Stats && profile.Stats[stat]) ? profile.Stats[stat] : 0;
		if (stat == "TimePlayedSec" || stat == "CipherTime")
		{
			const elm = document.getElementById(`stat-${stat}`);
			elm.textContent = `${(value / 3600).toFixed(1)} hours`;

			// Add tooltip with breakdown for TimePlayedSec, and exact seconds for CipherTime
			elm.style.cursor = "help";
			elm.style.textDecoration = "underline dotted";
			elm.setAttribute("data-bs-toggle", "tooltip");
			if (stat == "TimePlayedSec")
			{
				const totalSec = Math.floor(value);
				const days = Math.floor(totalSec / 86400);
				const hours = Math.floor((totalSec % 86400) / 3600);
				const minutes = Math.floor((totalSec % 3600) / 60);
				const seconds = totalSec % 60;
				const p = (window as any).pluralize;
				const parts = [p(days, "day"), p(hours, "hour"), p(minutes, "minute"), p(seconds, "second")];
				elm.setAttribute("data-bs-title", parts.join(", "));
			}
			else
			{
				elm.setAttribute("data-bs-title", `${Math.round(value).toLocaleString()} seconds`);
			}
			new (window as any).bootstrap.Tooltip(elm);
		}
		else
		{
			document.getElementById("stat-" + stat).textContent = value.toLocaleString();

			// Add percentage for mission stats
			if (missionStats.includes(stat) && totalMissions > 0)
			{
				const percentage = ((value / totalMissions) * 100).toFixed(2);
				document.getElementById("stat-" + stat).textContent += ` (${percentage}%)`;
			}

			// Add percentage for cipher stats
			if (cipherStats.includes(stat) && totalCiphers > 0)
			{
				const percentage = ((value / totalCiphers) * 100).toFixed(2);
				document.getElementById(`stat-${stat}`).textContent += ` (${percentage}%)`;
			}
		}
	}
	if (profile.Stats && profile.Stats.CipherTime && profile.Stats.CiphersSolved)
	{
		const avgCipherTime = profile.Stats.CipherTime / profile.Stats.CiphersSolved;
		const elm = document.getElementById("stat-CipherTimeAvg");
		elm.textContent = `${avgCipherTime.toFixed(3)}s`;

		// Add tooltip with unrounded value
		elm.style.cursor = "help";
		elm.style.textDecoration = "underline dotted";
		elm.setAttribute("data-bs-toggle", "tooltip");
		elm.setAttribute("data-bs-title", `${avgCipherTime} seconds`);
		new (window as any).bootstrap.Tooltip(elm);
	}
	else
	{
		document.getElementById("stat-CipherTimeAvg").textContent = "0s";
	}

	const makeRenumber = (tbody: HTMLElement, existingObserver: MutationObserver | undefined) =>
	{
		const renumber = () =>
		{
			let rank = 1;
			for (const tr of tbody.querySelectorAll<HTMLTableRowElement>("tr"))
			{
				tr.cells[0].textContent = getComputedStyle(tr).display === "none" ? "" : String(rank++);
			}
		};
		existingObserver?.disconnect();
		const observer = new MutationObserver(renumber);
		observer.observe(tbody, { childList: true });
		return { renumber, observer };
	};

	// Equipment filter bar + table
	{
		const EQUIPMENT_CATEGORIES: Record<string, { label: string; icon: string }> = (window as any).EQUIPMENT_CATEGORIES;
		const equipmentFilterBar = document.getElementById("equipment-filter-bar");
		const equipmentTbody = document.getElementById("equipment-stats");
		equipmentTbody.innerHTML = "";

		const presentCategories = new Set<string>();
		if (profile.Stats && profile.Stats.Weapons)
		{
			const categoryTotals: Record<string, number> = {};
			for (const item of profile.Stats.Weapons)
			{
				const type = ExportWarframes[item.type] ?? ExportWeapons[item.type] ?? ExportSentinels[item.type];
				if (!type) { continue; }
				const category = type.productCategory ?? "SpecialItems";
				if (category !== "SpecialItems")
				{
					categoryTotals[category] = (categoryTotals[category] ?? 0) + (item.equipTime ?? 0);
				}
			}

			profile.Stats.Weapons
			.sort((a, b) => b.equipTime - a.equipTime)
			.forEach(item =>
			{
				const type = ExportWarframes[item.type] ?? ExportWeapons[item.type] ?? ExportSentinels[item.type];
				if (!type)
				{
					return;
				}
				const category = type.productCategory ?? "SpecialItems";
				const tr = document.createElement("tr");
				tr.dataset.category = category;
				tr.appendChild(document.createElement("td")); // rank cell (populated by observer)
				{
					const td = document.createElement("td");
					td.textContent = dict[type.name];
					tr.appendChild(td);
				}
				{
					const td = document.createElement("td");
					const equipTime = item.equipTime ?? 0;
					const total = categoryTotals[category] ?? 0;
					td.textContent = `${(total ? equipTime / total * 100 : 0).toFixed(2)}%`;
					tr.appendChild(td);
				}
				{
					const td = document.createElement("td");
					td.innerHTML = ((item.equipTime ?? 0) / 3600).toFixed(1);
					tr.appendChild(td);
				}
				{
					const td = document.createElement("td");
					td.innerHTML = (item.kills ?? 0).toLocaleString();
					tr.appendChild(td);
				}
				{
					const td = document.createElement("td");
					td.innerHTML = (item.headshots ?? 0).toLocaleString();
					tr.appendChild(td);
				}
				{
					const td = document.createElement("td");
					td.innerHTML = (item.assists ?? 0).toLocaleString();
					tr.appendChild(td);
				}
				{
					const td = document.createElement("td");
					td.innerHTML = (item.xp ?? 0).toLocaleString();
					tr.appendChild(td);
				}
				equipmentTbody.appendChild(tr);
				presentCategories.add(category);
			});
		}

		const equipmentEntries = Object.entries(EQUIPMENT_CATEGORIES).map(([key, { label, icon }]) => ({ key, label, icon }));
		const { renumber: renumberEquipment, observer: equipmentObs } = makeRenumber(equipmentTbody, equipmentRankObserver);
		equipmentRankObserver = equipmentObs;
		initStatsFilterBar(equipmentFilterBar, equipmentTbody, equipmentEntries, presentCategories, renumberEquipment);
		renumberEquipment();
	}

	// Enemy filter bar + table
	{
		const ENEMY_FACTIONS: Array<{ label: string; icon: string; factions: string[] }> = (window as any).ENEMY_FACTIONS;
		const enemyFilterBar = document.getElementById("enemy-filter-bar");
		const enemyTbody = document.getElementById("enemy-stats");
		enemyTbody.innerHTML = "";

		const presentFactions = new Set<string>();
		if (profile.Stats && profile.Stats.Enemies)
		{
			profile.Stats.Enemies
			.sort((a, b) => b.kills - a.kills)
			.forEach(enemy =>
			{
				const type = ExportEnemies.avatars[enemy.type];
				if (!type)
				{
					return;
				}
				const bucket = ENEMY_FACTIONS.find(f => f.factions.includes(type.faction));
				const factionLabel = bucket ? bucket.label : "";
				const tr = document.createElement("tr");
				tr.dataset.category = factionLabel;
				tr.appendChild(document.createElement("td")); // rank cell (populated by observer)
				{
					const td = document.createElement("td");
					td.textContent = dict[type.name];
					tr.appendChild(td);
				}
				{
					const td = document.createElement("td");
					td.innerHTML = (enemy.kills ?? 0).toLocaleString();
					tr.appendChild(td);
				}
				{
					const td = document.createElement("td");
					td.innerHTML = (enemy.headshots ?? 0).toLocaleString();
					tr.appendChild(td);
				}
				{
					const td = document.createElement("td");
					td.innerHTML = (enemy.assists ?? 0).toLocaleString();
					tr.appendChild(td);
				}
				{
					const td = document.createElement("td");
					td.innerHTML = (enemy.executions ?? 0).toLocaleString();
					tr.appendChild(td);
				}
				{
					const td = document.createElement("td");
					td.innerHTML = (enemy.deaths ?? 0).toLocaleString();
					tr.appendChild(td);
				}
				{
					const td = document.createElement("td");
					const entry = profile.Stats.Scans?.find(x => x.type == enemy.type);
					td.innerHTML = (entry?.scans ?? 0).toLocaleString();
					tr.appendChild(td);
				}
				enemyTbody.appendChild(tr);
				if (factionLabel)
				{
					presentFactions.add(factionLabel);
				}
			});
		}

		const enemyEntries = ENEMY_FACTIONS.map(({ label, icon }) => ({ key: label, label, icon }));
		const { renumber: renumberEnemy, observer: enemyObs } = makeRenumber(enemyTbody, enemyRankObserver);
		enemyRankObserver = enemyObs;
		initStatsFilterBar(enemyFilterBar, enemyTbody, enemyEntries, presentFactions, renumberEnemy);
		renumberEnemy();
	}

	updateProfileAge();
}

function displaySkin(category: string, i: number, value: string): void
{
	const elm = document.getElementById(category + "-skin-" + i);
	if (elm)
	{
		if (value && value != "" && value != "/Lotus/Upgrades/Skins/Armor/WarframeDefaults/EmptyCustomization")
		{
			if (ExportCustoms[value])
			{
				const a = document.createElement("a");
				/*if (ExportCustoms[value].name == "" || dict[ExportCustoms[value].name] == "")
				{
					a.textContent = value;
				}
				else*/
				{
					a.textContent = dict[ExportCustoms[value].name] ?? ExportCustoms[value].name ?? value;
				}
				a.href = "https://browse.wf" + ExportCustoms[value].icon;
				a.target = "_blank";
				elm.querySelector("span").innerHTML = "";
				elm.querySelector("span").appendChild(a);
			}
			else
			{
				elm.querySelector("span").textContent = value;
			}
			elm.classList.remove("d-none");
		}
		else
		{
			elm.classList.add("d-none");
		}
	}
}

const modularWeapons = {
	"/Lotus/Weapons/SolarisUnited/Primary/LotusModularPrimary": "Kitgun",
	"/Lotus/Weapons/SolarisUnited/Primary/LotusModularPrimaryBeam": "Kitgun",
	"/Lotus/Weapons/SolarisUnited/Primary/LotusModularPrimaryLauncher": "Kitgun",
	"/Lotus/Weapons/SolarisUnited/Primary/LotusModularPrimaryShotgun": "Kitgun",
	"/Lotus/Weapons/SolarisUnited/Primary/LotusModularPrimarySniper": "Kitgun",
	"/Lotus/Weapons/SolarisUnited/Secondary/LotusModularSecondary": "Kitgun",
	"/Lotus/Weapons/SolarisUnited/Secondary/LotusModularSecondaryBeam": "Kitgun",
	"/Lotus/Weapons/SolarisUnited/Secondary/LotusModularSecondaryShotgun": "Kitgun",
	"/Lotus/Weapons/Ostron/Melee/LotusModularWeapon": "Zaw",
};

function updateFashion(): void
{
	for (const category of ["Suits", "LongGuns", "Pistols", "Melee"])
	{
		const equipment = profile.Results[0].LoadOutInventory[category] ? profile.Results[0].LoadOutInventory[category][0] : { ItemType: "None", Configs: [] };
		const config = equipment.Configs[(document.getElementById(category + "-config") as HTMLSelectElement).value];

		document.getElementById(category + "-name").textContent = (dict[ExportWarframes[equipment.ItemType]?.name] ?? dict[ExportWeapons[equipment.ItemType]?.name] ?? modularWeapons[equipment.ItemType] ?? equipment.ItemType);
		if (equipment.ItemName && equipment.ItemName != document.getElementById(category + "-name").textContent)
		{
			if (equipment.ItemName.indexOf("|") === -1) // e.g. for a stock Tenet Arca Plasmor, the ItemName would be "/Lotus/Language/Weapons/CrpBEArcaPlasmorName|PARVI LISSIDPHA" with the respective Lich/Sister name.
			{
				document.getElementById(category + "-name").textContent += " (\"" + equipment.ItemName + "\")";
			}
		}

		if (config?.Skins)
		{
			for (let i = 0; i != 26; ++i)
			{
				displaySkin(category, i, config?.Skins[i]);
			}
		}
		else
		{
			for (let i = 0; i != 26; ++i)
			{
				displaySkin(category, i, "");
			}
		}

		for (const section of ["pricol", "attcol", "syancol", "sigcol"])
		{
			for (const key of ["t0", "t1", "t2", "t3", "m0", "m1", "en", "e1"])
			{
				const elm = document.getElementById(category + "-" + section + "-" + key);
				if (elm)
				{
					elm.querySelector(".palettes").textContent = "";
					if (config && config[section] && config[section][key])
					{
						const [r, g, b/*, a*/] = parseRgbaInt(config[section][key]);
						// Alpha might be interesting for sigils
						const hex = toHexString(r, g, b);
						elm.querySelector(".hex").textContent = hex;
						elm.querySelector<HTMLSpanElement>(".hex").style.fontFamily = "monospace";
						elm.querySelector<HTMLSpanElement>(".colour-blob").style.backgroundColor = hex;
						Object.values(ExportFlavour).forEach(flavour =>
						{
							if (flavour.hexColours)
							{
								for (const colour of flavour.hexColours)
								{
									const [r2, g2, b2] = peColourToRgb(colour);
									if (r == r2 && g == g2 && b == b2)
									{
										elm.querySelector(".palettes").textContent += " · " + dict[flavour.name];
										break;
									}
								}
							}
							if (flavour.legacyColours)
							{
								for (const colour of flavour.legacyColours)
								{
									const [r2, g2, b2] = peColourToRgb(colour);
									if (r == r2 && g == g2 && b == b2)
									{
										elm.querySelector(".palettes").textContent += " · " + dict[flavour.name] + " (Legacy)";
										break;
									}
								}
							}
						});
					}
					else
					{
						elm.querySelector(".hex").textContent = "Default";
						elm.querySelector<HTMLSpanElement>(".hex").style.fontFamily = "";
						elm.querySelector<HTMLSpanElement>(".colour-blob").style.backgroundColor = "";
					}
				}
			}
		}
	}
}

function tabulate(elm: HTMLElement, event: Event): void
{
	event.preventDefault();

	activateTab(elm.getAttribute("data-tab"));

	if ("profile" in window)
	{
		location.hash = "tab=" + elm.getAttribute("data-tab");
	}
}

function activateTab(id: string): void
{
	document.querySelectorAll("[data-tab]").forEach(x => x.classList.remove("active"));
	document.querySelector("[data-tab="+id+"]").classList.add("active");

	document.querySelectorAll(".tab").forEach(x => x.classList.add("d-none"));
	document.getElementById(id).classList.remove("d-none");
}
