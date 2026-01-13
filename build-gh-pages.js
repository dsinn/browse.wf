#!/usr/bin/env node
/**
 * Build script for GitHub Pages deployment
 *
 * This script:
 * 1. Compiles TypeScript to JavaScript (typestripped/)
 * 2. Renders all PHP files to static HTML
 * 3. Prepares files for deployment to gh-pages branch
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { startPhpServer, stopPhpServer, fetchHtml } = require('./helpers/php-server');

const BUILD_DIR = path.join(__dirname, 'dist');
const PHP_SERVER_PORT = 60980; // Different port for build

// PHP files to render (excluding components)
const PHP_FILES = [
  '404.php',
  'about.php',
  'arbys.php',
  'color-picker.php',
  'glyphs.php',
  'index.php',
  'inventory.php',
  'invigorations.php',
  'kim-convo-locator.php',
  'kimulacrum.php',
  'live.php',
  'platform-suffix.php',
  'prime-vault.php',
  'profile.php',
  'rivencalc.php',
  'text-icons.php',
];


/**
 * Fix paths for GitHub Pages base path
 * Converts root-relative paths to work with /browse.wf/ base
 */
function fixPathsForGitHubPages(html) {
  const BASE_PATH = '/browse.wf';

  return html
    // Fix .php links to .html (e.g., href="/live.php" → href="/browse.wf/live.html")
    .replace(/href="\/([^"]+\.php)"/g, (match, file) => `href="${BASE_PATH}/${file.replace('.php', '.html')}"`)
    // Fix root path (e.g., href="/" → href="/browse.wf/")
    .replace(/href="\/"(?=[^/]|")/g, `href="${BASE_PATH}/"`)
    // Fix script sources (e.g., src="/common.js" → src="/browse.wf/common.js")
    .replace(/src="\/([^"]+\.js)"/g, `src="${BASE_PATH}/$1"`)
    // Fix env-config.php to env-config.js (PHP won't execute on GitHub Pages)
    .replace(/src="env-config\.php"/g, 'src="env-config.js"');
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
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

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
      fs.rmSync(BUILD_DIR, { recursive: true });
    }
    fs.mkdirSync(BUILD_DIR, { recursive: true });
    console.log('✓ Build directory ready\n');

    // Compile TypeScript
    console.log('📦 Compiling TypeScript...');
    try {
      execSync('npx tsc', { stdio: 'inherit', cwd: __dirname });
      console.log('✓ TypeScript compiled\n');
    } catch (error) {
      // TypeScript still emits files even with type errors
      // Continue build if JS files were generated
      console.warn('⚠️  TypeScript compilation had type errors, but JS files were generated\n');
    }

    // Generate env-config.js for GitHub Pages
    console.log('🔧 Generating env-config.js...');
    const envConfig = {
      VITE_DATABASE_URL: process.env.VITE_DATABASE_URL || '',
      VITE_DATABASE_ANON_KEY: process.env.VITE_DATABASE_ANON_KEY || ''
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
    console.log('🎨 Rendering PHP files to HTML...');
    for (const phpFile of PHP_FILES) {
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
build();
