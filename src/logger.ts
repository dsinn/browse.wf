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

/**
 * Returns a formatted timestamp as [YYYY-MM-DDTHH:mm:ss.sssZ]
 */
const formattedTimestamp = (): string => {
  return `[${new Date().toISOString()}]`
}

export const logger = {
  /**
   * Debug messages (suppressed in production builds)
   */
  debug: (...args: any[]) => {
    if (!isProduction()) {
      console.log(formattedTimestamp(), ...args)
    }
  },

  /**
   * Informational messages (always shown)
   */
  log: (...args: any[]) => {
    console.log(formattedTimestamp(), ...args)
  },

  /**
   * Informational messages (alias for log)
   */
  info: (...args: any[]) => {
    console.log(formattedTimestamp(), ...args)
  },

  /**
   * Warnings (always shown)
   */
  warn: (...args: any[]) => {
    console.warn(formattedTimestamp(), ...args)
  },

  /**
   * Errors (always shown)
   */
  error: (...args: any[]) => {
    console.error(formattedTimestamp(), ...args)
  }
}
