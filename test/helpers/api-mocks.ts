/**
 * API mocking utilities for tests
 */

import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import process from 'node:process';
import {vi} from 'vitest';
import {validateTestRequest, isImageRequest, isBlockedDomain} from './domain-blocker';

// Use project root to avoid issues with typestripped compiled output
const projectRoot = process.cwd();
const MOCKS_DIR = join(projectRoot, 'test', '__mocks__');

/**
 * Loads mock data from __mocks__ directory
 */
export function loadMock(filename: string): any {
	const path = join(MOCKS_DIR, filename);
	const content = readFileSync(path, 'utf8');
	return filename.endsWith('.json') ? JSON.parse(content) : content;
}

/**
 * Loads a JSON file from warframe-public-export-plus/
 */
export function loadExportJson(filename: string): any {
	return JSON.parse(readFileSync(join(projectRoot, 'warframe-public-export-plus', filename), 'utf8'));
}

/**
 * Sets up mock fetch responses for all oracle.browse.wf endpoints
 */
export function setupMockFetch() {
	const mocks = {
		'https://oracle.browse.wf/bounty-cycle': loadMock('bounty-cycle.json'),
		'https://oracle.browse.wf/worldState.json': null, // Should never be hit; worldState is fetched via the front proxy
		'https://oracle.browse.wf/min': null, // No longer used
		'https://oracle.browse.wf/invasions': null, // No longer used; invasions come from worldState
		'https://oracle.browse.wf/redtext.json': [], // Empty array for redtext (no red text in tests)
		'http://localhost/arbys.txt': readFileSync(join(projectRoot, 'arbys.txt'), 'utf8'),
	};

	globalThis.fetch = vi.fn(async (url: string) => {
		const urlString = url.toString();

		// First, check if we have a mock for this URL
		const mockData = mocks[urlString as keyof typeof mocks];

		if (mockData === null) {
			throw new Error(`TEST SAFEGUARD: fetch to ${urlString} is forbidden in tests`);
		}

		if (mockData !== undefined) {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
			return {
				ok: true,
				status: 200,
				json: async () => mockData,
				text: async () => typeof mockData === 'string' ? mockData : JSON.stringify(mockData),
			} as Response;
		}

		// SAFEGUARD: If not mocked, validate that tests never hit production domains
		// Images are silently allowed, other requests throw errors
		if (isBlockedDomain(urlString)) {
			if (isImageRequest(urlString)) {
				// Silently return empty response for image requests
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
				return {
					ok: true,
					status: 200,
					blob: async () => new Blob(),
					arrayBuffer: async () => new ArrayBuffer(0),
				} as Response;
			}

			// Non-image request to production domain without a mock - this is an error
			validateTestRequest(urlString); // Will throw
		}

		// Not mocked and not a blocked domain
		throw new Error(`No mock for ${urlString}`);
	});
}

/**
 * Mock a specific API endpoint with custom data
 */
export function mockEndpoint(url: string, data: any) {
	const existingFetch = globalThis.fetch as any;

	globalThis.fetch = vi.fn((requestUrl: string) => {
		if (requestUrl === url) {
			return Promise.resolve({
				ok: true,
				status: 200,
				json: async () => data,
				text: async () => typeof data === 'string' ? data : JSON.stringify(data),
			} as Response);
		}

		return existingFetch(requestUrl);
	});
}

/**
 * Mock a failed API response
 */
export function mockEndpointError(url: string, statusCode = 500) {
	const existingFetch = globalThis.fetch as any;

	globalThis.fetch = vi.fn((requestUrl: string) => {
		if (requestUrl === url) {
			return Promise.resolve({
				ok: false,
				status: statusCode,
				async json() {
					throw new Error('API Error');
				},
				async text() {
					throw new Error('API Error');
				},
			} as Response);
		}

		return existingFetch(requestUrl);
	});
}
