/**
 * Vitest global setup - runs before all tests
 *
 * Generates PHP fixtures to ensure they're fresh before tests run.
 * In watch mode, also sets up PHP file watching.
 */
import {execSync} from 'node:child_process';
import process from 'node:process';
import chokidar, {type FSWatcher} from 'chokidar';

let watcher: FSWatcher | undefined;
let regenerationTimer: NodeJS.Timeout | undefined;
let isRegenerating = false;

/**
 * Regenerate fixtures synchronously
 */
function regenerateFixtures() {
	if (isRegenerating) {
		return;
	}

	try {
		isRegenerating = true;
		console.log('\n🔄 Regenerating PHP fixtures...');

		execSync('node test/helpers/render-php.js', {
			cwd: process.cwd(),
			stdio: 'inherit',
		});

		console.log('✅ Fixtures ready\n');
	} catch (error) {
		console.error('❌ Failed to regenerate fixtures');
		throw error;
	} finally {
		isRegenerating = false;
	}
}

export async function setup() {
	console.log('🔨 Setting up test environment...');

	// Always regenerate fixtures before tests start
	regenerateFixtures();

	// In watch mode, set up PHP file watching
	if (process.env.VITEST_WATCH === 'true') {
		console.log('👀 Watching PHP files for changes...\n');

		watcher = chokidar.watch(['**/*.php', 'components/**/*.php'], {
			ignored: [
				'**/node_modules/**',
				'**/vendor/**',
				'**/typestripped/**',
			],
			persistent: true,
			ignoreInitial: true,
		});

		watcher.on('change', (file: any) => {
			console.log(`\n📝 PHP file changed: ${file}`);

			// Debounce: wait 300ms for multiple changes
			if (regenerationTimer) {
				clearTimeout(regenerationTimer);
			}

			regenerationTimer = setTimeout(() => {
				regenerateFixtures();

				// Vitest will automatically re-run tests when fixtures change
				// No need to manually trigger - it watches test/__fixtures__/**
			}, 300);
		});
	}
}

export async function teardown() {
	if (watcher) {
		await watcher.close();
	}

	if (regenerationTimer) {
		clearTimeout(regenerationTimer);
	}
}
