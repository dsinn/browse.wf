import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TEST_FRONT_PROXY_BASE_URL as DEFAULT_BASE_URL } from './helpers/test-constants';
import { WarframeApiFrontProxyClient } from '../src/warframe-api-proxy-client';
const CUSTOM_BASE_URL = 'https://front-proxy.test';
const PROXY_TOKEN = 'test-token';
const MOCK_WORLD_STATE = { timestamp: 1234567890, alerts: [] };
const MOCK_PROFILE_DATA = { Results: [{ DisplayName: 'TestUser', PlayerLevel: 30 }] };
const MOCK_NEXT_FETCH_HTTP_DATE = new Date(Date.now() + 23 * 60 * 60 * 1000).toUTCString();
const MOCK_NEXT_FETCH_EPOCH_MS = new Date(MOCK_NEXT_FETCH_HTTP_DATE).getTime();

beforeEach(() => {
  delete (window as any).__ENV__;
  delete (window as any).__getSupabaseAccessToken;
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
        ok: true,
        json: () => Promise.resolve(MOCK_WORLD_STATE),
      } as Response);

      await WarframeApiFrontProxyClient.fetchWorldState();

      expect(fetch).toHaveBeenCalledWith(
        `${CUSTOM_BASE_URL}/worldState`,
        expect.objectContaining({ headers: expect.objectContaining({ 'X-Warframe-API-Front-Proxy-Token': PROXY_TOKEN }) }),
      );
    });

    it('returns the parsed JSON response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(MOCK_WORLD_STATE),
      } as Response);

      const result = await WarframeApiFrontProxyClient.fetchWorldState();

      expect(result).toEqual(MOCK_WORLD_STATE);
    });
  });

  describe('when no base URL is configured', () => {
    it('falls back to the default front proxy URL', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(MOCK_WORLD_STATE),
      } as Response);

      await WarframeApiFrontProxyClient.fetchWorldState();

      expect(fetch).toHaveBeenCalledWith(
        `${DEFAULT_BASE_URL}/worldState`,
        expect.anything(),
      );
    });

    it('still sends the token when configured', async () => {
      (window as any).__ENV__ = { WARFRAME_API_FRONT_PROXY_TOKEN: PROXY_TOKEN };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(MOCK_WORLD_STATE),
      } as Response);

      await WarframeApiFrontProxyClient.fetchWorldState();

      expect(fetch).toHaveBeenCalledWith(
        `${DEFAULT_BASE_URL}/worldState`,
        expect.objectContaining({ headers: expect.objectContaining({ 'X-Warframe-API-Front-Proxy-Token': PROXY_TOKEN }) }),
      );
    });

    it.todo('falls back to the default URL when WARFRAME_API_FRONT_PROXY_BASE_URL is empty string');
  });

  it('never sends Authorization header even when __getSupabaseAccessToken returns a token', async () => {
    (window as any).__getSupabaseAccessToken = vi.fn().mockResolvedValue('supabase-jwt-token');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_WORLD_STATE),
    } as Response);

    await WarframeApiFrontProxyClient.fetchWorldState();

    const callHeaders = (fetch as any).mock.calls[0][1].headers;
    expect(callHeaders).not.toHaveProperty('Authorization');
  });
});

