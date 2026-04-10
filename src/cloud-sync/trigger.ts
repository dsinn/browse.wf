/**
 * Cloud sync trigger — zero-dependency shim that lets any src/ module request
 * a sync push without importing the full sync stack.
 *
 * auth-init.ts wires up the real handler via registerSyncHandler() once the
 * sync service is available.  Until then, calls are silently no-ops.
 */

const DEBOUNCE_MS = 5000;

let handler: (() => Promise<void>) | undefined;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

export function registerSyncHandler(fn: () => Promise<void>): void {
	handler = fn;
}

/** Trigger an immediate (non-debounced) cloud sync push. */
export function triggerCloudSync(): void {
	void handler?.();
}

/** Trigger a debounced cloud sync push (batches rapid successive calls). */
export function triggerCloudSyncWithDebounce(): void {
	if (debounceTimer !== undefined) {
		clearTimeout(debounceTimer);
	}

	debounceTimer = globalThis.setTimeout(() => {
		debounceTimer = undefined;
		void handler?.();
	}, DEBOUNCE_MS);
}

/** Cancel any pending debounced push and fire it immediately. */
export async function flushDebounce(): Promise<void> {
	if (debounceTimer !== undefined) {
		clearTimeout(debounceTimer);
		debounceTimer = undefined;
		await handler?.();
	}
}

(globalThis as any).triggerCloudSync = triggerCloudSync;
(globalThis as any).triggerCloudSyncWithDebounce = triggerCloudSyncWithDebounce;
