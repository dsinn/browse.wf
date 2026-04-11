import type { IChallenge, IFaction, IMissionType, IRegion, TFaction, TMissionType } from "warframe-public-export-plus";

// Oracle
interface IBountyCycle {
	expiry:         number;
	rot:            string;
	vaultRot:       string;
	zarimanFaction: string;
	bounties:       Record<string, {
		node:      string;
		challenge: string;
		ally?:     string;
	}[]>;
}


// worldState
interface IMongoDate {
	$date: {
		$numberLong: string;
	};
}

// worldState
interface IDailyDeal {
	StoreItem: string;
	Activation: IMongoDate;
	Expiry: IMongoDate;
	Discount: number;
	OriginalPrice: number;
	SalePrice: number;
	AmountTotal: number;
	AmountSold: number;
}

// common.js
declare let onLanguageUpdate: () => void;
declare function getDictPromise(): Promise<Record<string, string>>;
declare function getOSDictPromise(): Promise<Record<string, string>>;
declare function fetchExport(name: string): Promise<any>;
declare function toTitleCase(str: string): string;
declare function updateCalendarSeason(): Promise<void>;
declare function updateDescendia(): void;

// invasions.ts
declare function updateInvasions(): Promise<void>;

// card-filters.ts
declare function isFilterEnabled(cardName: string, filterType: string): boolean;
declare function initializeCardFilters(cardName: string, onFilterChange?: () => void): void;
declare function initializeFilterToggles(): void;

// news-mark-read.ts
declare function initializeMarkAsRead(): void;
declare function isNewsItemRead(item: any): boolean;
declare function markNewsItemAsRead(item: any, element: HTMLElement): void;
declare function setNewsItemData(item: any, element: HTMLElement): void;

// bounty-filters.ts
declare function initializeBountyFiltersAll(): void;

// bounty-checkboxes.ts
declare function updateBountyCheckboxes(): void;

// arbyTiers.js
declare const arbyTiers: Record<string, string>;

// fetch
declare const dict: Record<string, string>;
declare const osdict: Record<string, string>;
declare const ExportRegions: Record<string, IRegion>;
declare const ExportChallenges: Record<string, IChallenge>;
declare const ExportMissionTypes: Record<TMissionType, IMissionType>;
declare const ExportFactions: Record<TFaction, IFaction>;

// state
declare global {
	interface Window {
		LIVE_VERSION: number;

		duviri_mood_index: number;
		duviri_expiry: number;

		bountyCycleExpiry: number;
		bountyCycle: IBountyCycle;
		arbys: [number, string][];
		arby_node: IRegion;
		arby_expiry: number;

		incursions: [number, string][];
		incursions_today: string[];
		incursions_expiry: number;

		worldState: {
			Events: any[];
			Goals: any[];
			Alerts: any[];
			Invasions: any[];
			Conquests: {
				Type: string; // CT_LAB (Deep Archimedea), CT_HEX (Temporal Archimedea)
				Expiry: IMongoDate;
				Missions: {
					faction: string;
					missionType: string;
					difficulties: {
						type: string; // CD_NORMAL, CD_HARD
						deviation: string;
						risks: string[];
					}[];
				}[];
				Variables: string[];
			}[];
			Sorties: {
				_id: { $oid: string };
				Activation: IMongoDate;
				Expiry: IMongoDate;
				Variants: {
					missionType: TMissionType;
					modifierType: string;
					node: string;
					tileset: string;
				}[];
			}[];
			LiteSorties: {
				_id: { $oid: string };
				Activation: IMongoDate;
				Expiry: IMongoDate;
				Boss: "SORTIE_BOSS_AMAR" | "SORTIE_BOSS_NIRA" | "SORTIE_BOSS_BOREAL";
				Missions: {
					missionType: TMissionType;
					node: string;
				}[];
			}[];
			ActiveMissions: {
				_id: { $oid: string };
				Region: number;
				Seed: number;
				Activation: IMongoDate;
				Expiry: IMongoDate;
				Node: string;
				MissionType: string;
				Modifier: string;
				Hard?: boolean;
			}[];
			VoidTraders: {
				_id: { $oid: string };
				Activation: IMongoDate;
				Expiry: IMongoDate;
				Node: string;
				Manifest: {
					ItemType: string;
					PrimePrice: number;
					RegularPrice: number;
				}[];
			}[];
			VoidStorms: {
				_id: { $oid: string };
				Node: string;
				Activation: IMongoDate;
				Expiry: IMongoDate;
				ActiveMissionTier: string;
			}[];
			DailyDeals: IDailyDeal[];
			Descents: {
				Activation: IMongoDate;
				Expiry: IMongoDate;
				RandSeed: number;
				Challenges: {
					Index: number;
					Type: string;
					Challenge: string;
					Level: string;
					Specs: string[];
					Auras: string[];
				}[];
			}[];
			SyndicateMissions: {
				_id: { $oid: string };
				Activation: IMongoDate;
				Expiry: IMongoDate;
				Tag: string;
				Seed: number;
				Nodes: string[];
			}[];
			Tmp: string;
		}
		redtext: { data: string; time: number }[];
		dailyDeal: IDailyDeal;
		last_sortie: string;
		last_darvo_deal: string;
		last_baro_expiry: string;
	}
}

const STALE_DATA_RETRY_MS = 5_000;

const dict_promise = getDictPromise();
const osdict_promise = getOSDictPromise();
const dicts_promise = Promise.all([ dict_promise, osdict_promise ]);
const ExportRegions_promise = fetchExport("ExportRegions");
const ExportChallenges_promise = fetchExport("ExportChallenges");
const ExportMissionTypes_promise = fetchExport("ExportMissionTypes");
const ExportFactions_promise = fetchExport("ExportFactions");
const ExportImages_promise = fetchExport("ExportImages");
const ExportResources_promise = fetchExport("ExportResources");
const ExportBundles_promise = fetchExport("ExportBundles");
const ExportBoosterPacks_promise = fetchExport("ExportBoosterPacks");
const ExportBoosters_promise = fetchExport("ExportBoosters");

let renderedAlertOids: Set<string> | undefined;
let renderedGoals = "";

dict_promise.then(dict => { (window as any).dict = dict; });
osdict_promise.then(osdict => { (window as any).osdict = osdict; });
ExportRegions_promise.then(res => { (window as any).ExportRegions = res; });
ExportChallenges_promise.then(res => { (window as any).ExportChallenges = res; });
ExportMissionTypes_promise.then(res => { (window as any).ExportMissionTypes = res; });
ExportFactions_promise.then(res => { (window as any).ExportFactions = res; });
ExportImages_promise.then(res => { (window as any).ExportImages = res; });