describe('WarframeApiFrontProxyClient.fetchProfile', () => {
  beforeEach(() => {
    (window as any).__ENV__ = {
      WARFRAME_API_FRONT_PROXY_BASE_URL: CUSTOM_BASE_URL,
      WARFRAME_API_FRONT_PROXY_TOKEN: PROXY_TOKEN,
    };
  });

  it('constructs the correct URL for PC platform', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ nextFetchAvailableAt: MOCK_NEXT_FETCH_HTTP_DATE, profile: MOCK_PROFILE_DATA }),
    } as Response);

    await WarframeApiFrontProxyClient.fetchProfile('pc', 'abc123');

    expect(fetch).toHaveBeenCalledWith(
      `${CUSTOM_BASE_URL}/profile?platform=pc&playerId=abc123`,
      expect.anything(),
    );
  });

  it('constructs the correct URL for non-PC platforms (e.g. ps4)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ nextFetchAvailableAt: MOCK_NEXT_FETCH_HTTP_DATE, profile: MOCK_PROFILE_DATA }),
    } as Response);

    await WarframeApiFrontProxyClient.fetchProfile('ps4', 'abc123');

    expect(fetch).toHaveBeenCalledWith(
      `${CUSTOM_BASE_URL}/profile?platform=ps4&playerId=abc123`,
      expect.anything(),
    );
  });

  it('falls back to the default base URL when unconfigured', async () => {
    delete (window as any).__ENV__;

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ nextFetchAvailableAt: MOCK_NEXT_FETCH_HTTP_DATE, profile: MOCK_PROFILE_DATA }),
    } as Response);

    await WarframeApiFrontProxyClient.fetchProfile('pc', 'abc123');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(`${DEFAULT_BASE_URL}/profile`),
      expect.anything(),
    );
  });

  it('sends the X-Warframe-API-Front-Proxy-Token header', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ nextFetchAvailableAt: MOCK_NEXT_FETCH_HTTP_DATE, profile: MOCK_PROFILE_DATA }),
    } as Response);

    await WarframeApiFrontProxyClient.fetchProfile('pc', 'abc123');

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: expect.objectContaining({ 'X-Warframe-API-Front-Proxy-Token': PROXY_TOKEN }) }),
    );
  });

  it('sends Authorization: Bearer <token> when __getSupabaseAccessToken returns a token', async () => {
    (window as any).__getSupabaseAccessToken = vi.fn().mockResolvedValue('supabase-jwt-token');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ nextFetchAvailableAt: MOCK_NEXT_FETCH_HTTP_DATE, profile: MOCK_PROFILE_DATA }),
    } as Response);

    await WarframeApiFrontProxyClient.fetchProfile('pc', 'abc123');

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: expect.objectContaining({ 'Authorization': 'Bearer supabase-jwt-token' }) }),
    );
  });

  it('omits Authorization header when __getSupabaseAccessToken returns null', async () => {
    (window as any).__getSupabaseAccessToken = vi.fn().mockResolvedValue(null);

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ nextFetchAvailableAt: MOCK_NEXT_FETCH_HTTP_DATE, profile: MOCK_PROFILE_DATA }),
    } as Response);

    await WarframeApiFrontProxyClient.fetchProfile('pc', 'abc123');

    const callHeaders = (fetch as any).mock.calls[0][1].headers;
    expect(callHeaders).not.toHaveProperty('Authorization');
  });

  it('omits Authorization header when __getSupabaseAccessToken is not defined', async () => {
    // __getSupabaseAccessToken already deleted in beforeEach
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ nextFetchAvailableAt: MOCK_NEXT_FETCH_HTTP_DATE, profile: MOCK_PROFILE_DATA }),
    } as Response);

    await WarframeApiFrontProxyClient.fetchProfile('pc', 'abc123');

    const callHeaders = (fetch as any).mock.calls[0][1].headers;
    expect(callHeaders).not.toHaveProperty('Authorization');
  });

  it('returns HTTP status alongside data on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ nextFetchAvailableAt: MOCK_NEXT_FETCH_HTTP_DATE, profile: MOCK_PROFILE_DATA }),
    } as Response);

    const result = await WarframeApiFrontProxyClient.fetchProfile('pc', 'abc123');

    expect(result.status).toBe(200);
    expect(result.data).toEqual(MOCK_PROFILE_DATA);
    expect(result.nextFetchAvailableAt).toBe(MOCK_NEXT_FETCH_EPOCH_MS);
  });

  it('returns status 429 with null data on rate limit', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Headers(),
    } as Response);

    const result = await WarframeApiFrontProxyClient.fetchProfile('pc', 'abc123');

    expect(result.status).toBe(429);
    expect(result.data).toBeNull();
    expect(result.nextFetchAvailableAt).toBeNull();
  });

  it('converts Retry-After HTTP date to epoch ms as nextFetchAvailableAt on 429', async () => {
    const retryAfterHttpDate = new Date(Date.now() + 3600 * 1000).toUTCString();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Headers({ 'Retry-After': retryAfterHttpDate }),
    } as Response);

    const result = await WarframeApiFrontProxyClient.fetchProfile('pc', 'abc123');

    expect(result.status).toBe(429);
    expect(result.nextFetchAvailableAt).toBe(new Date(retryAfterHttpDate).getTime());
  });

  it('returns status 401 with null data on auth failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers(),
    } as Response);

    const result = await WarframeApiFrontProxyClient.fetchProfile('pc', 'abc123');

    expect(result.status).toBe(401);
    expect(result.data).toBeNull();
  });
});
