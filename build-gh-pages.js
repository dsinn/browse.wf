#!/usr/bin/env node
/**
 * Build script for GitHub Pages deployment
 *
 * This script:
 * 1. Compiles TypeScript to JavaScript (typestripped/)
 * 2. Renders all PHP files to static HTML
 * 3. Prepares files for deployment to gh-pages branch
 */

import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
import {
	discoverPhpPages, startPhpServer, stopPhpServer, fetchHtml,
} from './helpers/php-renderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUILD_DIR = path.join(__dirname, 'dist');
const PHP_SERVER_PORT = 60_980; // Different port for build
const CACHE_BUSTER = process.env.GITHUB_SHA?.slice(0, 8) ?? Date.now().toString();

/**
 * Fix paths for GitHub Pages base path
 * Converts root-relative paths to work with /browse.wf/ base
 */
function fixPathsForGitHubPages(html) {
	const BASE_PATH = '/browse.wf';

	return html
	// Fix .php links to .html (e.g., href="/live.php" → href="/browse.wf/live.html")
		.replaceAll(/href="\/([^"]+\.php)"/gu, (match, file) => `href="${BASE_PATH}/${file.replace('.php', '.html')}"`)
	// Fix root path (e.g., href="/" → href="/browse.wf/")
		.replaceAll(/href="\/"(?=[^/]|")/gu, `href="${BASE_PATH}/"`)
	// Fix script sources (e.g., src="/common.js" → src="/browse.wf/common.js")
		.replaceAll(/src="\/([^"]+\.js)"/gu, `src="${BASE_PATH}/$1"`)
	// GitHub Pages caches assets for 10 minutes; append cache-buster to all local assets
		.replaceAll(/src="((?:typestripped\/|common\.js|env-config\.js|supplemental-data\/)[^"?]*)(?:\?[^"]*)?"/gu, `src="$1?${CACHE_BUSTER}"`)
		.replaceAll(/href="(src\/[^"?]+\.css)(?:\?[^"]*)?"/gu, `href="$1?${CACHE_BUSTER}"`);
}

/**
 * Render PHP file to HTML
 */
async function renderPhpFile(phpFile) {
	const url = `/${phpFile}`;
	const htmlFile = phpFile.replace('.php', '.html');
	const outputPath = path.join(BUILD_DIR, htmlFile);

	console.log(`  Rendering ${phpFile} → ${htmlFile}`);

	try {
		let html = await fetchHtml(url, PHP_SERVER_PORT);

		// Fix paths for GitHub Pages
		html = fixPathsForGitHubPages(html);

		// Write HTML file
		const buildContent = `<!--
  Generated: ${new Date().toISOString()}
  Source: ${phpFile}

  This is a static build for GitHub Pages
  Original site: https://browse.wf
-->
${html}`;

		fs.writeFileSync(outputPath, buildContent);
	} catch (error) {
		console.error(`  ✗ Failed to render ${phpFile}: ${error.message}`);
		throw error;
	}
}

/**
 * Copy directory recursively
 */
function copyDirectory(src, dest) {
	if (!fs.existsSync(dest)) {
		fs.mkdirSync(dest, {recursive: true});
	}

	const entries = fs.readdirSync(src, {withFileTypes: true});

	for (const entry of entries) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);

		if (entry.isDirectory()) {
			copyDirectory(srcPath, destPath);
		} else {
			fs.copyFileSync(srcPath, destPath);
		}
	}
}

/**
 * Main build process
 */
