#!/usr/bin/env node
/**
 * Renders PHP files to static HTML for testing
 *
 * Usage:
 *   node test/helpers/render-php.js                    # Render all fixtures
 *   node test/helpers/render-php.js --watch            # Watch mode
 *   node test/helpers/render-php.js navbar             # Render specific fixture
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { startPhpServer, stopPhpServer, fetchHtml } from '../../helpers/php-renderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURES_DIR = path.join(__dirname, '../__fixtures__');
const PHP_SERVER_PORT = process.env.PHP_TEST_PORT || 60970; // Different from dev server

// Fixtures to generate
const FIXTURES = {
  navbar: {
    url: '/components/navbar.php',
    output: 'navbar.html',
    description: 'Navbar component HTML',
  },
  live: {
    url: '/live.php',
    output: 'live.html',
    description: 'Live page full HTML',
  },
  'weekly-forecast': {
    url: '/weekly-forecast.php',
    output: 'weekly-forecast.html',
    description: 'Weekly Forecast page full HTML',
  },
  arbys: {
    url: '/arbys.php',
    output: 'arbys.html',
    description: 'Arbitration Schedule page full HTML',
  },
};


/**
 * Render a single fixture
 */
async function renderFixture(name, config) {
  console.log(`Rendering ${name}...`);

  try {
    const html = await fetchHtml(config.url, PHP_SERVER_PORT);
    const outputPath = path.join(FIXTURES_DIR, config.output);

    // Ensure fixtures directory exists
    if (!fs.existsSync(FIXTURES_DIR)) {
      fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    }

    // Write fixture with metadata comment
    const fixtureContent = `<!--
  Generated: ${new Date().toISOString()}
  Source: ${config.url}
  Description: ${config.description}

  DO NOT EDIT - This file is auto-generated from PHP
  Run: npm run render-fixtures
-->
${html}`;

    fs.writeFileSync(outputPath, fixtureContent);
    console.log(`  ✓ ${config.output}`);
  } catch (error) {
    console.error(`  ✗ Failed to render ${name}:`, error.message);
  }
}

/**
 * Render all fixtures
 */
async function renderAll(specificFixture) {
  console.log(`Starting PHP server on port ${PHP_SERVER_PORT}...`);
  await startPhpServer({
    port: PHP_SERVER_PORT,
    cwd: path.join(__dirname, '../..'),
  });
  console.log('✓ PHP server started');

  try {
    if (specificFixture && FIXTURES[specificFixture]) {
      await renderFixture(specificFixture, FIXTURES[specificFixture]);
    } else {
      for (const [name, config] of Object.entries(FIXTURES)) {
        await renderFixture(name, config);
      }
    }
    console.log('\n✓ All fixtures rendered successfully');
  } finally {
    stopPhpServer(PHP_SERVER_PORT);
    console.log('✓ PHP server stopped');
  }
}

/**
 * Watch mode - re-render when PHP files change
 */
async function watchMode() {
  const chokidar = await import('chokidar');

  console.log('👀 Watching for PHP file changes...\n');

  const watcher = chokidar.default.watch(['**/*.php'], {
    ignored: [
      '**/node_modules/**',
      '**/vendor/**',
      '**/typestripped/**',
    ],
    persistent: true,
    ignoreInitial: true,
  });

  // Debounce renders
  let renderTimer;
  const scheduleRender = () => {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(async () => {
      console.log('\n📝 PHP files changed, re-rendering...');
      await renderAll();
      console.log('👀 Watching for changes...\n');
    }, 500);
  };

  watcher.on('change', scheduleRender);
  watcher.on('add', scheduleRender);

  // Initial render
  renderAll();
}

// CLI
const args = process.argv.slice(2);
const watchFlag = args.includes('--watch') || args.includes('-w');
const specificFixture = args.find(arg => !arg.startsWith('-'));

if (watchFlag) {
  // Check if chokidar is available
  try {
    await import('chokidar');
    await watchMode();
  } catch (e) {
    console.error('❌ Watch mode requires chokidar. Install with: npm install --save-dev chokidar');
    process.exit(1);
  }
} else {
  renderAll(specificFixture)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Render failed:', err);
      process.exit(1);
    });
}
