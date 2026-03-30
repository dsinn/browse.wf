#!/usr/bin/env node
/**
 * Renders PHP pages to static HTML in public/ for the Vite dev server and tests.
 *
 * Usage:
 *   node scripts/render-pages.js           # Render once
 *   node scripts/render-pages.js --watch   # Watch PHP files and re-render on change
 *
 * Exports: generateEnvConfig, discoverPhpPages, renderPhpFiles,
 *          transformPhpLinks, startPhpServer, stopPhpServer, fetchHtml
 */

import {execSync} from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
import {loadEnv} from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(rootDir, 'public');
const PHP_PORT = Number.parseInt(process.env.PHP_RENDER_PORT || '62969', 10);

// PHP files in the root directory that are not standalone pages
const EXCLUDED_PHP_FILES = new Set([
	'404.php', // Error handler, not a browseable page
]);

/**
 * Start PHP built-in server
 */
export function startPhpServer(options) {
	const {port, cwd, startupDelay = 1000} = options;

	execSync(`php -S localhost:${port} -t . > /dev/null 2>&1 &`, {cwd});

	return new Promise(resolve => {
		setTimeout(resolve, startupDelay);
	});
}

/**
 * Stop PHP server
 */
export function stopPhpServer(port) {
	try {
		execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null`);
	} catch {
		// Server wasn't running
	}
}

/**
 * Fetch HTML from PHP server
 */
export function fetchHtml(url, port) {
	return new Promise((resolve, reject) => {
		http.get(`http://localhost:${port}${url}`, response => {
			let data = '';
			response.on('data', chunk => {
				data += chunk;
			});
			response.on('end', () => resolve(data));
		}).on('error', reject);
	});
}

/**
 * Discover top-level PHP page files (excludes components and non-page files)
 */
export function discoverPhpPages() {
	return fs.readdirSync(rootDir).filter(f => f.endsWith('.php') && !EXCLUDED_PHP_FILES.has(f));
}

/**
 * Render PHP files to static HTML
 */
export async function renderPhpFiles(options) {
	const {files, outputDir, port, transform, keepServerRunning = false} = options;

	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, {recursive: true});
	}

	if (!keepServerRunning) {
		await startPhpServer({port, cwd: rootDir});
	}

	try {
		for (const phpFile of files) {
			const url = `/${phpFile}`;
			const htmlFile = phpFile.replace('.php', '.html');
			const outputPath = path.join(outputDir, htmlFile);

			// eslint-disable-next-line no-await-in-loop
			let html = await fetchHtml(url, port);
			if (transform) {
				html = transform(html);
			}

			fs.writeFileSync(outputPath, html);
			console.log(`  ${phpFile} -> ${htmlFile}`);
		}
	} finally {
		if (!keepServerRunning) {
			stopPhpServer(port);
		}
	}
}

/**
 * Transform PHP links to HTML links in rendered output.
 * Applied universally so all environments (dev, test, GitHub Pages) serve .html URLs.
 */
export function transformPhpLinks(html) {
	return html.replaceAll(/href="\/([^"]+)\.php"/gu, 'href="/$1.html"');
}

/**
 * Generate env-config.js content from .env / environment variables.
 */
export function generateEnvConfig() {
	const ENV_KEYS = [
		'VITE_DATABASE_URL',
		'VITE_DATABASE_ANON_KEY',
		'WARFRAME_API_FRONT_PROXY_BASE_URL',
		'WARFRAME_API_FRONT_PROXY_TOKEN',
	];
	const env = loadEnv('', rootDir, '');
	const values = Object.fromEntries(ENV_KEYS.map(k => [k, env[k] || process.env[k] || '']));

	return `window.__ENV__ = ${JSON.stringify(values)};\n`;
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

	console.log('Watching for changes...\n');

	const IGNORED_DIRS = /\.git|dist|node_modules|public|test|typestripped|vendor/u;
	const phpWatcher = chokidar.default.watch(rootDir, {
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
