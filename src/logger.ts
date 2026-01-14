/**
 * Conditional logger following standard JavaScript logging conventions
 *
 * Log levels:
 * - debug: Verbose development messages (suppressed in production builds)
 * - log/info: Informational messages (always shown)
 * - warn: Warnings (always shown)
 * - error: Errors (always shown)
 *
 * Production detection: VITE_ENV === 'production' (GitHub Pages build only)
 */

const isProduction = () => {
  return (window as any).__ENV__?.VITE_ENV === 'production'
}

export const logger = {
  /**
   * Debug messages (suppressed in production builds)
   */
  debug: (...args: any[]) => {
    if (!isProduction()) {
      console.log(...args)
    }
  },

  /**
   * Informational messages (always shown)
   */
  log: (...args: any[]) => {
    console.log(...args)
  },

  /**
   * Informational messages (alias for log)
   */
  info: (...args: any[]) => {
    console.log(...args)
  },

  /**
   * Warnings (always shown)
   */
  warn: (...args: any[]) => {
    console.warn(...args)
  },

  /**
   * Errors (always shown)
   */
  error: (...args: any[]) => {
    console.error(...args)
  }
}
