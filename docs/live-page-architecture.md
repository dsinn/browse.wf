# /live Page Architecture

**Date:** 2026-03-28

The `/live` page displays real-time Warframe world state data: fissures, invasions, bounties, weekly missions, etc. It is the primary motivation for this fork's existence. This document covers the fork's module delegation strategy, how scripts are loaded and communicate, and how cards manage their own update lifecycles.

## Module Delegation

The fork's modifications to the live page are kept in dedicated files under `src/live/` rather than added directly to `live.ts`. This has several benefits:

1. **Testability.** Delegated modules can be imported and tested with Vitest (unit/jsdom), which is fast and covers the majority of scenarios. Code that remains in `live.ts` can only be tested with Playwright E2E tests, which are slower and better reserved for behavioural/interaction testing. Following the testing pyramid, Vitest is strongly preferred where possible.

2. **Easier merge conflict resolution.** Every line we change in `live.ts` is a potential merge conflict when pulling upstream updates. Keeping our changes minimal — typically a single guard clause or a short mutation loop per feature — means conflicts are rare and easy to resolve.

3. **Avoid growing a God file.** Upstream `live.ts` is nearly 2000 lines. The fork has actually reduced that count by several hundred lines by extracting the heavily modified sections into separate modules, making the remaining file easier to navigate.

4. **Strict linting for fork code.** Upstream uses a minimal `tsconfig.json` with most checks disabled. Fork files are covered by a separate `tsconfig.lint.json` in strict mode, catching type errors and enforcing consistent style — without having to fix pre-existing upstream violations first.

## Data Flow Overview

```
live.php loads
    ↓
live.ts (upstream): fetchWorldState() → worldState global
    ↓
live.ts calls update functions (e.g. updateFissures(), updateWeekly())
    ↓
fork modules in src/live/ render specific cards using worldState
    ↓
timers schedule re-renders at each item's expiry time
```

The world state is fetched by upstream `live.ts` and stored on `globalThis.worldState`. Fork modules treat this as a read-only input.

## Script Loading

The fork's TypeScript modules are compiled by esbuild into a single bundle: `typestripped/src-bundle.js`. This bundle is loaded **before** `live.js` in `live.php`, so all fork globals are available when `live.ts` starts executing.

Upstream scripts (`live.js`, `common.js`) are loaded without `type="module"`, so they cannot use ES6 `import` or `export`. Instead:

- Fork modules export functions onto `globalThis` at module load time
- Upstream calls those functions by name, guarded with existence checks

## Expiry-Triggered Re-renders

Upstream schedules card updates by storing a large number of timers on the `window` object and checking them in a tight polling loop that runs several times a second. The fork instead schedules targeted `setTimeout` calls that fire precisely when an item expires, avoiding continuous polling entirely.

Several cards need to re-render when their content expires, without waiting for the next world state fetch (which occurs every minute). The pattern is:

1. After rendering, compute the expiry time of each active item
2. Schedule a `setTimeout` for `expiry - Date.now()`
3. The callback calls the same update function again

**Deduplication** is important: the update function may be called multiple times before an item expires (e.g. on filter changes with `forceRender = true`). Each module handles this differently. For example:

- `fissures.ts`: tracks a `Set<number>` of already-scheduled expiries to avoid duplicate timers for the same fissure
- `weekly.ts`: bare `setTimeout`; only one weekly timer exists at a time by design
- `bounty-checkboxes.ts`: `dailyResetTimer ||= setTimeout(...)` — memoized via `||=`
- `calendar-seasons.ts`: bare `setTimeout`; only one active season at a time

**Stale data retry**: Some modules (e.g. `weekly.ts`, `calendar-seasons.ts`) retry in 5 seconds when worldState doesn't yet have the expected data, rather than rendering an empty state.

### Render Skipping

Each module tracks the data it's concerned about from the last render. If the world state hasn't meaningfully changed since the last render, the re-render is skipped. The `forceRender` parameter bypasses this; it exists primarily for card filters, so that when the user updates their display settings the card re-renders immediately rather than waiting for the next significant world state change.

## Filter Integration Points

`live.ts` calls filter functions by name inline during its render loops; the fork registers its implementations on `globalThis` before `live.ts` runs, so they are transparently picked up. The integration points are intentionally minimal — typically a single guard clause or a mutation loop on the items array — to keep the diff against upstream small. See CLAUDE.md for the rationale and examples.

## Globals from Upstream

Fork modules depend on globals provided by `live.ts` and `common.js`. The globals exposed by `live.ts` are listed at the bottom of that file.