function formatExpiry(expiry: number): string
{
	expiry -= expiry % 1000; expiry += 1000; // normalise the ms so everything ticks at the same time
	const time = Date.now();
	const delta = expiry - time;
	if (delta < 1_000)
	{
		return "Pending update";
	}
	return deltaToUnits(delta).join(" ");
}

function deltaToUnits(delta: number): string[]
{
	delta = Math.abs(delta);

	let units = [];
	if (delta >= 86_400_000)
	{
		units.push(Math.trunc(delta / 86_400_000) + "d");
		delta %= 86_400_000;
	}
	if (delta >= 3_600_000 || units.length)
	{
		units.push(Math.trunc(delta / 3_600_000) + "h");
		delta %= 3_600_000;
	}
	if (delta >= 60_000 || units.length)
	{
		units.push(Math.trunc(delta / 60_000) + "m");
		delta %= 60_000;
	}
	units.push(Math.trunc(delta / 1_000).toString().padStart(2, "0") + "s");
	return units;
}

function formatActivation(activation: number): string
{
	return deltaToUnits(Date.now() - activation)[0];
}

function createExpiryBadge(expiry: number): HTMLSpanElement
{
	const span = document.createElement("span");
	span.setAttribute("data-expiry", expiry.toString());
	span.className = "badge text-bg-secondary";
	span.textContent = formatExpiry(expiry);
	return span;
}

function setDatum(name: string, value: string, expiry: number): void
{
	const elm = document.getElementById(name);
	elm.querySelectorAll("[data-bs-toggle=tooltip]").forEach(x => window.bootstrap.Tooltip.getInstance(x).dispose());
	elm.textContent = value + " ";
	elm.appendChild(createExpiryBadge(expiry));
}

function updateVallis(): void
{
	const EPOCH = new Date("November 10, 2018 08:13:48 UTC").getTime();
	const time = Date.now();
	const cycle = Math.trunc((time - EPOCH) / 1600000);
	const cycleStart = EPOCH + cycle * 1600000;
	const cycleEnd = cycleStart + 1600000;
	const cycleColdStart = cycleStart + 400000;
	const stateEnd = (time > cycleColdStart ? cycleEnd : cycleColdStart);
	setDatum("vallis", time > cycleColdStart ? "❄️ Cold" : "☀️ Warm", stateEnd);
	setTimeout(updateVallis, stateEnd - time);
}
updateVallis();

function updateDuviriMoodLocalised()
{
	setDatum("duviri", osdict[[
		"/Lotus/Language/Duviri/SadMoodTitleShort",
		"/Lotus/Language/Duviri/ScaredMoodTitleShort",
		"/Lotus/Language/Duviri/HappyMoodTitleShort",
		"/Lotus/Language/Duviri/AngryMoodTitleShort",
		"/Lotus/Language/Duviri/JealousMoodTitleShort"
	][window.duviri_mood_index % 5]], window.duviri_expiry);
}

function updateDuviriMood()
{
	const moodIndex = Math.trunc(Date.now() / 7200000);
	const moodStart = moodIndex * 7200000;
	const moodEnd = moodStart + 7200000;

	window.duviri_mood_index = moodIndex;
	window.duviri_expiry = moodEnd;
	updateDuviriMoodLocalised();

	setTimeout(updateDuviriMood, moodEnd - Date.now());
}
osdict_promise.then(() => updateDuviriMood());

let sundown_update_queued = false;
function updateDayNightCycle()
{
	const time = Date.now();
	const cycleNightStart = window.bountyCycleExpiry - 3_000_000;
	const stateEnd = time >= cycleNightStart ? window.bountyCycleExpiry : cycleNightStart;
	setDatum("poe", time >= cycleNightStart ? "🌑 Night" : "☀️ Day", stateEnd);
	setDatum("deimos", time >= cycleNightStart ? "🌑 Vome" : "☀️ Fass", stateEnd);
	if (time >= cycleNightStart)
	{
		sundown_update_queued = false;
	}
	else if (!sundown_update_queued)
	{
		sundown_update_queued = true;
		setTimeout(updateDayNightCycle, cycleNightStart - Date.now());

		const notifyAt = cycleNightStart - 30 * 1000;
		setTimeout(function()
		{
			if (localStorage.getItem("live.notif.nightfall"))
			{
				sendNotification("The sun sets in 30 seconds.");
			}
		}, notifyAt - Date.now());
	}
}

const rotRewards = {
	A: ["/Lotus/Language/Suits/SentientSystemsComponentName", "/Lotus/Language/Weapons/ArchonWhipName"],
	B: ["/Lotus/Language/Suits/SentientChassisComponentName", "/Lotus/Language/Weapons/ArchonDualDaggersName"],
	C: ["/Lotus/Language/Suits/SentientHelmetComponentName", "/Lotus/Language/Weapons/ArchonTridentName"],
};

const vaultRotRewards = {
	A: ["/Lotus/Language/Weapons/InfSniperRifleBarrel"],
	B: ["/Lotus/Language/Weapons/InfSniperRifleReceiver"],
	C: ["/Lotus/Language/Weapons/InfSniperRifleStock"],
};

const allyNames = {
	"/Lotus/Types/Gameplay/1999Wf/ProtoframeAllies/AmirAllyAgent": "Amir",
	"/Lotus/Types/Gameplay/1999Wf/ProtoframeAllies/AoiAllyAgent": "Aoi",
	"/Lotus/Types/Gameplay/1999Wf/ProtoframeAllies/ArthurAllyAgent": "Arthur",
	"/Lotus/Types/Gameplay/1999Wf/ProtoframeAllies/EleanorAllyAgent": "Eleanor",
	"/Lotus/Types/Gameplay/1999Wf/ProtoframeAllies/LettieAllyAgent": "Lettie",
	"/Lotus/Types/Gameplay/1999Wf/ProtoframeAllies/QuincyAllyAgent": "Quincy",
};

