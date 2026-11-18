import * as fs from 'node:fs';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';
import process from 'node:process';
import {describe, test, expect} from 'vitest';
import {TEST_FRONT_PROXY_BASE_URL} from './helpers/test-constants';
import {formatReport, validate} from './worldstate-schema/rules';
import {worldStateSchema} from './worldstate-schema/schema';

/**
 API Structure Validation Tests

 These tests verify that the real oracle.browse.wf API responses match the structure
 of our mock files. This catches "mock drift" where the real API changes but our
 mocks don't get updated.

 IMPORTANT: These tests DO NOT use mocks - they hit real external APIs.
 Run these manually or in CI to detect when mocks need updating.

 The worldState test checks the live response against the declarative schema in
 ./worldstate-schema/schema.ts. Errors fail the test; warnings are printed (and added to the
 GitHub Actions job summary) without failing it.

 If a test fails:
 1. Check if the API structure actually changed
 2. Update the schema (and the code that reads the changed data, if any)
 3. Update the mock file: ./test/update-mocks.sh
 */

describe.skipIf(process.env.API_VALIDATION !== '1')('API Structure Validation', () => {
	if (process.env.API_VALIDATION !== '1') {
		console.log('⏭️  Skipping API validation tests. Run with: npm run test:api-validation');
	}

	const mocksDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '__mocks__');
	const frontProxyHeaders = {
		'X-Warframe-API-Front-Proxy-Token': process.env.WARFRAME_API_FRONT_PROXY_TOKEN ?? '',
		Origin: 'http://localhost:60969',
	};

	test('oracle.browse.wf/bounty-cycle matches mock structure', async () => {
		const response = await fetch('https://oracle.browse.wf/bounty-cycle');
		expect(response.ok).toBe(true);

		const realData = await response.json();
		const mockData = JSON.parse(fs.readFileSync(path.join(mocksDir, 'bounty-cycle.json'), 'utf8'));

		// Validate top-level keys match
		expect(Object.keys(realData).sort()).toEqual(Object.keys(mockData).sort());

		// Validate critical fields
		expect(typeof realData.expiry).toBe('number');
		expect(typeof realData.bounties).toBe('object');
	});

	test('front proxy worldState matches the schema', async () => {
		const response = await fetch(`${TEST_FRONT_PROXY_BASE_URL}/worldState`, {headers: frontProxyHeaders});
		expect(response.ok).toBe(true);

		const issues = validate(await response.json(), worldStateSchema);
		const report = formatReport(issues);
		console.log(report);
		if (process.env.GITHUB_STEP_SUMMARY && issues.length > 0) {
			fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## worldState validation\n\n\`\`\`\n${report}\n\`\`\`\n`);
		}

		expect(issues.filter(issue => issue.severity === 'error'), report).toEqual([]);
	});
});
