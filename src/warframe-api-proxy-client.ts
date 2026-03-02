const DEFAULT_BASE_URL = "https://warframe-api-front-proxy.dsinn69.workers.dev";

class WarframeApiFrontProxyClient {
  private static async request(path: string): Promise<any> {
    const baseUrl = (window as any).__ENV__?.WARFRAME_API_FRONT_PROXY_BASE_URL || DEFAULT_BASE_URL;
    const token = (window as any).__ENV__?.WARFRAME_API_FRONT_PROXY_TOKEN;
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { "X-Warframe-API-Front-Proxy-Token": token },
    });
    return response.json();
  }

  static fetchWorldState(): Promise<any> {
    return WarframeApiFrontProxyClient.request("/worldState");
  }

  static fetchProfile(platform: string, playerId: string): Promise<any> {
    return WarframeApiFrontProxyClient.request(
      `/profile?platform=${encodeURIComponent(platform)}&playerId=${encodeURIComponent(playerId)}`
    );
  }
}

(window as any).WarframeApiFrontProxyClient = WarframeApiFrontProxyClient;
