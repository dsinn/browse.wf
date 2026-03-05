/**
 * Integration tests to verify production domain safeguards work in test environment
 */
import { describe, it, expect, beforeEach } from 'vitest';

describe('Production Domain Safeguards', () => {
  beforeEach(() => {
    // Use the standard test setup which includes setupMockFetch
    // This is automatically run by test/setup.ts
  });

  describe('Vitest fetch mocking', () => {
    it('allows mocked oracle.browse.wf endpoints', async () => {
      // These should work because they're in the mock list
      const response = await fetch('https://oracle.browse.wf/bounty-cycle');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toBeDefined();
    });

    it('blocks unmocked oracle.browse.wf endpoints', async () => {
      // This endpoint is NOT in the mock list, so it should be blocked
      await expect(
        fetch('https://oracle.browse.wf/unknown-endpoint')
      ).rejects.toThrow(/TEST SAFEGUARD.*production domain/);
    });

    it('blocks browse.wf endpoints', async () => {
      // arbys.txt is mocked, but other endpoints should be blocked
      await expect(
        fetch('https://browse.wf/unknown-file.txt')
      ).rejects.toThrow(/TEST SAFEGUARD.*production domain/);
    });

    it('silently allows image requests to blocked domains', async () => {
      // Image requests should return empty responses, not throw
      const response = await fetch('https://oracle.browse.wf/logo.png');
      expect(response.ok).toBe(true);
      const blob = await response.blob();
      expect(blob.size).toBe(0);
    });

    it('allows requests to non-blocked domains', async () => {
      // Non-browse.wf domains should be rejected with "No mock" error, not safeguard error
      await expect(
        fetch('https://example.com/api')
      ).rejects.toThrow(/No mock/);

      // The error should NOT be the safeguard error
      await expect(
        fetch('https://example.com/api')
      ).rejects.not.toThrow(/TEST SAFEGUARD/);
    });
  });

  describe('Image file extensions', () => {
    const imageExtensions = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'];

    imageExtensions.forEach(ext => {
      it(`silently allows .${ext} requests to oracle.browse.wf`, async () => {
        const response = await fetch(`https://oracle.browse.wf/image.${ext}`);
        expect(response.ok).toBe(true);
      });

      it(`silently allows .${ext.toUpperCase()} requests (case insensitive)`, async () => {
        const response = await fetch(`https://oracle.browse.wf/image.${ext.toUpperCase()}`);
        expect(response.ok).toBe(true);
      });
    });
  });

  describe('Real-world URL patterns', () => {
    it('blocks worldState.json if accidentally called with wrong URL', async () => {
      // If someone types the wrong URL, it should be caught
      await expect(
        fetch('https://oracle.browse.wf/worldstate.json') // lowercase 's'
      ).rejects.toThrow(/TEST SAFEGUARD/);
    });

    it('blocks API calls with query parameters', async () => {
      await expect(
        fetch('https://oracle.browse.wf/bounty-cycle?timestamp=12345')
      ).rejects.toThrow(/TEST SAFEGUARD/);
    });

    it('allows image URLs with query parameters', async () => {
      const response = await fetch('https://oracle.browse.wf/logo.png?v=123');
      expect(response.ok).toBe(true);
    });
  });
});
