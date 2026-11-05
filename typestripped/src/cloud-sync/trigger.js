/**
 * Cloud sync trigger — zero-dependency shim that lets any src/ module request
 * a sync push without importing the full sync stack.
 *
 * auth-init.ts wires up the real handler via registerSyncHandler() once the
 * sync service is available.  Until then, calls are silently no-ops.
 */
const DEBOUNCE_MS = 5000;
let handler;
let debounceTimer;
export function registerSyncHandler(fn) {
    handler = fn;
}
/** Trigger an immediate (non-debounced) cloud sync push. */
export function triggerCloudSync() {
    void handler?.();
}
/** Trigger a debounced cloud sync push (batches rapid successive calls). */
export function triggerCloudSyncWithDebounce() {
    if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
    }
    debounceTimer = globalThis.setTimeout(() => {
        debounceTimer = undefined;
        void handler?.();
    }, DEBOUNCE_MS);
}
/** Cancel any pending debounced push and fire it immediately. */
export async function flushDebounce() {
    if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
        debounceTimer = undefined;
        await handler?.();
    }
}
/**
 * Returns a promise that resolves when cloud sync emits a status event,
 * or 'timeout' if no event fires. Used to gate initialization on cloud sync
 * readiness.
 */
export async function waitForCloudSync() {
    return new Promise(resolve => {
        for (const type of ['cloud-sync-complete', 'cloud-sync-unavailable', 'cloud-sync-unauthenticated', 'cloud-sync-error']) {
            globalThis.addEventListener(type, () => {
                resolve(type.replace('cloud-sync-', ''));
            }, { once: true });
        }
        setTimeout(() => {
            resolve('timeout');
        }, 5000);
    });
}
window.triggerCloudSync = triggerCloudSync;
window.triggerCloudSyncWithDebounce = triggerCloudSyncWithDebounce;
//# sourceMappingURL=trigger.js.map