import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {defineConfig, type Plugin} from 'vitest/config';
import {loadEnv} from 'vite';
import chokidar from 'chokidar';

// Load specific secrets from .env for tests that hit real APIs
const env = loadEnv('', process.cwd(), '');
const TEST_SECRETS = ['WARFRAME_API_FRONT_PROXY_TOKEN'];
for (const key of TEST_SECRETS) {
	if (env[key]) {
		process.env[key] = env[key];
	}
}

const DEV_PORT = Number.parseInt(process.env.PORT || '60969', 10);

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
				const publicWatcher = chokidar.watch(publicDir, {ignoreInitial: true});
				publicWatcher.on('all', () => {
					server.ws.send({type: 'full-reload'});
				});
				server.httpServer?.on('close', () => {
					void publicWatcher.close();
				});
			}

			// Pre-middleware: runs before Vite's built-in file serving.
			// This is necessary because Vite would otherwise resolve e.g. /live
			// to live.ts in the project root instead of public/live.html.
			// The callback is typed as returning void but we use async/await internally;
			// the return type mismatch is harmless since connect ignores the return value.
			// eslint-disable-next-line @typescript-eslint/strict-void-return
			server.middlewares.use(async (request, response, next) => {
				if (!request.url || request.method !== 'GET') {
					next();
					return;
				}

				const urlPath = request.url.split('?')[0];

				// Determine which HTML file to serve
				let htmlFile: string | undefined;

				if (urlPath === '/') {
					htmlFile = 'index.html';
				} else if (urlPath.endsWith('.php')) {
					htmlFile = urlPath.slice(1).replace(/\.php$/u, '.html');
				} else if (urlPath.endsWith('.html')) {
					htmlFile = urlPath.slice(1);
				} else if (!path.extname(urlPath)) {
					// Extensionless path — check if a rendered page exists
					htmlFile = urlPath.slice(1) + '.html';
				}

				if (htmlFile) {
					const htmlPath = path.join(publicDir, htmlFile);
					if (fs.existsSync(htmlPath)) {
						let html = fs.readFileSync(htmlPath, 'utf8');
						html = await server.transformIndexHtml(request.url, html);
						response.writeHead(200, {'Content-Type': 'text/html; charset=UTF-8'});
						response.end(html);
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
						response.writeHead(200, {'Content-Type': mimeTypes[path.extname(urlPath)] || 'application/octet-stream'});
						response.end(fs.readFileSync(publicFile));
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

	optimizeDeps: {
		exclude: ['typestripped'], // Only present after compilation
	},

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
				'public/**', // Watched separately by our chokidar instance
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
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json-summary', 'json'],
			include: ['src/**/*.ts'],
			exclude: ['**/*.d.ts'],
		},
	},
});
