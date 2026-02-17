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

declare global {
  interface Window {
    bootstrap?: any;
    showdown?: any;
    onLanguageUpdate?: () => void;
    __ENV__?: {
      VITE_ENV?: string;
      VITE_DATABASE_URL?: string;
      VITE_DATABASE_ANON_KEY?: string;
    };
  }

  // Allow dict and osdict to be declared with more specific types elsewhere
  var dict: any;
  var osdict: any;
}
