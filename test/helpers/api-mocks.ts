/**
 * API mocking utilities for tests
 */

import { vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

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
 * Sets up mock fetch responses for all oracle.browse.wf endpoints
 */
export function setupMockFetch() {
  const mocks = {
    'https://oracle.browse.wf/min': loadMock('min.json'),
    'https://oracle.browse.wf/bounty-cycle': loadMock('bounty-cycle.json'),
    'https://oracle.browse.wf/worldState.json': loadMock('worldState.json'),
    'https://oracle.browse.wf/redtext.json': [], // Empty array for redtext (no red text in tests)
    'https://oracle.browse.wf/invasions': loadMock('invasions.json'),
    'https://browse.wf/arbys.txt': loadMock('arbys.txt'),
  };

  global.fetch = vi.fn((url: string) => {
    const urlStr = url.toString();
    const mockData = mocks[urlStr as keyof typeof mocks];

    if (mockData !== undefined) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockData),
        text: () => Promise.resolve(typeof mockData === 'string' ? mockData : JSON.stringify(mockData)),
      } as Response);
    }

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