function updateBountyCycleLocalised()
{
	document.getElementById("bounty-rot-rewards").textContent = rotRewards[window.bountyCycle.rot].map(x => dict[x]).join(", ");
	document.getElementById("vault-rot-rewards").textContent = vaultRotRewards[window.bountyCycle.vaultRot].map(x => dict[x]).join(", ");
	setDatum("zariman", dict[window.bountyCycle.zarimanFaction == "FC_GRINEER" ? "/Lotus/Language/Game/Faction_GrineerUC" : "/Lotus/Language/Game/Faction_CorpusUC"], window.bountyCycle.expiry);
	setDatum("bounties-header", "Bounties", window.bountyCycle.expiry);
	for (const syndicateTag of ["HexSyndicate", "EntratiLabSyndicate", "ZarimanSyndicate"])
	{
		const rows = document.getElementById(syndicateTag + "-table").querySelectorAll("tr");
		for (let i = 0; i != window.bountyCycle.bounties[syndicateTag].length; ++i)
		{
			const node = ExportRegions[window.bountyCycle.bounties[syndicateTag][i].node];
			(rows[i] as HTMLElement).dataset.missionType = node.missionType;
			rows[i].querySelector(".mission").textContent = dict[node.name];
			if (["SolNode850", "SolNode853", "SolNode854", "SolNode856"].indexOf(window.bountyCycle.bounties[syndicateTag][i].node) == -1)
			{
				rows[i].querySelector(".mission").textContent += " (" + toTitleCase(dict[node.missionName]) + ")";
			}
			if (window.bountyCycle.bounties[syndicateTag][i].ally)
			{
				(window as any).renderAllyIcon(allyNames[window.bountyCycle.bounties[syndicateTag][i].ally], rows[i].querySelector(".ally"));
			}
			const challenge = ExportChallenges[window.bountyCycle.bounties[syndicateTag][i].challenge];
			const span = document.createElement("span");
			span.textContent = dict[challenge.description].split("\r\n").pop().split("|COUNT|").join(challenge.requiredCount.toString());
			addTooltip(span, dict[challenge.name]);
			rows[i].querySelector(".challenge").querySelectorAll("[data-bs-toggle=tooltip]").forEach(x => window.bootstrap.Tooltip.getInstance(x).dispose());
			rows[i].querySelector(".challenge").innerHTML = "";
			rows[i].querySelector(".challenge").appendChild(span);
		}

		(window as any).applyBountyFilters(syndicateTag, rows);
	}
}

function updateBountyCycle(retryMs = STALE_DATA_RETRY_MS)
{
	fetch("https://oracle.browse.wf/bounty-cycle").then(res => res.json()).then(async (bountyCycle: IBountyCycle) =>
	{
		if (bountyCycle.expiry <= Date.now())
		{
			throw new Error(`[${new Date().toISOString()}] Stale bounty cycle: expiry ${new Date(bountyCycle.expiry).toISOString()}`);
		}
		if (window.bountyCycle && window.bountyCycle.expiry != bountyCycle.expiry && localStorage.getItem("live.notif.bounties"))
		{
			sendNotification("New bounties are available.");
		}
		window.bountyCycle = bountyCycle;
		window.bountyCycleExpiry = bountyCycle.expiry;
		updateDayNightCycle();
		await dicts_promise;
		await ExportRegions_promise;
		await ExportChallenges_promise;
		await ExportImages_promise;
		document.getElementById("bounty-rot").textContent = bountyCycle.rot;
		document.getElementById("vault-rot").textContent = bountyCycle.vaultRot;
		updateBountyCycleLocalised();
		setTimeout(() => updateBountyCycle(STALE_DATA_RETRY_MS), bountyCycle.expiry - Date.now());
	}).catch(e =>
	{
		console.error(e);
		setTimeout(() => updateBountyCycle(Math.min(retryMs * 2, 240_000 + 120_000 * Math.random())), retryMs);
	});
}

function updateNames()
{
	document.getElementById("poe-name").textContent = dict["/Lotus/Language/Locations/EidolonPlains"] + " / " + dict["/Lotus/Language/Locations/Earth"];
	document.getElementById("vallis-name").textContent = dict["/Lotus/Language/Locations/VenusLandscape"];
	document.getElementById("deimos-name").textContent = dict["/Lotus/Language/InfestedMicroplanet/SolarMapDeimosLandscapeName"];
	document.getElementById("zariman-name").textContent = dict["/Lotus/Language/Zariman/ZarimanRegionName"];
	document.getElementById("duviri-name").textContent = dict["/Lotus/Language/Locations/Duviri"];
	document.getElementById("HexSyndicate-name").textContent = dict["/Lotus/Language/1999/MessengerHexName"];
	document.getElementById("EntratiLabSyndicate-name").textContent = dict["/Lotus/Language/EntratiLab/EntratiGeneral/EntratiLabSyndicateName"];
	document.getElementById("ZarimanSyndicate-name").textContent = dict["/Lotus/Language/Syndicates/ZarimanName"];
	updateBountyCheckboxes(); // Re-inject checkboxes after textContent wipes the heading children
}

async function updateArbyLocalised()
{
	// dicts are guaranteed available here
	await ExportFactions_promise;

	setDatum("arby-header", osdict["/Lotus/Language/Menu/AlertHardMode"], window.arby_expiry);
	document.getElementById("arby-what").textContent = toTitleCase(dict[window.arby_node.missionName]) + " - " + dict[ExportFactions[window.arby_node.faction].name];
	const arbyWhereElem = document.createElement("abbr");
	arbyWhereElem.textContent = `${dict[window.arby_node.name]}, ${dict[window.arby_node.systemName]}`;
	addTooltip(arbyWhereElem, (window as any).formatTileset((window as any).getTileset(window.arby_node)));
	document.getElementById("arby-where").replaceChildren(document.createTextNode("@ "), arbyWhereElem);
}

function updateArby()
{
	// dicts are guaranteed available here

	const currentHour = Math.trunc(Date.now() / 3600000) * 3600;
	const epochHour = window.arbys[0][0];
	const currentHourIndex = (currentHour - epochHour) / 3600;
	const arr = window.arbys[currentHourIndex];
	window.arby_node = ExportRegions[arr[1]];
	window.arby_expiry = (currentHour + 3600) * 1000;
	updateArbyLocalised();
	document.getElementById("arby-tier").textContent = arbyTiers[arr[1]] ?? "F";
	setTimeout(updateArby, window.arby_expiry - Date.now());
}

function updateIncursions()
{
	const today = Math.trunc(Date.now() / 86400000) * 86400;
	const epochDay = window.incursions[0][0];
	window.incursions_today = window.incursions[(today - epochDay) / 86400][1].split(",");
	window.incursions_expiry = (today + 86400) * 1000;
	void (window as any).updateIncursionsLocalised();
	setTimeout(updateIncursions, window.incursions_expiry - Date.now());
}

