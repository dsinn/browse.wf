/**
 * Weekly Forecast page — renders tabs for Deep Archimedea, Temporal Archimedea, and Descendia
 * across all available weeks from worldState.
 *
 * Uses globals exposed by:
 *   - src/conquest-helpers.ts  (transformConquestMissions, renderConquestMissions, renderConquestFrameVariables)
 *   - src/descendia.ts         (renderDescentChallenges)
 *   - common.js                (getDictPromise, getOSDictPromise, toTitleCase)
 */

declare function getDictPromise(): Promise<Record<string, string>>;
declare function getOSDictPromise(): Promise<Record<string, string>>;

declare function transformConquestMissions(
	conquest: any,
	conquestType: string,
	ExportMissionTypes: Record<string, { name: string }>
): IConquestMission[];

declare function renderConquestMissions(
	missions: IConquestMission[],
	variantKeyPrefix: string,
	osdict: Record<string, string>,
	dict: Record<string, string>
): HTMLTableSectionElement;

declare function renderConquestFrameVariables(
	frameVariables: string[],
	osdict: Record<string, string>
): HTMLTableRowElement;

declare function renderDescentChallenges(
	descent: any,
	dict: Record<string, string>
): HTMLTableSectionElement;

function mongoMs(d: IMongoDate): number
{
	return parseInt(d.$date.$numberLong);
}

function formatTabDate(ms: number): string
{
	return new Date(ms).toLocaleDateString("en", { month: "short", day: "numeric" });
}

/**
 * Builds a Bootstrap tab nav item and its corresponding tab pane.
 * Stores the activation timestamp on the button as data-activation for refresh identity.
 */
function buildTab(
	tabsEl: HTMLElement,
	contentEl: HTMLElement,
	id: string,
	label: string,
	activationMs: number,
	isActive: boolean,
	buildContent: (paneBody: HTMLElement) => void
): void
{
	// Nav tab button
	const li = document.createElement("li");
	li.className = "nav-item";
	li.setAttribute("role", "presentation");

	const btn = document.createElement("button");
	btn.className = "nav-link" + (isActive ? " active" : "");
	btn.id = id + "-tab";
	btn.setAttribute("data-bs-toggle", "tab");
	btn.setAttribute("data-bs-target", "#" + id);
	btn.setAttribute("type", "button");
	btn.setAttribute("role", "tab");
	btn.setAttribute("data-activation", String(activationMs));
	btn.textContent = label;
	li.appendChild(btn);
	tabsEl.appendChild(li);

	// Tab pane
	const pane = document.createElement("div");
	pane.className = "tab-pane fade" + (isActive ? " show active" : "");
	pane.id = id;
	pane.setAttribute("role", "tabpanel");

	buildContent(pane);
	contentEl.appendChild(pane);
}

/**
 * Returns the activation timestamp of the active tab button, or null if none is active.
 */
function getActiveTabActivation(tabsEl: HTMLElement): string | null
{
	const active = tabsEl.querySelector(".nav-link.active");
	return active ? active.getAttribute("data-activation") : null;
}

/**
 * Re-activates the tab whose data-activation matches the given timestamp string.
 * No-ops if not found (the tab no longer exists after a refresh).
 */
function restoreActiveTab(tabsEl: HTMLElement, activation: string): void
{
	const target = tabsEl.querySelector(`.nav-link[data-activation="${activation}"]`) as HTMLElement | null;
	if (target)
	{
		new window.bootstrap.Tab(target).show();
	}
}

function renderConquestTabs(
	tabsEl: HTMLElement,
	contentEl: HTMLElement,
	conquests: any[],
	conquestType: string,
	variantKeyPrefix: string,
	ExportMissionTypes: Record<string, { name: string }>,
	dict: Record<string, string>,
	osdict: Record<string, string>,
	preserveActivation: string | null = null
): void
{
	const now = Date.now();
	tabsEl.innerHTML = "";
	contentEl.innerHTML = "";

	// There's usually only one entry per conquest type, but handle multiple for robustness
	conquests.forEach((conquest, i) =>
	{
		const activationMs = mongoMs(conquest.Activation);
		const expiryMs = mongoMs(conquest.Expiry);
		const isCurrent = activationMs <= now && now < expiryMs;
		const label = formatTabDate(activationMs);
		const id = conquestType.toLowerCase() + "-" + i;

		buildTab(tabsEl, contentEl, id, label, activationMs, isCurrent || i === 0, pane =>
		{
			const missions = transformConquestMissions(conquest, conquestType, ExportMissionTypes);
			const tbody = renderConquestMissions(missions, variantKeyPrefix, osdict, dict);

			const missionsTable = document.createElement("table");
			missionsTable.className = "table table-sm table-borderless table-hover mb-2";
			missionsTable.appendChild(tbody);
			pane.appendChild(missionsTable);

			const fvRow = renderConquestFrameVariables(conquest.Variables || [], osdict);
			const fvTable = document.createElement("table");
			fvTable.className = "table table-sm table-borderless mb-0";
			fvTable.appendChild(fvRow);
			pane.appendChild(fvTable);
		});
	});

	if (preserveActivation !== null)
	{
		restoreActiveTab(tabsEl, preserveActivation);
	}
}

