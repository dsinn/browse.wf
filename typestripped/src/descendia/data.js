/**
 * Pure data transformation layer for Descendia (Devil's Lair) challenges.
 * No DOM dependencies — usable in both browser and Node.js environments.
 *
 * Consumed by:
 *   - src/descendia.ts              (browser DOM rendering, via globals)
 *   - scripts/post-weekly-forecast.js (Node.js, via compiled descendia-data.mjs)
 */
export const ARENA_EMOJI = {
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
    BossArenaSmall: '🐙',
    BossArenaUriel: '😈',
    ProtoframeRoomHarrow: '👲🏼',
    ProtoframeRoomWisp: '👰🏼‍♀️',
    SpecialChallengeArena01: '🐴',
    SpecialChallengeArena02: '🐴',
    SpecialChallengeArena03: '🐴',
};
export function resolveDescentChallenges(descent, dict) {
    const tail = (p) => p.split('/').pop() ?? p;
    const toWords = (s) => s.replaceAll(/(?<=[a-z])(?=[A-Z])|(?<=.)(?=[A-Z](?:[a-z]|$))/gu, ' ');
    const toTitleCase = (s) => s.replaceAll(/\w+/gu, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
    const TYPE_LABEL_CORRECTIONS = {
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
            challenge: dict[ch.Challenge] || toWords(tail(ch.Challenge).replace(/^NC_/u, '')),
            arenaKey,
            arenaEmoji: ARENA_EMOJI[arenaKey] ?? '❔',
            specs: ch.Specs?.length ? ch.Specs.map(s => dict[s] || toWords(tail(s).replace(/^CoH/u, ''))) : [],
            auras: ch.Auras?.length ? ch.Auras.map(a => dict[a] || toWords(tail(a).replace(/^CoH/u, ''))) : [],
        };
    });
}
// Expose globals for browser classic scripts; guard allows this file to run in Node.js too
if (globalThis.window !== undefined) {
    window.resolveDescentChallenges = resolveDescentChallenges;
    window.ARENA_EMOJI = ARENA_EMOJI;
}
//# sourceMappingURL=data.js.map