/**
 * Descendia card functionality for browse.wf
 *
 * Handles rendering the Descendia (Devil's Lair) weekly rotation challenges.
 * Displays 21 challenges from the active Descent with mission types, arenas,
 * specs, and auras.
 */

// Declare global functions available from live.ts
declare function getDictPromise(): Promise<Record<string, string>>;
declare function createExpiryBadge(expiry: number): HTMLSpanElement;

interface IMongoDate {
	$date: {
		$numberLong: string;
	};
}

interface IDescent {
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
}

/**
 * Updates the Descendia table with the currently active Descent rotation
 */
function updateDescendia(): void
{
	// worldState must be available before calling this
	if (!(window as any).worldState?.Descents || (window as any).worldState.Descents.length === 0)
	{
		console.error("worldState.Descents not available for updateDescendia");
		return;
	}

	const now = Date.now();
	// Find the active Descent (Activation <= now < Expiry)
	const activeDescent: IDescent = (window as any).worldState.Descents.find((d: IDescent) =>
		parseInt(d.Activation.$date.$numberLong) <= now && parseInt(d.Expiry.$date.$numberLong) > now
	);

	if (!activeDescent)
	{
		setTimeout(updateDescendia, 5_000); // stale worldState — retry shortly
		return;
	}

	// Update header with expiry timer
	const expiry = parseInt(activeDescent.Expiry.$date.$numberLong);
	const header = document.querySelector('.card-header:has(#descent-checks) h5');
	if (header)
	{
		// Preserve collapse toggle, set title + badge, then append checks
		const collapseToggle = header.querySelector('[data-collapse-toggle="descendia"]');
		const checksSpan = header.querySelector('#descent-checks');

		header.textContent = "";
		if (collapseToggle)
		{
			collapseToggle.classList.add("me-1");
			header.appendChild(collapseToggle);
		}
		header.appendChild(document.createTextNode("Descendia "));
		header.appendChild(createExpiryBadge(expiry));
		header.appendChild(document.createTextNode(" "));
		if (checksSpan) header.appendChild(checksSpan);
	}

	// Refresh when this Descent expires
	setTimeout(updateDescendia, expiry - Date.now());

	getDictPromise().then(dict =>
	{
		const table = document.getElementById("descendia-table");
		const existingTbody = table.querySelector("tbody");
		if (existingTbody)
		{
			table.removeChild(existingTbody);
		}
		table.appendChild(renderDescentChallenges(activeDescent, dict));
	});
}

const ARENA_EMOJI: Record<string, string> = {
	ArenaAvocado:            "🥑",
	ArenaBagel:              "🥯",
	ArenaCherry:             "🍒",
	ArenaCoconut:            "🥥",
	ArenaEggplant:           "🍆",
	ArenaGrape:              "🍇",
	ArenaMango:              "🥭",
	ArenaMelon:              "🍈",
	ArenaPeach:              "🍑",
	ArenaWaffle:             "🧇",
	BossArenaSmall:          "⛽︎",
	BossArenaUriel:          "😈",
	ProtoframeRoomHarrow:    "👲🏼",
	ProtoframeRoomWisp:      "👰🏼‍♀️",
	SpecialChallengeArena01: "🐴1",
	SpecialChallengeArena02: "🐴2",
	SpecialChallengeArena03: "🐴3",
};

/**
 * Renders the challenges of a given Descent into a <tbody> element.
 * Extracted from updateDescendia() so weekly-forecast can render any descent, not just the active one.
 *
 * @param descent  An IDescent object from worldState.Descents[]
 * @param dict     The main dictionary (key → localized string)
 * @returns        A <tbody> element ready to be inserted into a table
 */
function renderDescentChallenges(descent: IDescent, dict: Record<string, string>): HTMLTableSectionElement
{
	const tbody = document.createElement("tbody");

	for (const challenge of descent.Challenges)
	{
		const tr = document.createElement("tr");

		// Column 1: Level (Index)
		{
			const td = document.createElement("td");
			td.className = "text-center";
			td.textContent = challenge.Index.toString();
			tr.appendChild(td);
		}

		// Column 2: Mission Type
		{
			const td = document.createElement("td");
			td.textContent = challenge.Type;
			tr.appendChild(td);
		}

		// Column 3: Challenge
		{
			const td = document.createElement("td");
			td.textContent = dict[challenge.Challenge] || challenge.Challenge;
			tr.appendChild(td);
		}

		// Column 4: Arena (Level field — map known arenas to emoji with tooltip)
		{
			const td = document.createElement("td");
			const arenaKey = challenge.Level.replace(/.*\//, "").replace(/\.level$/i, "");
			const emoji = ARENA_EMOJI[arenaKey];
			if (emoji)
			{
				const span = document.createElement("span");
				span.textContent = emoji;
				span.setAttribute("data-bs-toggle", "tooltip");
				span.setAttribute("data-bs-title", arenaKey);
				new window.bootstrap.Tooltip(span);
				td.appendChild(span);
			}
			else
			{
				td.textContent = dict[challenge.Level] || arenaKey;
			}
			tr.appendChild(td);
		}

		// Column 5: Specs (array with fallback)
		{
			const td = document.createElement("td");
			if (challenge.Specs && challenge.Specs.length > 0)
			{
				const specs = challenge.Specs.map(spec =>
					dict[spec] || spec.replace(/.*\//, "")
				);
				td.textContent = specs.join(", ");
			}
			else
			{
				td.textContent = "-";
			}
			tr.appendChild(td);
		}

		// Column 6: Auras (array with fallback)
		{
			const td = document.createElement("td");
			if (challenge.Auras && challenge.Auras.length > 0)
			{
				const auras = challenge.Auras.map(aura =>
					dict[aura] || aura.replace(/.*\//, "")
				);
				td.textContent = auras.join(", ");
			}
			else
			{
				td.textContent = "-";
			}
			tr.appendChild(td);
		}

		tbody.appendChild(tr);
	}

	return tbody;
}

// Expose functions globally for use by non-module scripts
(window as any).updateDescendia = updateDescendia;
(window as any).renderDescentChallenges = renderDescentChallenges;
