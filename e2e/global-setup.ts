/**
 Playwright global setup - runs before all E2E tests

 Renders the PHP pages that the dev server serves. The safeguards against hitting production domains are the
 catch-all routes in setupMockRoutes().
 */
import {execSync} from 'node:child_process';
import process from 'node:process';

export default function globalSetup() {
	console.log('🔒 Setting up E2E test safeguards...');

	execSync('node scripts/render-pages.js', {cwd: process.cwd(), stdio: 'inherit'});

	console.log('✅ E2E safeguards ready\n');
}
