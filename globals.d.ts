/**
 * Global type declarations for libraries that extend the window object
 */

declare global {
  interface Window {
    bootstrap?: any;
    showdown?: any;
    onLanguageUpdate?: () => void;
    __ENV__?: {
      VITE_DATABASE_URL?: string;
      VITE_DATABASE_ANON_KEY?: string;
    };
  }

  // Allow dict and osdict to be declared with more specific types elsewhere
  var dict: any;
  var osdict: any;
}
