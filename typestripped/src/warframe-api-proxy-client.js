const DEFAULT_BASE_URL = 'https://warframe-api-front-proxy.dsinn69.workers.dev';
async function rawRequest(path, includeAuth = false) {
    const baseUrl = window.__ENV__?.WARFRAME_API_FRONT_PROXY_BASE_URL || DEFAULT_BASE_URL;
    const token = window.__ENV__?.WARFRAME_API_FRONT_PROXY_TOKEN;
    const headers = {
        'X-Warframe-API-Front-Proxy-Token': token ?? '',
    };
    if (includeAuth) {
        const getToken = window.__getSupabaseAccessToken;
        const accessToken = getToken ? await getToken() : undefined;
        if (accessToken) {
            headers.Authorization = `Bearer ${accessToken}`;
        }
    }
    return fetch(`${baseUrl}${path}`, { headers });
}
async function request(path) {
    const response = await rawRequest(path);
    return response.ok ? response.json() : undefined;
}
export const WarframeApiFrontProxyClient = {
    async fetchWorldState() {
        const worldState = await request('/worldState');
        globalThis.dispatchEvent(new CustomEvent('worldstate-updated'));
        return worldState;
    },
    async fetchProfile(platform, playerId) {
        const response = await rawRequest(`/profile?platform=${encodeURIComponent(platform)}&playerId=${encodeURIComponent(playerId)}`, true);
        if (!response.ok) {
            const retryAfter = response.headers.get('Retry-After');
            const nextFetchAvailableAt = retryAfter ? new Date(retryAfter).getTime() : undefined;
            return { status: response.status, data: null, nextFetchAvailableAt };
        }
        const json = await response.json();
        // Worker wraps response: { nextFetchAvailableAt: <HTTP date>, profile: <upstream JSON> }
        const nextFetchAvailableAt = json.nextFetchAvailableAt ? new Date(json.nextFetchAvailableAt).getTime() : undefined;
        return { status: response.status, data: json.profile, nextFetchAvailableAt };
    },
};
window.WarframeApiFrontProxyClient = WarframeApiFrontProxyClient;
//# sourceMappingURL=warframe-api-proxy-client.js.map