function addTooltip(elm: HTMLElement, title: string): any
{
	elm.setAttribute("data-bs-toggle", "tooltip");
	elm.setAttribute("data-bs-title", title);
	return new window.bootstrap.Tooltip(elm);
}

function updateWorldStateLocalised()
{
	void (window as any).updateNewsTicker();
	updateAlerts();
	updateGoals();
	void (window as any).updateFissures();
	updateInvasions();
}

function fetchWorldState(): Promise<void>
{
	return (window as any).WarframeApiFrontProxyClient.fetchWorldState().then((worldState: any) =>
	{
		window.worldState = worldState;
		updateWorldStateLocalised();
	});
}

function initWorldStateCards(): void
{
	updateDayNightCycle();
	updateSorties();
	updateArchonHunt();
	updateDarvosDeal();
	updateBaro();
	(window as any).updateWeekly();
	(window as any).updateCircuitChoices();
	updateCalendarSeason();
	updateDescendia();
}

const sortieModifiers = {
	"SORTIE_MODIFIER_LOW_ENERGY": "Energy Reduction",
	"SORTIE_MODIFIER_IMPACT": "Enemy Physical Enhancement (Impact)",
	"SORTIE_MODIFIER_SLASH": "Enemy Physical Enhancement (Slash)",
	"SORTIE_MODIFIER_PUNCTURE": "Enemy Physical Enhancement (Puncture)",
	"SORTIE_MODIFIER_EXIMUS": "Eximus Stronghold",
	"SORTIE_MODIFIER_MAGNETIC": "Enemy Elemental Enhancement (Magnetic)",
	"SORTIE_MODIFIER_CORROSIVE": "Enemy Elemental Enhancement (Corrosive)",
	"SORTIE_MODIFIER_VIRAL": "Enemy Elemental Enhancement (Viral)",
	"SORTIE_MODIFIER_ELECTRICITY": "Enemy Elemental Enhancement (Electricity)",
	"SORTIE_MODIFIER_RADIATION": "Enemy Elemental Enhancement (Radiation)",
	"SORTIE_MODIFIER_GAS": "Enemy Elemental Enhancement (Gas)",
	"SORTIE_MODIFIER_FIRE": "Enemy Elemental Enhancement (Heat)",
	"SORTIE_MODIFIER_EXPLOSION": "Enemy Elemental Enhancement (Blast)",
	"SORTIE_MODIFIER_FREEZE": "Enemy Elemental Enhancement (Cold)",
	"SORTIE_MODIFIER_TOXIN": "Enemy Elemental Enhancement (Toxin)",
	"SORTIE_MODIFIER_POISON": "Enemy Elemental Enhancement (Toxin)",
	"SORTIE_MODIFIER_HAZARD_RADIATION": "Radiation Hazard",
	"SORTIE_MODIFIER_HAZARD_MAGNETIC": "Electromagnetic Anomalies",
	"SORTIE_MODIFIER_HAZARD_FOG": "Dense Fog",
	"SORTIE_MODIFIER_HAZARD_FIRE": "Fire Hazard",
	"SORTIE_MODIFIER_HAZARD_ICE": "Cryogenic Leakage",
	"SORTIE_MODIFIER_HAZARD_COLD": "Extreme Cold",
	"SORTIE_MODIFIER_ARMOR": "Augmented Enemy Armor",
	"SORTIE_MODIFIER_SHIELDS": "Enhanced Enemy Shields",
	"SORTIE_MODIFIER_SECONDARY_ONLY": "Pistol Only",
	"SORTIE_MODIFIER_SHOTGUN_ONLY": "Shotgun Only",
	"SORTIE_MODIFIER_SNIPER_ONLY": "Sniper Only",
	"SORTIE_MODIFIER_RIFLE_ONLY": "Assault Rifle Only",
	"SORTIE_MODIFIER_MELEE_ONLY": "Melee Only",
	"SORTIE_MODIFIER_BOW_ONLY": "Bow Only",
};

async function updateSorties()
{
	await dicts_promise;
	await ExportMissionTypes_promise;
	await ExportRegions_promise;

	const sortie = window.worldState.Sorties.find(x => Date.now() >= parseInt(x.Activation.$date.$numberLong) && Date.now() < parseInt(x.Expiry.$date.$numberLong));
	if (!sortie) { setTimeout(updateSorties, STALE_DATA_RETRY_MS); return; }
	setDatum("sortie-header", toTitleCase(osdict["/Lotus/Language/Menu/SortieMissionName"]), parseInt(sortie.Expiry.$date.$numberLong));
	document.getElementById("sortie-header").innerHTML += " ";
	document.getElementById("sortie-header").appendChild(createCompletionToggle(sortie._id.$oid));
	const tbody = document.createElement("tbody");
	for (const variant of sortie.Variants)
	{
		const tr = document.createElement("tr");
		const th = document.createElement("th");
		th.textContent = toTitleCase(dict[ExportMissionTypes[variant.missionType].name]);
		tr.appendChild(th);
		const td = document.createElement("td");
		td.textContent = sortieModifiers[variant.modifierType];

		(window as any).appendSortieLocation(td, ExportRegions[variant.node], variant.tileset);

		tr.appendChild(td);
		tbody.appendChild(tr);
	}
	document.getElementById("sortie-table").innerHTML = "";
	document.getElementById("sortie-table").appendChild(tbody);
	if (window.last_sortie && window.last_sortie != sortie._id.$oid && localStorage.getItem("live.notif.sortie"))
	{
		sendNotification("A new sortie is available.");
	}
	window.last_sortie = sortie._id.$oid;
	setTimeout(updateSorties, parseInt(sortie.Expiry.$date.$numberLong) - Date.now());
}

