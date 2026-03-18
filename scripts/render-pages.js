#!/usr/bin/env node
/**
 * Renders PHP pages to static HTML in public/ for the Vite dev server.
 *
 * Usage:
 *   node scripts/render-pages.js           # Render once
 *   node scripts/render-pages.js --watch   # Watch PHP files and re-render on change
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
import {
	discoverPhpPages,
	renderPhpFiles,
	startPhpServer,
	stopPhpServer,
	fetchHtml,
} from '../helpers/php-renderer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(rootDir, 'public');
const PHP_PORT = Number.parseInt(process.env.PHP_RENDER_PORT || '62969', 10);

/**
 * Strip .php extensions from links so Vite can serve extensionless URLs.
 * Also inject env vars from .env for local dev.
 */
function transformForDev(html) {
	return html
	// Strip .php from internal links (Vite serves extensionless)
		.replaceAll(/href="\/([^"]+)\.php"/gu, 'href="/$1"')
	// Env-config.php is a PHP script that outputs JS; rewrite to the pre-rendered .js file
		.replaceAll('src="env-config.php"', 'src="env-config.js"');
}

async function renderOnce(serverAlreadyRunning = false) {
	if (!serverAlreadyRunning) {
		await startPhpServer({port: PHP_PORT, cwd: rootDir});
	}

	try {
		const files = discoverPhpPages();
		console.log(`Rendering ${files.length} PHP pages...`);
		await renderPhpFiles({
			files,
			outputDir: OUTPUT_DIR,
			port: PHP_PORT,
			transform: transformForDev,
			keepServerRunning: true, // We manage the server ourselves
		});

		// Render env-config.php (outputs JS, loaded as <script src="env-config.php">)
		const envJs = await fetchHtml('/env-config.php', PHP_PORT);
		fs.writeFileSync(path.join(OUTPUT_DIR, 'env-config.js'), envJs);
		console.log('  env-config.php -> env-config.js');

		console.log('Done.\n');
	} finally {
		if (!serverAlreadyRunning) {
			stopPhpServer(PHP_PORT);
		}
	}
}

async function watchMode() {
	const chokidar = await import('chokidar');

	// Start PHP server once for watch mode
	await startPhpServer({port: PHP_PORT, cwd: rootDir});

	const cleanup = () => {
		stopPhpServer(PHP_PORT);

		process.exit(0);
	};

	process.on('SIGINT', cleanup);
	process.on('SIGTERM', cleanup);

	// Initial render (server already running)
	await renderOnce(true);

	console.log('Watching PHP files for changes...\n');

	const IGNORED_DIRS = /\.git|dist|node_modules|public|typestripped|vendor/u;
	const watcher = chokidar.default.watch(rootDir, {
		ignored(filePath, stats) {
			if (!stats) {
				return false;
			}

			if (stats.isDirectory()) {
				return IGNORED_DIRS.test(filePath);
			}

			return !filePath.endsWith('.php') && !filePath.endsWith('.html');
		},
		persistent: true,
		ignoreInitial: true,
	});

	let renderTimer;
	const scheduleRender = filePath => {
		console.log(`Changed: ${filePath}`);
		clearTimeout(renderTimer);
		renderTimer = setTimeout(async () => {
			await renderOnce(true);
			console.log('Watching PHP files for changes...\n');
		}, 300);
	};

	watcher.on('change', scheduleRender);
	watcher.on('add', scheduleRender);
}

// CLI
if (process.argv.includes('--watch') || process.argv.includes('-w')) {
	// eslint-disable-next-line unicorn/prefer-top-level-await
	watchMode();
} else {
	renderOnce().then(() => {
		process.exit(0);
		// eslint-disable-next-line unicorn/prefer-top-level-await
	}).catch(error => {
		console.error('Render failed:', error);

		process.exit(1);
	});
}
