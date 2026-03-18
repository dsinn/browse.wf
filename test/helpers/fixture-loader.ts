/**
 * Helper to load pre-rendered PHP fixtures
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// Use project root to avoid issues with typestripped compiled output
const projectRoot = process.cwd();
const FIXTURES_DIR = path.join(projectRoot, 'test', '__fixtures__');

/**
 * Load a pre-rendered HTML fixture
 *
 * @param name - Fixture name (e.g., 'navbar')
 * @returns HTML string
 *
 * @example
 * const navbarHtml = loadFixture('navbar');
 * document.body.innerHTML = navbarHtml;
 */
export function loadFixture(name: string): string {
	const fixturePath = path.join(FIXTURES_DIR, `${name}.html`);

	if (!fs.existsSync(fixturePath)) {
		throw new Error(`Fixture "${name}" not found at ${fixturePath}\n\n`
			+ 'Run: npm run render-fixtures\n'
			+ `Or: node test/helpers/render-php.js ${name}`);
	}

	return fs.readFileSync(fixturePath, 'utf8');
}

/**
 * Check if fixture exists
 */
export function fixtureExists(name: string): boolean {
	const fixturePath = path.join(FIXTURES_DIR, `${name}.html`);
	return fs.existsSync(fixturePath);
}

/**
 * List available fixtures
 */
export function listFixtures(): string[] {
	if (!fs.existsSync(FIXTURES_DIR)) {
		return [];
	}

	return fs.readdirSync(FIXTURES_DIR)
		.filter(file => file.endsWith('.html'))
		.map(file => file.replace('.html', ''));
}
