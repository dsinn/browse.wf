#!/usr/bin/env node
import {concurrently} from 'concurrently';

concurrently(
	[
		{command: 'npx tsc --watch', name: 'tsc'},
		{command: 'node esbuild.config.js --watch', name: 'esbuild'},
		{command: 'node scripts/render-pages.js --watch', name: 'render', restartTries: -1},
		{command: 'vite --config vitest.config.ts', name: 'vite'},
	],
	{killOthers: ['failure']},
);