async function updateArchonHunt()
{
	try
	{
		await dicts_promise;
		await ExportMissionTypes_promise;

		const litesortie = window.worldState.LiteSorties.find(x => Date.now() >= parseInt(x.Activation.$date.$numberLong) && Date.now() < parseInt(x.Expiry.$date.$numberLong));
		if (!litesortie)
		{
			setTimeout(updateArchonHunt, STALE_DATA_RETRY_MS);
			return;
		}
		setDatum("litesortie-header", osdict["/Lotus/Language/WorldStateWindow/LiteSortieMissionName"], parseInt(litesortie.Expiry.$date.$numberLong));
		document.getElementById("litesortie-header").innerHTML += " ";
		document.getElementById("litesortie-header").appendChild(createCompletionToggle(litesortie._id.$oid));
		const mission_names = [];
		for (const mission of litesortie.Missions)
		{
			mission_names.push(toTitleCase(dict[ExportMissionTypes[mission.missionType].name]));
		}
		const span = document.createElement("span");
		span.textContent = toTitleCase(litesortie.Boss.substring(12));
		span.className = "text-" + { "Amar": "danger", "Nira": "warning", "Boreal": "info" }[span.textContent];
		document.getElementById("litesortie-body").innerHTML = "";
		document.getElementById("litesortie-body").appendChild(span);
		document.getElementById("litesortie-body").innerHTML += " • " + mission_names.join(", ");
		setTimeout(updateArchonHunt, parseInt(litesortie.Expiry.$date.$numberLong) - Date.now());
	}
	catch (e)
	{
		console.error(e);
		setTimeout(updateArchonHunt, STALE_DATA_RETRY_MS);
	}
}

async function updateDarvosDeal()
{
	window.dailyDeal = window.worldState.DailyDeals.find(x => Date.now() >= parseInt(x.Activation.$date.$numberLong) && Date.now() < parseInt(x.Expiry.$date.$numberLong));
	if (!window.dailyDeal) { setTimeout(updateDarvosDeal, STALE_DATA_RETRY_MS); return; }
	setTimeout(updateDarvosDeal, parseInt(window.dailyDeal.Expiry.$date.$numberLong) - Date.now());
	setDatum("darvo-header", "Darvo's Deal", parseInt(window.dailyDeal.Expiry.$date.$numberLong));
	const item_data = await getItemDataPromise(window.dailyDeal.StoreItem);
	await dicts_promise;
	document.getElementById("darvo-item").textContent = dict[item_data.name];
	(document.getElementById("darvo-icon") as HTMLImageElement).src = "https://browse.wf" + item_data.icon;
	document.getElementById("darvo-stock").textContent = (window.dailyDeal.AmountTotal - window.dailyDeal.AmountSold) + "/" + window.dailyDeal.AmountTotal;
	document.getElementById("darvo-ogprice").textContent = window.dailyDeal.OriginalPrice.toString();
	document.getElementById("darvo-price").textContent = window.dailyDeal.SalePrice.toString();
	document.getElementById("darvo-discount").textContent = window.dailyDeal.Discount.toString();

	if (window.last_darvo_deal
		&& window.last_darvo_deal != window.dailyDeal.Activation.$date.$numberLong
		&& localStorage.getItem("live.notif.darvo")
		)
	{
		sendNotification("Darvo sells " + dict[item_data.name] + " for " + window.dailyDeal.SalePrice + " Platinum today.");
	}
	window.last_darvo_deal = window.dailyDeal.Activation.$date.$numberLong;
}

async function updateBaro()
{
	await dicts_promise;
	await ExportRegions_promise;
	const baroNext = window.worldState.VoidTraders[0].Manifest
		? parseInt(window.worldState.VoidTraders[0].Expiry.$date.$numberLong)
		: parseInt(window.worldState.VoidTraders[0].Activation.$date.$numberLong);
	setTimeout(updateBaro, baroNext > Date.now() ? baroNext - Date.now() : STALE_DATA_RETRY_MS);
	document.querySelectorAll(".baro-where").forEach(x => x.textContent = dict[ExportRegions[window.worldState.VoidTraders[0].Node].name] + ", " + dict[ExportRegions[window.worldState.VoidTraders[0].Node].systemName]);
	if (window.worldState.VoidTraders[0].Manifest)
	{
		document.getElementById("baro-soon").classList.add("d-none");
		document.getElementById("baro-now").classList.remove("d-none");

		setDatum("baro-header", "Baro Ki'Teer", parseInt(window.worldState.VoidTraders[0].Expiry.$date.$numberLong));

		for (const item of window.worldState.VoidTraders[0].Manifest)
		{
			getItemNamePromise(item.ItemType);
		}

		const items = [];
		for (const item of window.worldState.VoidTraders[0].Manifest)
		{
			const data = { ...item, ...(await getItemDataPromise(item.ItemType)) };
			if (data.compatName)
			{
				data.__type = 0;
			}
			else if (data.damagePerShot)
			{
				data.__type = 1;
			}
			else
			{
				data.__type = 2;
			}
			items.push(data);
		}
		items.sort((a, b) => a.__type - b.__type);

		const tbody = document.createElement("tbody");
		for (const item of items)
		{
			const tr = document.createElement("tr");
			{
				const td = document.createElement("td");
				td.textContent = await getItemNamePromise(item.ItemType);
				tr.appendChild(td);
			}
			{
				const td = document.createElement("td");
				td.className = "text-end";
				td.textContent = item.PrimePrice;
				tr.appendChild(td);
			}
			{
				const td = document.createElement("td");
				td.className = "text-end";
				td.textContent = item.RegularPrice.toLocaleString();
				tr.appendChild(td);
			}
			tbody.appendChild(tr);
		}
		document.getElementById("baro-table").innerHTML = "";
		document.getElementById("baro-table").appendChild(tbody);

		if (window.last_baro_expiry
			&& window.last_baro_expiry != window.worldState.VoidTraders[0].Expiry.$date.$numberLong
			&& localStorage.getItem("live.notif.baro")
			)
		{
			sendNotification("Baro Ki'Teer has arrived at " + document.querySelector(".baro-where").textContent + ".");
		}
		window.last_baro_expiry = window.worldState.VoidTraders[0].Expiry.$date.$numberLong;
	}
	else
	{
		document.getElementById("baro-soon").classList.remove("d-none");
		document.getElementById("baro-now").classList.add("d-none");

		setDatum("baro-header", "Baro Ki'Teer", parseInt(window.worldState.VoidTraders[0].Activation.$date.$numberLong));

		window.last_baro_expiry = "69";
	}
}

