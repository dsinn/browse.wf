/**
 * Pure data transformation layer for Descendia (Devil's Lair) challenges.
 * No DOM dependencies — usable in both browser and Node.js environments.
 *
 * Consumed by:
 *   - src/descendia.ts              (browser DOM rendering, via globals)
 *   - scripts/post-weekly-forecast.js (Node.js, via compiled descendia-data.mjs)
 */

type IDescentChallenge = {
	Index: number;
	Type: string;
	Challenge: string;
	Level: string;
	Specs: string[];
	Auras: string[];
};

type IDescent = {
	Challenges: IDescentChallenge[];
};

type IDescentChallengeRow = {
	index: number;
	type: string; // Raw value, e.g. "DT_PROTOFRAME" — use for logic checks
	typeLabel: string; // Display-ready, e.g. "Protoframe"
	challenge: string; // Resolved display text
	arenaKey: string; // Clean key, e.g. "ArenaAvocado"
	arenaEmoji: string | undefined;
	arenaFallback: string; // Dict[Level] || arenaKey — used when arenaEmoji is null
	specs: string[]; // Resolved; empty array means render as "-"
	auras: string[]; // Resolved; empty array means render as "-"
};

export const ARENA_EMOJI: Record<string, string> = {
	ArenaAvocado: '🥑',
	ArenaBagel: '🥯',
	ArenaCherry: '🍒',
	ArenaCoconut: '🥥',
	ArenaEggplant: '🍆',
	ArenaGrape: '🍇',
	ArenaMango: '🥭',
	ArenaMelon: '🍈',
	ArenaPeach: '🍑',
	ArenaWaffle: '🧇',
	BossArenaSmall: '⛽︎',
	BossArenaUriel: '😈',
	ProtoframeRoomHarrow: '👲🏼',
	ProtoframeRoomWisp: '👰🏼‍♀️',
	SpecialChallengeArena01: '🐴',
	SpecialChallengeArena02: '🐴',
	SpecialChallengeArena03: '🐴',
};

export function resolveDescentChallenges(
	descent: IDescent,
	dict: Record<string, string>,
): IDescentChallengeRow[] {
	const tail = (p: string) => p.split('/').pop() ?? p;
	const toWords = (s: string) => s.replaceAll(/(?<=.)(?=[A-Z])/gu, ' ');
	const toTitleCase = (s: string) => s.replaceAll(/\w+/gu, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
	const TYPE_LABEL_CORRECTIONS: Record<string, string> = {
		'Presure Gauge': 'Pressure Gauge',
	};

	return descent.Challenges.map(ch => {
		const arenaKey = ch.Level.replace(/.*\//u, '').replace(/\.level$/iu, '');
		const rawTypeLabel = toTitleCase(ch.Type.replace(/^DT_/u, '').replaceAll('_', ' '));
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
if (globalThis.window !== undefined) {
	(globalThis as any).resolveDescentChallenges = resolveDescentChallenges;
	(globalThis as any).ARENA_EMOJI = ARENA_EMOJI;
}
