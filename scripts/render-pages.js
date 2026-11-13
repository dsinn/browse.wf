#!/usr/bin/env node
/**
 Renders PHP pages to static HTML in public/ for the Vite dev server and tests.

 Usage:
 node scripts/render-pages.js           # Render once
 node scripts/render-pages.js --watch   # Watch PHP files and re-render on change
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
import {
	discoverPhpPages,
	fetchHtml,
	generateEnvConfig,
	renderPhpFiles,
	startPhpServer,
	stopPhpServer,
	transformPhpLinks,
} from './render-pages-lib.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(rootDir, 'public');
const PHP_PORT = Number(process.env.PHP_RENDER_PORT || '62969');

async function renderOnce(isServerAlreadyRunning = false) {
	if (!isServerAlreadyRunning) {
		await startPhpServer({port: PHP_PORT, cwd: rootDir});
	}

	try {
		const files = discoverPhpPages();
		console.log(`Rendering ${files.length} PHP pages...`);
		await renderPhpFiles({
			files,
			outputDir: OUTPUT_DIR,
			port: PHP_PORT,
			transform: transformPhpLinks,
			keepServerRunning: true, // We manage the server ourselves
		});

		// Also render the navbar component (used by tests)
		const navbarHtml = transformPhpLinks(await fetchHtml('/components/navbar.php', PHP_PORT));
		fs.writeFileSync(path.join(OUTPUT_DIR, 'navbar.html'), navbarHtml);
		console.log('  components/navbar.php -> navbar.html');

		fs.writeFileSync(path.join(OUTPUT_DIR, 'env-config.js'), generateEnvConfig());
		console.log('  env-config.js generated');

		console.log('Done.\n');
	} finally {
		if (!isServerAlreadyRunning) {
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

	console.log('Watching for changes...\n');

	const IGNORED_DIRS = /\.git|dist|node_modules|public|test|typestripped|vendor/u;
	const phpWatcher = chokidar.default.watch(rootDir, {
		ignored(filePath, stats) {
			if (!stats) {
				return false;
			}

			return stats.isDirectory() ? IGNORED_DIRS.test(filePath) : !filePath.endsWith('.php') && !filePath.endsWith('.html');
		},
		persistent: true,
		ignoreInitial: true,
	});

	const probePhpServer = () => new Promise(resolve => {
		http.get(`http://localhost:${PHP_PORT}/`, response => {
			response.resume();
			resolve(true);
		}).on('error', () => resolve(false));
	});

	let renderTimer;
	const scheduleRender = filePath => {
		console.log(`Changed: ${filePath}`);
		clearTimeout(renderTimer);
		renderTimer = setTimeout(async () => {
			if (!await probePhpServer()) {
				console.error('PHP server is not responding; restarting render process...');
				process.exit(1);
			}

			await renderOnce(true);
			console.log('Watching for changes...\n');
		}, 300);
	};

	phpWatcher.on('change', scheduleRender);
	phpWatcher.on('add', scheduleRender);

	const envWatcher = chokidar.default.watch(path.join(rootDir, '.env'), {
		persistent: true,
		ignoreInitial: true,
	});

	let envTimer;
	const scheduleEnvRegen = filePath => {
		console.log(`Changed: ${filePath}`);
		clearTimeout(envTimer);
		envTimer = setTimeout(() => {
			fs.writeFileSync(path.join(OUTPUT_DIR, 'env-config.js'), generateEnvConfig());
			console.log('  env-config.js regenerated');
			console.log('Watching for changes...\n');
		}, 300);
	};

	envWatcher.on('change', scheduleEnvRegen);
	envWatcher.on('add', scheduleEnvRegen);
}

// CLI - only run when executed directly, not when imported as a module
if (process.argv[1] === fileURLToPath(import.meta.url)) {
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
}