async function updateAlerts(forceRender = false)
{
	// Skip re-render if the OID set is unchanged
	const currentOids = new Set<string>(window.worldState.Alerts.map((a: any) => a._id.$oid));
	const prevOids = renderedAlertOids;
	const sameOids = prevOids
		&& currentOids.size === prevOids.size
		&& [...currentOids].every(oid => prevOids.has(oid));
	renderedAlertOids = currentOids;
	if (!forceRender && sameOids) return;

	if (window.worldState.Alerts.length != 0)
	{
		const promises = [dict_promise, ExportMissionTypes_promise, ExportFactions_promise, ExportRegions_promise];
		for (const alert of window.worldState.Alerts)
		{
			if (alert.MissionInfo.missionReward.items)
			{
				for (const reward of alert.MissionInfo.missionReward.items)
				{
					promises.push(getItemNamePromise(reward));
				}
			}
			if (alert.MissionInfo.missionReward.countedItems)
			{
				for (const reward of alert.MissionInfo.missionReward.countedItems)
				{
					promises.push(getItemNamePromise(reward.ItemType));
				}
			}
		}
		await Promise.all(promises);

		document.getElementById("alerts-body").querySelectorAll("[data-bs-toggle=tooltip]").forEach(x => window.bootstrap.Tooltip.getInstance(x).dispose());
		document.getElementById("alerts-body").innerHTML = "";
		for (const alert of window.worldState.Alerts)
		{
			if (Date.now() < alert.Activation.$date.$numberLong)
			{
				// not yet active
			}
			else if (Date.now() < alert.Expiry.$date.$numberLong)
			{
				const block = document.createElement("div");
				block.className = "card-block";
				{
					const span = document.createElement("span");
					span.className = "d-block";
					{
						const b = document.createElement("b");
						b.textContent = toTitleCase(dict[ExportMissionTypes[alert.MissionInfo.missionType].name]) + " - " + dict[ExportFactions[alert.MissionInfo.faction].name];
						span.appendChild(b);
					}
					span.innerHTML += " (" + alert.MissionInfo.minEnemyLevel + "-" + alert.MissionInfo.maxEnemyLevel + ") @ "+ dict[ExportRegions[alert.MissionInfo.location].name] + ", " + dict[ExportRegions[alert.MissionInfo.location].systemName] + " ";
					span.appendChild(createExpiryBadge(alert.Expiry.$date.$numberLong));
					span.innerHTML += " ";
					span.appendChild(createCompletionToggle(alert._id.$oid));
					block.appendChild(span);
				}
				{
					const span = document.createElement("span");
					span.className = "d-block";
					span.textContent = alert.MissionInfo.missionReward.credits.toLocaleString() + " Credits";
					block.appendChild(span);
				}
				if (alert.MissionInfo.missionReward.items)
				{
					for (const reward of alert.MissionInfo.missionReward.items)
					{
						const span = document.createElement("span");
						span.className = "d-block";
						span.textContent = await getItemNamePromise(reward);
						block.appendChild(span);
					}
				}
				if (alert.MissionInfo.missionReward.countedItems)
				{
					for (const reward of alert.MissionInfo.missionReward.countedItems)
					{
						const span = document.createElement("span");
						span.className = "d-block";
						span.textContent = reward.ItemCount + "X " + await getItemNamePromise(reward.ItemType);
						block.appendChild(span);
					}
				}
				document.getElementById("alerts-body").appendChild(block);
			}
		}
	}
	else
	{
		document.getElementById("alerts-body").textContent = "None right now.";
	}

	if (!sameOids && prevOids)
	{
		const newAlerts = window.worldState.Alerts.filter((a: any) => !prevOids.has(a._id.$oid));
		if (newAlerts.length > 0 && localStorage.getItem("live.notif.alerts"))
		{
			sendNotification(newAlerts.length == 1 ? "A new alert is live." : newAlerts.length + " new alerts are live.");
		}
	}
}

async function updateGoals(forceRender = false)
{
	await osdict_promise;
	const goal_names = [];
	for (const goal of window.worldState.Goals)
	{
		goal_names.push(osdict[goal.Desc] ? toTitleCase(osdict[goal.Desc]) : goal.Desc);
	}
	const content = goal_names.join(", ") || "None right now.";

	// Skip re-render if content is unchanged
	if (!forceRender && content === renderedGoals) return;
	renderedGoals = content;

	document.getElementById("goals-body").textContent = content;
}

function updateTeshin()
{
	const EPOCH = 1736121600 * 1000;
	const week = Math.trunc((Date.now() - EPOCH) / 604800000);
	const weekStart = EPOCH + week * 604800000;
	const weekEnd = weekStart + 604800000;
	setDatum("vendors-header", "Vendors", weekEnd);

	document.getElementById("teshin-offer").textContent = [
		"Umbra Forma Blueprint",
		"50,000x Kuva",
		"Kitgun Riven Mod",
		"3x Forma",
		"Zaw Riven Mod",
		"30,000x Endo",
		"Rifle Riven Mod",
		"Shotgun Riven Mod"
	][week % 8];
	document.getElementById("teshin-check").querySelectorAll("[data-bs-toggle=tooltip]").forEach(x => window.bootstrap.Tooltip.getInstance(x).dispose());
	document.getElementById("teshin-check").innerHTML = "";
	document.getElementById("teshin-check").appendChild(createCompletionToggle(`teshin-${weekEnd}`));

	document.getElementById("ironwake-check").querySelectorAll("[data-bs-toggle=tooltip]").forEach(x => window.bootstrap.Tooltip.getInstance(x).dispose());
	document.getElementById("ironwake-check").innerHTML = "";
	document.getElementById("ironwake-check").appendChild(createCompletionToggle(`ironwake-${weekEnd}`));

	setTimeout(updateTeshin, weekEnd - Date.now());
}
updateTeshin();

