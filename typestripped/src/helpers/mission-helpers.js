/**
 * Canonicalizes a mission type string for filter key lookup.
 * MT_INTEL and MT_SPY both represent "Spy" to players, so they share one filter key.
 */
export function canonicalizeMissionType(missionType) {
    return missionType === 'MT_INTEL' ? 'MT_SPY' : missionType;
}
//# sourceMappingURL=mission-helpers.js.map