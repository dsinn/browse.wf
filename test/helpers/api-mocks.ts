/**
 * API mocking utilities for tests
 */

import { vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { validateTestRequest, isImageRequest, isBlockedDomain } from './domain-blocker';

// Use project root to avoid issues with typestripped compiled output
const projectRoot = process.cwd();
const MOCKS_DIR = join(projectRoot, 'test', '__mocks__');

/**
 * Loads mock data from __mocks__ directory
 */
export function loadMock(filename: string): any {
  const path = join(MOCKS_DIR, filename);
  const content = readFileSync(path, 'utf-8');
  return filename.endsWith('.json') ? JSON.parse(content) : content;
}

/**
 * Loads a JSON file from warframe-public-export-plus/
 */
export function loadExportJson(filename: string): any {
  return JSON.parse(readFileSync(join(projectRoot, 'warframe-public-export-plus', filename), 'utf-8'));
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
    'https://browse.wf/arbys.txt': loadMock('arbys.txt'),
  };

  global.fetch = vi.fn((url: string) => {
    const urlStr = url.toString();

    // First, check if we have a mock for this URL
    const mockData = mocks[urlStr as keyof typeof mocks];

    if (mockData === null) {
      return Promise.reject(new Error(`TEST SAFEGUARD: fetch to ${urlStr} is forbidden in tests`));
    }

    if (mockData !== undefined) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockData),
        text: () => Promise.resolve(typeof mockData === 'string' ? mockData : JSON.stringify(mockData)),
      } as Response);
    }

    // SAFEGUARD: If not mocked, validate that tests never hit production domains
    // Images are silently allowed, other requests throw errors
    if (isBlockedDomain(urlStr)) {
      if (isImageRequest(urlStr)) {
        // Silently return empty response for image requests
        return Promise.resolve({
          ok: true,
          status: 200,
          blob: () => Promise.resolve(new Blob()),
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        } as Response);
      }
      // Non-image request to production domain without a mock - this is an error
      try {
        validateTestRequest(urlStr); // Will throw
      } catch (error) {
        return Promise.reject(error); // Convert thrown error to rejected promise
      }
    }

    // Not mocked and not a blocked domain
    return Promise.reject(new Error(`No mock for ${urlStr}`));
  });
}

/**
 * Mock a specific API endpoint with custom data
 */
export function mockEndpoint(url: string, data: any) {
  const existingFetch = global.fetch as any;

  global.fetch = vi.fn((requestUrl: string) => {
    if (requestUrl === url) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(data),
        text: () => Promise.resolve(typeof data === 'string' ? data : JSON.stringify(data)),
      } as Response);
    }
    return existingFetch(requestUrl);
  });
}

/**
 * Mock a failed API response
 */
export function mockEndpointError(url: string, statusCode: number = 500) {
  const existingFetch = global.fetch as any;

  global.fetch = vi.fn((requestUrl: string) => {
    if (requestUrl === url) {
      return Promise.resolve({
        ok: false,
        status: statusCode,
        json: () => Promise.reject(new Error('API Error')),
        text: () => Promise.reject(new Error('API Error')),
      } as Response);
    }
    return existingFetch(requestUrl);
  });
}
