/**
 * Pure data transformation layer for Descendia (Devil's Lair) challenges.
 * No DOM dependencies — usable in both browser and Node.js environments.
 *
 * Consumed by:
 *   - src/descendia.ts              (browser DOM rendering, via globals)
 *   - scripts/post-weekly-forecast.js (Node.js, via compiled descendia-data.mjs)
 */

interface IDescentChallenge
{
	Index: number;
	Type: string;
	Challenge: string;
	Level: string;
	Specs: string[];
	Auras: string[];
}

interface IDescent
{
	Challenges: IDescentChallenge[];
}

interface IDescentChallengeRow
{
	index: number;
	type: string;         // raw value, e.g. "DT_PROTOFRAME" — use for logic checks
	typeLabel: string;    // display-ready, e.g. "Protoframe"
	challenge: string;    // resolved display text
	arenaKey: string;     // clean key, e.g. "ArenaAvocado"
	arenaEmoji: string | null;
	arenaFallback: string; // dict[Level] || arenaKey — used when arenaEmoji is null
	specs: string[];      // resolved; empty array means render as "-"
	auras: string[];      // resolved; empty array means render as "-"
}

export const ARENA_EMOJI: Record<string, string> = {
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
	SpecialChallengeArena01: "🐴",
	SpecialChallengeArena02: "🐴",
	SpecialChallengeArena03: "🐴",
};

export function resolveDescentChallenges(
	descent: IDescent,
	dict: Record<string, string>
): IDescentChallengeRow[]
{
	const tail = (p: string) => p.split("/").pop() ?? p;
	const toWords = (s: string) => s.replace(/(?<=.)(?=[A-Z])/g, " ");
	const toTitleCase = (s: string) => s.replace(/\w+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
	const TYPE_LABEL_CORRECTIONS: Record<string, string> = {
		"Presure Gauge": "Pressure Gauge",
	};

	return descent.Challenges.map(ch =>
	{
		const arenaKey = ch.Level.replace(/.*\//, "").replace(/\.level$/i, "");
		const rawTypeLabel = toTitleCase(ch.Type.replace(/^DT_/, "").replace(/_/g, " "));
		const typeLabel = TYPE_LABEL_CORRECTIONS[rawTypeLabel] ?? rawTypeLabel;
		return {
			index: ch.Index,
			type: ch.Type,
			typeLabel,
			challenge: dict[ch.Challenge] || toWords(tail(ch.Challenge)),
			arenaKey,
			arenaEmoji: ARENA_EMOJI[arenaKey] ?? null,
			arenaFallback: dict[ch.Level] || arenaKey,
			specs: ch.Specs?.length ? ch.Specs.map(s => dict[s] || tail(s)) : [],
			auras: ch.Auras?.length ? ch.Auras.map(a => dict[a] || tail(a)) : [],
		};
	});
}

// Expose globals for browser classic scripts; guard allows this file to run in Node.js too
if (typeof window !== "undefined")
{
	(window as any).resolveDescentChallenges = resolveDescentChallenges;
	(window as any).ARENA_EMOJI = ARENA_EMOJI;
}
