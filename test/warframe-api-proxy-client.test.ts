import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadScript } from './helpers/dom-helpers';
import { TEST_FRONT_PROXY_BASE_URL as DEFAULT_BASE_URL } from './helpers/test-constants';
const CUSTOM_BASE_URL = 'https://front-proxy.test';
const PROXY_TOKEN = 'test-token';
const MOCK_WORLD_STATE = { timestamp: 1234567890, alerts: [] };

beforeEach(() => {
  loadScript('typestripped/src/warframe-api-proxy-client.js');
  delete (window as any).__ENV__;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('WarframeApiFrontProxyClient.fetchWorldState', () => {
  describe('when a custom base URL is configured', () => {
    beforeEach(() => {
      (window as any).__ENV__ = {
        WARFRAME_API_FRONT_PROXY_BASE_URL: CUSTOM_BASE_URL,
        WARFRAME_API_FRONT_PROXY_TOKEN: PROXY_TOKEN,
      };
    });

    it('fetches from the custom base URL', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        json: () => Promise.resolve(MOCK_WORLD_STATE),
      } as Response);

      await (window as any).WarframeApiFrontProxyClient.fetchWorldState();

      expect(fetch).toHaveBeenCalledWith(
        `${CUSTOM_BASE_URL}/worldState`,
        expect.objectContaining({ headers: { 'X-Warframe-API-Front-Proxy-Token': PROXY_TOKEN } }),
      );
    });

    it('returns the parsed JSON response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        json: () => Promise.resolve(MOCK_WORLD_STATE),
      } as Response);

      const result = await (window as any).WarframeApiFrontProxyClient.fetchWorldState();

      expect(result).toEqual(MOCK_WORLD_STATE);
    });
  });

  describe('when no base URL is configured', () => {
    it('falls back to the default front proxy URL', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        json: () => Promise.resolve(MOCK_WORLD_STATE),
      } as Response);

      await (window as any).WarframeApiFrontProxyClient.fetchWorldState();

      expect(fetch).toHaveBeenCalledWith(
        `${DEFAULT_BASE_URL}/worldState`,
        expect.anything(),
      );
    });

    it('still sends the token when configured', async () => {
      (window as any).__ENV__ = { WARFRAME_API_FRONT_PROXY_TOKEN: PROXY_TOKEN };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        json: () => Promise.resolve(MOCK_WORLD_STATE),
      } as Response);

      await (window as any).WarframeApiFrontProxyClient.fetchWorldState();

      expect(fetch).toHaveBeenCalledWith(
        `${DEFAULT_BASE_URL}/worldState`,
        expect.objectContaining({ headers: { 'X-Warframe-API-Front-Proxy-Token': PROXY_TOKEN } }),
      );
    });

    it.todo('falls back to the default URL when WARFRAME_API_FRONT_PROXY_BASE_URL is empty string');
  });
});

describe('WarframeApiFrontProxyClient.fetchProfile', () => {
  it.todo('constructs the correct URL for PC platform');
  it.todo('constructs the correct URL for non-PC platforms (e.g. ps4)');
  it.todo('falls back to the default base URL when unconfigured');
  it.todo('sends the token header');
});
