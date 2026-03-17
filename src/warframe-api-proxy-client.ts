const DEFAULT_BASE_URL = "https://warframe-api-front-proxy.dsinn69.workers.dev";

export class WarframeApiFrontProxyClient {
  private static async rawRequest(path: string, includeAuth = false): Promise<Response> {
    const baseUrl = (window as any).__ENV__?.WARFRAME_API_FRONT_PROXY_BASE_URL || DEFAULT_BASE_URL;
    const token = (window as any).__ENV__?.WARFRAME_API_FRONT_PROXY_TOKEN;

    const headers: Record<string, string> = {
      "X-Warframe-API-Front-Proxy-Token": token,
    };
    if (includeAuth) {
      const getToken = (window as any).__getSupabaseAccessToken;
      const accessToken = getToken ? await getToken() : null;
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }
    }

    return fetch(`${baseUrl}${path}`, { headers });
  }

  private static async request(path: string): Promise<any> {
    const response = await WarframeApiFrontProxyClient.rawRequest(path);
    return response.ok ? response.json() : null;
  }

  static fetchWorldState(): Promise<any> {
    return WarframeApiFrontProxyClient.request("/worldState");
  }

  static async fetchProfile(platform: string, playerId: string): Promise<{ status: number; data: any; nextFetchAvailableAt: number | null }> {
    const response = await WarframeApiFrontProxyClient.rawRequest(
      `/profile?platform=${encodeURIComponent(platform)}&playerId=${encodeURIComponent(playerId)}`,
      true
    );
    if (!response.ok) {
      const retryAfter = response.headers.get("Retry-After");
      const nextFetchAvailableAt = retryAfter ? new Date(retryAfter).getTime() : null;
      return { status: response.status, data: null, nextFetchAvailableAt };
    }
    const json = await response.json();
    // Worker wraps response: { nextFetchAvailableAt: <HTTP date>, profile: <upstream JSON> }
    const nextFetchAvailableAt = json.nextFetchAvailableAt ? new Date(json.nextFetchAvailableAt).getTime() : null;
    return { status: response.status, data: json.profile, nextFetchAvailableAt };
  }
}

(window as any).WarframeApiFrontProxyClient = WarframeApiFrontProxyClient;
