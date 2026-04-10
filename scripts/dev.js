#!/usr/bin/env node
import process from 'node:process';
import {concurrently} from 'concurrently';

const {result} = concurrently([
	{command: 'npx tsc --watch', name: 'tsc'},
	{command: 'node esbuild.config.js --watch', name: 'esbuild'},
	{command: 'node scripts/render-pages.js --watch', name: 'render', restartTries: -1},
	{command: 'vite --config vitest.config.ts', name: 'vite'},
]);

let interrupted = false;
process.on('SIGINT', () => {
	interrupted = true;
});

try {
	await result;
} catch {
	if (!interrupted) {
		console.error('\u0007\n*** A dev server process exited unexpectedly. ***\n');
		process.exit(1);
	}
}
