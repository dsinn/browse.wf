/**
 * Cloud sync trigger — zero-dependency shim that lets any src/ module request
 * a debounced push without importing the full sync stack.
 *
 * auth-init.ts wires up the real handler via registerSyncHandler() once the
 * sync service is available.  Until then, calls are silently no-ops.
 */

let handler: (() => void) | undefined;

export function registerSyncHandler(fn: () => void): void {
	handler = fn;
}

export function triggerCloudSync(): void {
	handler?.();
}

// Expose globally for non-module scripts
(globalThis as any).triggerCloudSync = triggerCloudSync;
