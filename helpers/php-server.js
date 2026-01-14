/**
 * Shared PHP server utilities for rendering PHP files to HTML
 * Used by both test fixtures and GitHub Pages build
 */

import { execSync } from 'child_process';
import http from 'http';

/**
 * Start PHP built-in server
 * @param {Object} options - Configuration options
 * @param {number} options.port - Port number for PHP server
 * @param {string} options.cwd - Working directory for PHP server
 * @param {number} options.startupDelay - Milliseconds to wait for server startup (default: 1000)
 * @returns {Promise<void>}
 */
function startPhpServer(options) {
  const { port, cwd, startupDelay = 1000 } = options;

  execSync(`php -S localhost:${port} -t . > /dev/null 2>&1 &`, { cwd });

  // Wait for server to start
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, startupDelay);
  });
}

/**
 * Stop PHP server
 * @param {number} port - Port number of PHP server to stop
 */
function stopPhpServer(port) {
  try {
    execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null`);
  } catch (e) {
    // Server wasn't running
  }
}

/**
 * Fetch HTML from PHP server
 * @param {string} url - URL path to fetch (e.g., '/live.php')
 * @param {number} port - Port number of PHP server
 * @returns {Promise<string>} - HTML content
 */
function fetchHtml(url, port) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${port}${url}`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

export {
  startPhpServer,
  stopPhpServer,
  fetchHtml,
};