function updateCircuit()
{
	const EPOCH = 1734307200 * 1000;
	const week = Math.trunc((Date.now() - EPOCH) / 604800000);
	const weekStart = EPOCH + week * 604800000;
	const weekEnd = weekStart + 604800000;

	document.getElementById("clem-check").querySelectorAll("[data-bs-toggle=tooltip]").forEach(x => window.bootstrap.Tooltip.getInstance(x).dispose());
	document.getElementById("clem-check").innerHTML = "";
	document.getElementById("clem-check").appendChild(createCompletionToggle(`clem-${weekEnd}`));

	document.getElementById("maroo-check").querySelectorAll("[data-bs-toggle=tooltip]").forEach(x => window.bootstrap.Tooltip.getInstance(x).dispose());
	document.getElementById("maroo-check").innerHTML = "";
	document.getElementById("maroo-check").appendChild(createCompletionToggle(`maroo-${weekEnd}`));

	document.getElementById("netracell-checks").querySelectorAll("[data-bs-toggle=tooltip]").forEach(x => window.bootstrap.Tooltip.getInstance(x).dispose());
	document.getElementById("netracell-checks").innerHTML = "";
	document.getElementById("netracell-checks").appendChild(createCompletionToggle(`netracell1-${weekEnd}`));
	document.getElementById("netracell-checks").appendChild(createCompletionToggle(`netracell2-${weekEnd}`));
	document.getElementById("netracell-checks").appendChild(createCompletionToggle(`netracell3-${weekEnd}`));
	document.getElementById("netracell-checks").appendChild(createCompletionToggle(`netracell4-${weekEnd}`));
	document.getElementById("netracell-checks").appendChild(createCompletionToggle(`netracell5-${weekEnd}`));

	document.getElementById("kahl-checks").querySelectorAll("[data-bs-toggle=tooltip]").forEach(x => window.bootstrap.Tooltip.getInstance(x).dispose());
	document.getElementById("kahl-checks").innerHTML = "";
	document.getElementById("kahl-checks").appendChild(createCompletionToggle(`kahl-${weekEnd}`));
	document.getElementById("kahl-checks").appendChild(createCompletionToggle(`kahlb1-${weekEnd}`));
	document.getElementById("kahl-checks").appendChild(createCompletionToggle(`kahlb2-${weekEnd}`));
	document.getElementById("kahl-checks").appendChild(createCompletionToggle(`kahlb3-${weekEnd}`));
	document.getElementById("kahl-checks").appendChild(createCompletionToggle(`kahlb4-${weekEnd}`));
	document.getElementById("kahl-checks").appendChild(createCompletionToggle(`kahlb5-${weekEnd}`));
	document.getElementById("kahl-checks").appendChild(createCompletionToggle(`kahlb6-${weekEnd}`));

	document.getElementById("descent-checks").querySelectorAll("[data-bs-toggle=tooltip]").forEach(x => window.bootstrap.Tooltip.getInstance(x).dispose());
	document.getElementById("descent-checks").innerHTML = "";
	document.getElementById("descent-checks").appendChild(createCompletionToggle(`descent1-${weekEnd}`));
	document.getElementById("descent-checks").appendChild(createCompletionToggle(`descent2-${weekEnd}`));

	setTimeout(updateCircuit, weekEnd - Date.now());
}
dict_promise.then(updateCircuit);

function loadScriptPromise(src: string): Promise<any>
{
	return new Promise((resolve, reject) =>
	{
		const script = document.createElement("script");
		script.src = src;
		script.onload = resolve;
		script.onerror = reject;
		document.documentElement.appendChild(script);
	});
}

const item_data_promises = {};
function getItemDataPromise(uniqueName: string): Promise<any>
{
	uniqueName = uniqueName.split("/Lotus/StoreItems/").join("/Lotus/");
	if (!item_data_promises[uniqueName])
	{
		item_data_promises[uniqueName] = fetch("https://browse.wf" + uniqueName).then(res => res.json());
	}
	return item_data_promises[uniqueName];
}

async function getItemNamePromise(uniqueName: string): Promise<string>
{
	try
	{
		const item_data = await getItemDataPromise(uniqueName);
		if (item_data.resultType)
		{
			const result_name = await getItemNamePromise(item_data.resultType);
			return dict["/Lotus/Language/Items/BlueprintAndItem"].split("|ITEM|").join(result_name);
		}
		if (item_data.category && item_data.era)
		{
			return dict["/Lotus/Language/Relics/VoidProjectionName"].split("|ERA|").join(item_data.era).split("|CATEGORY|").join(item_data.category);
		}
		await dicts_promise;
		return dict[item_data.name] ?? item_data.name;
	}
	catch (e)
	{
		console.error(e);
		return uniqueName;
	}
}

function isOidMarkedAsCompleted(oid: string): boolean
{
	const arr = JSON.parse(localStorage.getItem("oids_completed") ?? "[]");
	return arr.findIndex(x => x == oid) != -1;
}

function toggleOidCompletion(oid: string): void
{
	const arr = JSON.parse(localStorage.getItem("oids_completed") ?? "[]");
	const index = arr.findIndex(x => x == oid);
	if (index != -1)
	{
		arr.splice(index, 1);
	}
	else
	{
		arr.push(oid);
	}
	localStorage.setItem("oids_completed", JSON.stringify(arr));
	(window as any).triggerCloudSyncWithDebounce();
}

function createCompletionToggle(oid: string): HTMLAnchorElement
{
	const a = document.createElement("a");
	a.className = "completion-check";
	a.setAttribute("data-oid", oid);
	a.innerHTML = isOidMarkedAsCompleted(oid) ? '<i class="bi bi-check-square"></i>' : '<i class="bi bi-square"></i>';
	addTooltip(a, (isOidMarkedAsCompleted(oid) ? "Unmark as " : "Mark as ") + "completed");
	a.onclick = function()
	{
		const newCompletedState = !isOidMarkedAsCompleted(oid);
		(window as any).setCompletionToggle(a, newCompletedState);
		(window as any).applyCheckboxLinking(a, newCompletedState);
	};
	return a;
}


const fissureTiers = {
	VoidT1: "Lith",
	VoidT2: "Meso",
	VoidT3: "Neo",
	VoidT4: "Axi",
	VoidT5: "Requiem",
	VoidT6: "Omnia",
};



updateBountyCycle();

dict_promise.then(() => updateNames());
dicts_promise.then(([dict, osdict]) =>
{
	onLanguageUpdate = function()
	{
		updateNames();
		updateDuviriMoodLocalised();
		if (window.bountyCycle)
		{
			updateBountyCycleLocalised();
		}
		if (window.arbys)
		{
			updateArbyLocalised();
		}
		if (window.incursions)
		{
			void (window as any).updateIncursionsLocalised();
		}
		if (window.worldState)
		{
			(window as any).updateWeekly();
		}
		if (window.worldState)
		{
			updateWorldStateLocalised();
		}
	};

	Promise.all([
		fetch("arbys.txt").then(res => res.text()),
		loadScriptPromise("supplemental-data/arbyTiers.js"),
		ExportRegions_promise
	]).then(([arbys]) =>
	{
		window.arbys = arbys.split("\n").map(line => line.split(",")).filter(arr => arr.length == 2).map(arr => [ parseInt(arr[0]), arr[1] ]);
		updateArby();
	});

	fetch("sp-incursions.txt").then(res => res.text()).then(async (incursions) => {
		await ExportRegions_promise;
		window.incursions = incursions.split("\n").map(line => line.split(";")).filter(arr => arr.length == 2).map(arr => [ parseInt(arr[0]), arr[1] ]);
		updateIncursions();
	});
});

