/**
 * Global type declarations for libraries that extend the window object
 */

interface IMongoDate {
  $date: {
    $numberLong: string;
  };
}

interface IConquestMission {
  type:       string;
  variant:    string;
  conditions: string[];
}

// Upstream functions from common.js / live.ts used by fork modules
declare function getDictPromise(): Promise<Record<string, string>>;
declare function createExpiryBadge(expiry: number): HTMLSpanElement;
declare function createCompletionToggle(oid: string): HTMLAnchorElement;
declare function setImageSource(img: HTMLImageElement, icon: string): void;
declare function toTitleCase(str: string): string;

declare global {
  interface Window {
    bootstrap?: any;
    showdown?: any;
    onLanguageUpdate?: () => void;
    __ENV__?: {
      VITE_ENV?: string;
      VITE_DATABASE_URL?: string;
      VITE_DATABASE_ANON_KEY?: string;
      WARFRAME_API_FRONT_PROXY_BASE_URL?: string;
      WARFRAME_API_FRONT_PROXY_TOKEN?: string;
    };
  }

  // Allow dict and osdict to be declared with more specific types elsewhere
  var dict: any;
  var osdict: any;

}
