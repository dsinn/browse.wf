/**
 Helpers for rendering PHP pages to static HTML. Used by render-pages.js (the CLI) and build-gh-pages.js.

 Exports: generateEnvConfig, discoverPhpPages, renderPhpFiles,
 transformPhpLinks, startPhpServer, stopPhpServer, fetchHtml
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

// PHP files in the root directory that are not standalone pages
const EXCLUDED_PHP_FILES = new Set([
	'404.php', // Error handler, not a browseable page
]);

/**
 Start PHP built-in server
 @param {{port: number, cwd?: string, startupDelay?: number}} options - Port to listen on, working directory,
 and milliseconds to wait for the server to start
 */
export function startPhpServer(options) {
	const {port, cwd, startupDelay = 1000} = options;

	execSync(`php -S localhost:${port} -t . > /dev/null 2>&1 &`, {cwd});

	return new Promise(resolve => {
		setTimeout(resolve, startupDelay);
	});
}

/**
 Stop the PHP server by killing whatever process is listening on the port
 @param {number} port - Port the server is listening on
 */
export function stopPhpServer(port) {
	try {
		execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null`);
	} catch {
		// Server wasn't running
	}
}

/**
 Fetch HTML from PHP server
 @param {string} url - Root-relative URL path to fetch
 @param {number} port - Port the server is listening on
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
 Discover top-level PHP page files (excludes components and non-page files)
 */
export function discoverPhpPages() {
	return fs.readdirSync(rootDir).filter(f => f.endsWith('.php') && !EXCLUDED_PHP_FILES.has(f));
}

/**
 Render PHP files to static HTML
 @param {{files: string[], outputDir: string, port: number, transform?: (html: string) => string,
 keepServerRunning?: boolean}} options - PHP files to render, where to write the HTML, the server port,
 an optional HTML transform, and whether to leave an already-running server alone
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
 Transform PHP links to HTML links in rendered output.
 Applied universally so all environments (dev, test, GitHub Pages) serve .html URLs.
 @param {string} html - Rendered page HTML
 */
export function transformPhpLinks(html) {
	return html.replaceAll(/href="\/(?<page>[^"]+)\.php"/gu, 'href="/$<page>.html"');
}

/**
 Generate env-config.js content from .env / environment variables.
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
