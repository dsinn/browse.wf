/**
 * Playwright global setup - runs before all E2E tests
 *
 * This file sets up safeguards to prevent tests from hitting production domains.
 */
import {Buffer} from 'node:buffer';
import {chromium, type FullConfig} from '@playwright/test';
import {isBlockedDomain, isImageRequest} from '../test/helpers/domain-blocker';

export default async function globalSetup(config: FullConfig) {
	console.log('🔒 Setting up E2E test safeguards...');

	// Launch a browser to verify the safeguard works
	const browser = await chromium.launch();
	const context = await browser.newContext();
	const page = await context.newPage();

	// Set up a catch-all route blocker for production domains
	// This is a last-resort safeguard in case individual tests forget to mock
	await page.route('**/*', route => {
		const url = route.request().url();

		if (isBlockedDomain(url)) {
			if (isImageRequest(url)) {
				console.warn(`⚠️  E2E test attempted to load image from production: ${url}`);
				void route.fulfill({
					status: 200,
					contentType: 'image/png',
					body: Buffer.from([]),
				});
			} else {
				console.error(`❌ E2E test attempted to fetch from production: ${url}`);
				void route.abort('failed');
			}
		} else {
			void route.continue();
		}
	});

	await browser.close();

	console.log('✅ E2E safeguards ready\n');
}