function renderDescentTabs(
	tabsEl: HTMLElement,
	contentEl: HTMLElement,
	descents: any[],
	dict: Record<string, string>,
	preserveActivation: string | null = null
): void
{
	const now = Date.now();
	tabsEl.innerHTML = "";
	contentEl.innerHTML = "";

	const activeIdx = descents.findIndex(d =>
		mongoMs(d.Activation) <= now && now < mongoMs(d.Expiry)
	);

	descents.forEach((descent, i) =>
	{
		const activationMs = mongoMs(descent.Activation);
		const isActive = i === activeIdx || (activeIdx === -1 && i === 0);
		const label = formatTabDate(activationMs);
		const id = "descent-" + i;

		buildTab(tabsEl, contentEl, id, label, activationMs, isActive, pane =>
		{
			const tbody = renderDescentChallenges(descent, dict);

			const table = document.createElement("table");
			table.className = "table table-sm table-borderless table-hover";

			// Header row
			const thead = document.createElement("thead");
			const headerRow = document.createElement("tr");
			["#", "Type", "Challenge", "Arena", "Specs", "Auras"].forEach(text =>
			{
				const th = document.createElement("th");
				th.textContent = text;
				headerRow.appendChild(th);
			});
			thead.appendChild(headerRow);
			table.appendChild(thead);
			table.appendChild(tbody);
			pane.appendChild(table);
		});
	});

	if (preserveActivation !== null)
	{
		restoreActiveTab(tabsEl, preserveActivation);
	}
}

/**
 * Returns the milliseconds until 00:01 UTC tomorrow.
 */
function msUntilDailyRefresh(): number
{
	const now = Date.now();
	return 86400000 - (now % 86400000) + 60000;
}

async function initWeeklyForecast(isRefresh: boolean = false): Promise<void>
{
	const labTabsEl    = document.getElementById("lab-conquest-tabs")!;
	const hexTabsEl    = document.getElementById("hex-conquest-tabs")!;
	const descentTabsEl = document.getElementById("descendia-tabs")!;

	// Capture which tab the user is on before re-rendering (only meaningful on refresh)
	const labActivation     = isRefresh ? getActiveTabActivation(labTabsEl)     : null;
	const hexActivation     = isRefresh ? getActiveTabActivation(hexTabsEl)     : null;
	const descentActivation = isRefresh ? getActiveTabActivation(descentTabsEl) : null;

	const [worldState, dict, osdict, ExportMissionTypes] = await Promise.all([
		fetch("https://oracle.browse.wf/worldState.json").then(r => r.json()),
		getDictPromise(),
		getOSDictPromise(),
		fetch("warframe-public-export-plus/ExportMissionTypes.json").then(r => r.json()),
	]);

	// Deep Archimedea (CT_LAB)
	const labConquests = (worldState.Conquests ?? []).filter((c: any) => c.Type === "CT_LAB");
	if (labConquests.length > 0)
	{
		renderConquestTabs(
			labTabsEl,
			document.getElementById("lab-conquest-content")!,
			labConquests,
			"CT_LAB",
			"/Lotus/Language/Conquest/MissionVariant_LabConquest_",
			ExportMissionTypes,
			dict,
			osdict,
			labActivation
		);
	}

	// Temporal Archimedea (CT_HEX)
	const hexConquests = (worldState.Conquests ?? []).filter((c: any) => c.Type === "CT_HEX");
	if (hexConquests.length > 0)
	{
		renderConquestTabs(
			hexTabsEl,
			document.getElementById("hex-conquest-content")!,
			hexConquests,
			"CT_HEX",
			"/Lotus/Language/Conquest/MissionVariant_HexConquest_",
			ExportMissionTypes,
			dict,
			osdict,
			hexActivation
		);
	}

	// Descendia
	const descents = worldState.Descents ?? [];
	if (descents.length > 0)
	{
		renderDescentTabs(
			descentTabsEl,
			document.getElementById("descendia-content")!,
			descents,
			dict,
			descentActivation
		);
	}

	// Schedule next refresh at 00:01 UTC
	setTimeout(() => initWeeklyForecast(true).catch(console.error), msUntilDailyRefresh());
}

initWeeklyForecast().catch(console.error);
