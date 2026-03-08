import { defineConfig, Plugin } from 'vitest/config';
import chokidar from 'chokidar';
import fs from 'fs';
import path from 'path';

const DEV_PORT = parseInt(process.env.PORT || '60969', 10);

/**
 * Vite plugin to serve pre-rendered PHP pages from public/ with HMR support.
 *
 * Routes: /live, /live.php, /live.html all serve public/live.html
 * The HTML is transformed by Vite to inject the HMR client script,
 * so the browser auto-reloads when any watched file changes.
 */
function phpPagesPlugin(): Plugin {
  const publicDir = path.resolve('public');

  return {
    name: 'php-pages',
    configureServer(server) {
      // Watch public/ for changes and trigger full page reload.
      // Only in dev mode (not during vitest) to avoid keeping the process alive.
      if (!process.env.VITEST) {
        const publicWatcher = chokidar.watch(publicDir, { ignoreInitial: true });
        publicWatcher.on('all', () => {
          server.ws.send({ type: 'full-reload' });
        });
        server.httpServer?.on('close', () => publicWatcher.close());
      }

      // Pre-middleware: runs before Vite's built-in file serving.
      // This is necessary because Vite would otherwise resolve e.g. /live
      // to live.ts in the project root instead of public/live.html.
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || req.method !== 'GET') return next();

        const urlPath = req.url.split('?')[0];

        // Determine which HTML file to serve
        let htmlFile: string | undefined;

        if (urlPath === '/') {
          htmlFile = 'index.html';
        } else if (urlPath.endsWith('.php')) {
          htmlFile = urlPath.slice(1).replace(/\.php$/, '.html');
        } else if (urlPath.endsWith('.html')) {
          htmlFile = urlPath.slice(1);
        } else if (!path.extname(urlPath)) {
          // Extensionless path — check if a rendered page exists
          htmlFile = urlPath.slice(1) + '.html';
        }

        if (htmlFile) {
          const htmlPath = path.join(publicDir, htmlFile);
          if (fs.existsSync(htmlPath)) {
            let html = fs.readFileSync(htmlPath, 'utf-8');
            html = await server.transformIndexHtml(req.url, html);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
            res.end(html);
            return;
          }
        }

        // Serve non-HTML files from public/ (e.g., env-config.js)
        if (path.extname(urlPath)) {
          const publicFile = path.join(publicDir, urlPath.slice(1));
          if (fs.existsSync(publicFile) && fs.statSync(publicFile).isFile()) {
            const mimeTypes: Record<string, string> = {
              '.js': 'application/javascript',
              '.css': 'text/css',
              '.json': 'application/json',
            };
            res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(urlPath)] || 'application/octet-stream' });
            res.end(fs.readFileSync(publicFile));
            return;
          }
        }

        next();
      });
    },
  };
}

export default defineConfig({
  // Don't use publicDir — we serve HTML through the plugin above so that
  // Vite's HTML transform pipeline injects the HMR client script.
  publicDir: false,
  plugins: [phpPagesPlugin()],

  server: {
    port: DEV_PORT,
    watch: {
      ignored: [
        '**/*.md',
        'build-gh-pages.js',
        'e2e/**',
        'eslint.config.js',
        'helpers/**',
        'node_modules/**',
        'playwright-report/**',
        'playwright.config.ts',
        'public/**',  // Watched separately by our chokidar instance
        'scripts/**',
        'test/**',
        'test-results/**',
        'vitest.config.ts',
      ],
    },
  },

  // Test config
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    globalSetup: ['./test/global-setup.ts'],
    include: ['test/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/dist/**', '**/e2e/**', '**/node_modules/**', '**/typestripped/**'],
  },
});
