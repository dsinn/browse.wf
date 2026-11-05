/**
 * Shared ticker for countdown badges.
 *
 * This exists to improve performance over the upstream in the following ways:
 *
 * - A tick only visits the badges that were registered, instead of searching the whole document
 *   (which is big on the /live page) in a hot loop.
 * - Only touch the DOM when a badge's text actually changed instead of eagerly doing so every tick.
 *
 * Because badges are tracked by element, a registered badge must stay the same node. Re-serializing or
 * cloning its container (e.g. `container.innerHTML += ' '`) replaces it with an unregistered copy that
 * never updates again; use `append()` and friends instead.
 *
 * Badges register an update function that sets their own text; a single interval calls all of them.
 * The interval starts when the first badge registers and then runs for the rest of the page's life.
 * Registered badges are dropped automatically once they have been attached to the DOM and then removed,
 * or once their update function returns false to say it has written its final text. A badge that has
 * not been attached yet is kept, as it may be built well before the page attaches it.
 */
export const TICK_MS = 250;
export const DEFAULT_PENDING_LABEL = 'Pending update';
const badges = new Map();
let intervalId;
/**
 * Default text for a badge whose timer has run out. Single seam for making this customizable.
 */
export function getPendingLabel() {
    return DEFAULT_PENDING_LABEL;
}
/**
 * Sets a badge's text, skipping the DOM write when it hasn't changed.
 */
export function setTimerText(elm, text) {
    if (elm.textContent !== text) {
        elm.textContent = text;
    }
}
function tick() {
    // Pruning always runs so detached badges aren't retained in a background tab; only rendering is skipped
    const { hidden } = document;
    for (const [elm, entry] of badges) {
        if (elm.isConnected) {
            entry.wasConnected = true;
        }
        else {
            if (entry.wasConnected) {
                badges.delete(elm);
            }
            continue;
        }
        if (hidden) {
            continue;
        }
        if (!entry.update()) {
            badges.delete(elm);
        }
    }
}
/**
 * Updates the badge now, then again every tick until `update` returns false (or the badge is removed
 * from the DOM). `update` should set the badge's text, reading any data attributes at call time, and
 * return whether the badge still needs updating. A badge whose first update returns false is never
 * registered.
 */
export function registerTimerBadge(elm, update) {
    if (!update()) {
        return;
    }
    badges.set(elm, { update, wasConnected: elm.isConnected });
    intervalId ??= setInterval(tick, TICK_MS);
}
/**
 * Drops all registered badges and stops the ticker. For tests, which swap fake timers in and out.
 */
export function resetTimerRegistry() {
    badges.clear();
    clearInterval(intervalId);
    intervalId = undefined;
}
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        tick();
    }
});
//# sourceMappingURL=timer-registry.js.map