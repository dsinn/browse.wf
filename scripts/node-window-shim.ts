// Allow plain browser scripts (which assign to window) to run in Node.js.
// Must be imported before any script that references `window`.
(globalThis as any).window = globalThis;
