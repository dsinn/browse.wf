#!/usr/bin/env node
import process from 'node:process';
import {concurrently} from 'concurrently';

const {result} = concurrently([
	{command: 'npx tsc --watch', name: 'tsc'},
	{command: 'node esbuild.config.js --watch', name: 'esbuild'},
	{command: 'node scripts/render-pages.js --watch', name: 'render', restartTries: -1},
	{command: 'vite --config vitest.config.ts', name: 'vite'},
]);

let isInterrupted = false;
process.on('SIGINT', () => {
	isInterrupted = true;
});

try {
	await result;
} catch {
	if (!isInterrupted) {
		console.error('\u{7}\n*** A dev server process exited unexpectedly. ***\n');
		process.exit(1);
	}
}
