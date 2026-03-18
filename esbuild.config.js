#!/usr/bin/env node
/**
 * Bundles all fork-specific src/*.ts modules into a single IIFE script.
 *
 * Output: typestripped/src-bundle.js
 *
 * The bundle registers every public function/variable on `window` so that
 * upstream non-module scripts (live.js, arbys.js, etc.) can call them the
 * same way they did before.
 *
 * Usage:
 *   node esbuild.config.js           # one-off build
 *   node esbuild.config.js --watch   # rebuild on change
 */
import process from 'node:process';
import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
	entryPoints: ['src/bundle-entry.ts'],
	bundle: true,
	format: 'iife',
	outfile: 'typestripped/src-bundle.js',
	sourcemap: true,
	target: 'es2021',
	// Exclude packages resolved at runtime (not bundled)
	external: ['warframe-public-export-plus'],
	logLevel: 'info',
};

if (watch) {
	const ctx = await esbuild.context(buildOptions);
	await ctx.watch();
	console.log('Watching for changes...');
} else {
	await esbuild.build(buildOptions);
}
