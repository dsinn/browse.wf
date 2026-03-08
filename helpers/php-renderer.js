/**
 * Shared PHP rendering utilities
 * Used by dev server (vitest.config.ts), test fixtures (render-php.js), and build (build-gh-pages.js)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { startPhpServer, stopPhpServer, fetchHtml } from './php-server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

/**
 * Discover top-level PHP page files (excludes components, partials, config)
 * @returns {string[]} Array of PHP filenames (e.g., ['live.php', 'index.php'])
 */
export function discoverPhpPages() {
  return fs.readdirSync(rootDir)
    .filter(f =>
      f.endsWith('.php') &&
      !f.includes('partial') &&
      !f.includes('config')
    );
}

/**
 * Render PHP files to static HTML
 *
 * @param {Object} options
 * @param {string[]} options.files - PHP filenames to render (e.g., ['live.php'])
 * @param {string} options.outputDir - Where to write HTML files
 * @param {number} options.port - PHP server port
 * @param {(html: string) => string} [options.transform] - Optional HTML transformation
 * @param {boolean} [options.keepServerRunning] - Don't start/stop PHP server (assume already running)
 * @returns {Promise<void>}
 */
export async function renderPhpFiles(options) {
  const { files, outputDir, port, transform, keepServerRunning = false } = options;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  if (!keepServerRunning) {
    await startPhpServer({ port, cwd: rootDir });
  }

  try {
    for (const phpFile of files) {
      const url = `/${phpFile}`;
      const htmlFile = phpFile.replace('.php', '.html');
      const outputPath = path.join(outputDir, htmlFile);

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

export { startPhpServer, stopPhpServer, fetchHtml };