// Initial worldState fetch: initialize all expiry-based card lifecycles once data is available
fetchWorldState().then(initWorldStateCards);
(window as any).updateRedText();

// Active-tab polling: fetch worldState every minute and update poll-driven cards
setInterval(function()
{
	if (!document.hidden)
	{
		fetchWorldState();
	}
}, 60_000);

// Eager re-fetch on tab becoming visible
document.addEventListener("visibilitychange", function()
{
	if (!document.hidden)
	{
		fetchWorldState();
	}
});

setInterval(function()
{
	for (const elm of document.querySelectorAll(".badge[data-expiry]"))
	{
		elm.textContent = formatExpiry(parseInt(elm.getAttribute("data-expiry")));
	}
	for (const elm of document.querySelectorAll(".badge[data-activation]"))
	{
		elm.textContent = formatActivation(parseInt(elm.getAttribute("data-activation")));
	}
}, 100);

function refreshCollapseStatus(elm: HTMLElement): void
{
	const engaged = localStorage.getItem("live.collapse." + elm.getAttribute("data-collapse-toggle"));
	const span = document.createElement("span");
	span.textContent = engaged ? "▼" : "▲";
	if (engaged)
	{
		elm.classList.add("engaged");
	}
	else
	{
		elm.classList.remove("engaged");
	}
	addTooltip(span, engaged ? "Expand" : "Collapse");
	elm.querySelectorAll("[data-bs-toggle=tooltip]").forEach(x => window.bootstrap.Tooltip.getInstance(x).dispose());
	elm.innerHTML = "";
	elm.appendChild(span);
}

document.querySelectorAll<HTMLSpanElement>("[data-collapse-toggle]").forEach(elm =>
{
	elm.classList.add("text-secondary");
	refreshCollapseStatus(elm);
	elm.onclick = function()
	{
		if (localStorage.getItem("live.collapse." + elm.getAttribute("data-collapse-toggle")))
		{
			localStorage.removeItem("live.collapse." + elm.getAttribute("data-collapse-toggle"));
		}
		else
		{
			localStorage.setItem("live.collapse." + elm.getAttribute("data-collapse-toggle"), "1");
		}
		(window as any).triggerCloudSyncWithDebounce();
		refreshCollapseStatus(elm);
	};
});

function sendNotification(text: string): void
{
	const toast = document.createElement("div");
	toast.className = "toast align-items-center text-bg-primary border-0";
	const div = document.createElement("div");
	div.className = "d-flex";
	const body = document.createElement("div");
	body.className = "toast-body";
	body.textContent = text;
	div.appendChild(body);
	const button = document.createElement("button");
	button.className = "btn-close btn-close-white me-2 m-auto";
	button.setAttribute("data-bs-dismiss", "toast");
	div.appendChild(button);
	toast.appendChild(div);
	new window.bootstrap.Toast(document.querySelector(".toast-container").appendChild(toast)).show();

	if (Notification.permission == "granted")
	{
		new Notification(text);
	}
}

function refreshNotifStatus(elm: HTMLElement): void
{
	const enabled = localStorage.getItem("live.notif." + elm.getAttribute("data-notif-toggle"));
	const span = document.createElement("span");
	span.textContent = "🔔";
	span.className = enabled ? "notif-bell-enabled" : "notif-bell-disabled";
	const name = elm.getAttribute("data-notif-toggle") == "nightfall" ? "Notifications (30s before Plains of Eidolon nightfall)" : "Notifications";
	addTooltip(span, (enabled ? "Disable " : "Enable ") + name);
	elm.querySelectorAll("[data-bs-toggle=tooltip]").forEach(x => window.bootstrap.Tooltip.getInstance(x).dispose());
	elm.innerHTML = "";
	elm.appendChild(span);
}

document.querySelectorAll<HTMLAnchorElement>("[data-notif-toggle]").forEach(elm =>
{
	refreshNotifStatus(elm);
	elm.onclick = function()
	{
		if (localStorage.getItem("live.notif." + elm.getAttribute("data-notif-toggle")))
		{
			localStorage.removeItem("live.notif." + elm.getAttribute("data-notif-toggle"));
		}
		else
		{
			localStorage.setItem("live.notif." + elm.getAttribute("data-notif-toggle"), "1");
			if (Notification.permission != "granted")
			{
				Notification.requestPermission().then((permission) =>
				{
					sendNotification("This is an example notification.");
				});
			}
		}
		(window as any).triggerCloudSyncWithDebounce();
		refreshNotifStatus(elm);
	};
});

(window as any).initLiveSync();
initializeFilterToggles();
initializeCardFilters('news', () => void (window as any).updateNewsTicker(true));
initializeCardFilters('incursions', () => void (window as any).updateIncursionsLocalised());
initializeCardFilters('fissures', () => void (window as any).updateFissures(true));
initializeCardFilters('sp-fissures', () => void (window as any).updateFissures(true));
initializeCardFilters('rj-fissures', () => void (window as any).updateFissures(true));
initializeCardFilters('weekly-missions', () => (window as any).filterWeeklyMissions());
initializeCardFilters('invasions', () => { void updateInvasions(); });
initializeCardFilters('calendar-season');

initializeMarkAsRead();
initializeBountyFiltersAll();
updateBountyCheckboxes();
document.querySelectorAll<HTMLElement>(".vq-abbr").forEach(elm => addTooltip(elm, "Voidplume Quills"));


// Expose globally for fork code
(window as any).addTooltip = addTooltip;
(window as any).createCompletionToggle = createCompletionToggle;
(window as any).dicts_promise = dicts_promise;
(window as any).ExportRegions_promise = ExportRegions_promise;
(window as any).fissureTiers = fissureTiers;
(window as any).getItemNamePromise = getItemNamePromise;
(window as any).isOidMarkedAsCompleted = isOidMarkedAsCompleted;
(window as any).refreshCollapseStatus = refreshCollapseStatus;
(window as any).refreshNotifStatus = refreshNotifStatus;
(window as any).setDatum = setDatum;
(window as any).toggleOidCompletion = toggleOidCompletion;
(window as any).toTitleCase = toTitleCase;
(window as any).updateBountyCycleLocalised = updateBountyCycleLocalised;