async function build() {
	console.log('🔨 Building for GitHub Pages...\n');

	try {
		// Clean and create build directory
		console.log('📁 Preparing build directory...');
		if (fs.existsSync(BUILD_DIR)) {
			fs.rmSync(BUILD_DIR, {recursive: true});
		}

		fs.mkdirSync(BUILD_DIR, {recursive: true});
		console.log('✓ Build directory ready\n');

		// Compile TypeScript
		console.log('📦 Compiling TypeScript...');
		try {
			execSync('npx tsc', {stdio: 'inherit', cwd: __dirname});
			console.log('✓ TypeScript compiled\n');
		} catch {
			// TypeScript still emits files even with type errors
			// Continue build if JS files were generated
			console.warn('⚠️  TypeScript compilation had type errors, but JS files were generated\n');
		}

		// Bundle fork modules
		console.log('📦 Bundling fork modules...');
		execSync('node esbuild.config.js', {stdio: 'inherit', cwd: __dirname});
		console.log('✓ Fork bundle built\n');

		// Generate env-config.js for GitHub Pages
		console.log('🔧 Generating env-config.js...');
		const envConfig = {
			VITE_ENV: 'production', // Always 'production' for GitHub Pages build
			VITE_DATABASE_URL: process.env.VITE_DATABASE_URL || '',
			VITE_DATABASE_ANON_KEY: process.env.VITE_DATABASE_ANON_KEY || '',
			WARFRAME_API_FRONT_PROXY_BASE_URL: process.env.WARFRAME_API_FRONT_PROXY_BASE_URL || '',
			WARFRAME_API_FRONT_PROXY_TOKEN: process.env.WARFRAME_API_FRONT_PROXY_TOKEN || '',
		};
		const envConfigContent = `window.__ENV__ = ${JSON.stringify(envConfig)};\n`;
		fs.writeFileSync(path.join(BUILD_DIR, 'env-config.js'), envConfigContent);
		console.log('✓ env-config.js generated\n');

		// Start PHP server for rendering
		console.log('🚀 Starting PHP server...');
		await startPhpServer({
			port: PHP_SERVER_PORT,
			cwd: __dirname,
			startupDelay: 1500,
		});
		console.log('✓ PHP server started\n');

		// Render all PHP files
		const PHP_FILES = discoverPhpPages();
		console.log(`🎨 Rendering ${PHP_FILES.length} PHP files to HTML...`);
		for (const phpFile of PHP_FILES) {
			// eslint-disable-next-line no-await-in-loop
			await renderPhpFile(phpFile);
		}

		console.log('✓ All PHP files rendered\n');

		// Stop PHP server
		stopPhpServer(PHP_SERVER_PORT);
		console.log('\n✓ PHP server stopped');

		// Copy compiled JavaScript
		console.log('📋 Copying assets...');
		const typestrippedSrc = path.join(__dirname, 'typestripped');
		const typestrippedDest = path.join(BUILD_DIR, 'typestripped');
		if (fs.existsSync(typestrippedSrc)) {
			copyDirectory(typestrippedSrc, typestrippedDest);
			console.log('  ✓ Copied typestripped/');
		}

		// Copy common.js
		const commonJsSrc = path.join(__dirname, 'common.js');
		if (fs.existsSync(commonJsSrc)) {
			fs.copyFileSync(commonJsSrc, path.join(BUILD_DIR, 'common.js'));
			console.log('  ✓ Copied common.js');
		}

		// Copy supplemental-data
		const suppDataSrc = path.join(__dirname, 'supplemental-data');
		const suppDataDest = path.join(BUILD_DIR, 'supplemental-data');
		if (fs.existsSync(suppDataSrc)) {
			copyDirectory(suppDataSrc, suppDataDest);
			console.log('  ✓ Copied supplemental-data/');
		}

		// Copy src directory (for CSS and other assets)
		const srcDataSrc = path.join(__dirname, 'src');
		const srcDataDest = path.join(BUILD_DIR, 'src');
		if (fs.existsSync(srcDataSrc)) {
			copyDirectory(srcDataSrc, srcDataDest);
			console.log('  ✓ Copied src/');
		}

		// Copy warframe-public-export-plus data
		// This package contains game data files that the app fetches at runtime.
		// Requires npm ci to have been run first to populate node_modules/.
		const wfExportSrc = path.join(__dirname, 'node_modules/warframe-public-export-plus');
		const wfExportDest = path.join(BUILD_DIR, 'warframe-public-export-plus');
		if (!fs.existsSync(wfExportSrc)) {
			throw new Error('warframe-public-export-plus not found in node_modules/. '
				+ 'Run "npm ci" before building.');
		}

		copyDirectory(wfExportSrc, wfExportDest);
		console.log('  ✓ Copied warframe-public-export-plus/');

		// Copy static text files
		const staticFiles = ['arbys.txt', 'sp-incursions.txt', 'arbys-old.txt'];
		for (const file of staticFiles) {
			const srcPath = path.join(__dirname, file);
			if (fs.existsSync(srcPath)) {
				fs.copyFileSync(srcPath, path.join(BUILD_DIR, file));
				console.log(`  ✓ Copied ${file}`);
			}
		}

		console.log('\n✅ Build complete! Output: dist/');
		console.log('\nFiles ready for deployment to gh-pages branch.');
	} catch (error) {
		console.error('\n❌ Build failed:', error.message);
		stopPhpServer(PHP_SERVER_PORT);
		process.exit(1);
	}
}

// Run build
// eslint-disable-next-line unicorn/prefer-top-level-await
build();
