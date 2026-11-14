# /live Page Architecture

**Date:** 2026-03-28

The `/live` page displays real-time Warframe world state data: fissures, invasions, bounties, weekly missions, etc. It is the primary motivation for this fork's existence. This document covers the fork's module delegation strategy, how scripts are loaded and communicate, and how cards manage their own update lifecycles.

## Module Delegation

The fork's modifications to the live page are kept in dedicated files under `src/live/` rather than added directly to `live.ts`. This has several benefits:

1. **Testability.** Delegated modules can be imported and tested with Vitest (unit/jsdom), which is fast and covers the majority of scenarios. Code that remains in `live.ts` can only be tested with Playwright E2E tests, which are slower and better reserved for behavioural/interaction testing. Following the testing pyramid, Vitest is strongly preferred where possible.

2. **Easier merge conflict resolution.** Every line we change in `live.ts` is a potential merge conflict when pulling upstream updates. Keeping our changes minimal — typically a single guard clause or a short mutation loop per feature — means conflicts are rare and easy to resolve.

3. **Avoid growing a God file.** Upstream `live.ts` is about 1800 lines. The fork has actually reduced that count by several hundred lines by extracting the heavily modified sections into separate modules, making the remaining file easier to navigate.

4. **Strict linting for fork code.** Upstream uses a minimal `tsconfig.json` with most checks disabled. Fork files are covered by a separate `tsconfig.lint.json` in strict mode, catching type errors and enforcing consistent style — without having to fix pre-existing upstream violations first.

## Data Flow Overview

```text
live.php loads
    ↓
live.ts: fetchWorldState() → worldState global
    ↓
live.ts calls update functions (e.g. updateFissures(), updateWeekly())
    ↓
fork modules in src/live/ render specific cards using worldState
    ↓
timers schedule re-renders at each item's expiry time
```

The world state is fetched by `live.ts` and stored on `globalThis.worldState`. Fork modules treat this as a read-only input. It is re-fetched every minute while the tab is visible, and again whenever the tab becomes visible. Each fetch dispatches a `worldstate-updated` event.

## Script Loading

The fork's TypeScript modules are compiled by esbuild into a single bundle: `typestripped/src-bundle.js`. This bundle is loaded by `components/commonjs.html`, which `live.php` includes **before** `live.js`, so all fork globals are available when `live.ts` starts executing.

Upstream scripts (`live.js`, `common.js`) are loaded without `type="module"`, so they cannot use ES6 `import` or `export`. Instead:

- Fork modules put a function on `window` at module load time only when a non-module script such as `live.ts` calls it
- `live.ts` calls those functions by name; no existence checks are needed because the bundle always loads first
- Fork modules call each other through ES `import`, never through `window`, so `window` holds only what the non-module scripts need

## Expiry-Triggered Re-renders

Upstream schedules re-renders centrally. It keeps a handful of `window.refresh_*_at` globals (`refresh_fissures_at`, `refresh_weekly_at`, …), and a shared loop in `live.ts` checks them every 500 ms and calls the matching update function by name. A separate loop rewrites every countdown badge in the document every 100 ms.

The fork deliberately inverts this: each card schedules its own re-renders. `src/timer-registry.ts` knows nothing about cards. A module passes its own update function to `scheduleAt(expiry, ...)`, and its scheduling state stays private in module scope rather than on `window`. Badges register with the same 250 ms tick, which only visits what was registered and only touches the DOM when a badge's text changes. This avoids several problems with the global timers:

- **Each card shapes its own scheduling state.** Each upstream global holds one timestamp, so code with several expiries keeps the earliest by hand (`setFissuresExpiry()`, `setWorldStateExpiry()`), and a slot must be cleared or moved forward after it fires, or the loop calls the update function again on every check. Fork modules hold what they need: a `Set` of scheduled expiries in `fissures.ts`, a `Map` of cancel functions in `invasions.ts`.
- **Cards don't share a schedule.** Upstream's sorties, Archon Hunt, Darvo's deal, Baro, alerts and Archimedea all fold their expiries into the one `refresh_world_state_at` slot through `setWorldStateExpiry()`, and when it fires, `updateWorldState()` re-fetches and re-renders all of them. A fork card's schedule belongs to that card alone.
- **Callbacks can be cancelled one at a time.** `scheduleAt` returns a cancel function; upstream can only clear a whole slot.
- **New cards don't touch `live.ts`.** Upstream needs a new `Window` property and a new branch in the shared loop, both on upstream lines (see [Module Delegation](#module-delegation), reason 2).
- **Unit-testable.** The upstream loop can only be exercised by Playwright. `timer-registry.ts` has its own unit tests, and card modules test their scheduling with Vitest's fake timers.

Several cards need to re-render when their content expires, without waiting for the next world state fetch (which occurs every minute while the tab is visible). The pattern is:

1. After rendering, compute the expiry time of each active item
2. Register a callback with `scheduleAt(expiry, ...)`
3. The callback calls the same update function again

`scheduleAt` is deliberately not a `setTimeout`, which the fork used before. Browsers count a timeout's delay in time awake, so after the device sleeps it fires late by the length of the sleep. Comparing `Date.now()` on every tick has no such gap.

**Deduplication** is important: the update function may be called multiple times before an item expires (e.g. on filter changes with `shouldForceRender = true`). Each module handles this differently. For example:

- `fissures.ts`: tracks a `Set<number>` of already-scheduled expiries to avoid duplicate callbacks for the same fissure
- `weekly.ts`: bare `scheduleAt`; only one weekly timer exists at a time by design
- `bounty-checkboxes.ts`: `dailyResetTimer ||= scheduleAt(...)` — memoized via `||=`
- `calendar-seasons.ts`: bare `scheduleAt`; only one active season at a time

**Stale data retry**: Some modules (e.g. `weekly.ts`, `calendar-seasons.ts`, `circuit.ts`) retry in 5 seconds with `setTimeout` when worldState doesn't yet have the expected data, rather than rendering an empty state.

### Render Skipping

Each module tracks the data it's concerned about from the last render. If the world state hasn't meaningfully changed since the last render, the re-render is skipped. The `shouldForceRender` parameter (`forceRender` in `live.ts`) bypasses this; it exists primarily for card filters, so that when the user updates their display settings the card re-renders immediately rather than waiting for the next significant world state change.

## Filter Integration Points

`live.ts` calls filter functions by name inline during its render loops; the fork registers its implementations on `globalThis` before `live.ts` runs, so they are transparently picked up. The integration points are intentionally minimal — typically a single guard clause or a mutation loop on the items array — to keep the diff against upstream small. See CLAUDE.md for the rationale and examples.

## Globals from Upstream

Fork modules depend on globals provided by `live.ts` and `common.js`. The globals exposed by `live.ts` are listed at the bottom of that file.
