/**
 * Logger utility for Silence Notes Chrome Extension
 *
 * Logs are only output in development/debug mode. In production,
 * all log statements are no-ops to reduce bundle size and noise.
 *
 * Debug mode is controlled by the __DEBUG__ constant injected at build time.
 */

// Type declaration for webpack-injected global
declare global {
  const __DEBUG__: boolean;
}

// Check if debug mode is enabled (default to false if undefined)
const isDebug = typeof __DEBUG__ !== 'undefined' ? __DEBUG__ : false;

/**
 * Logger class with conditional output
 */
class Logger {
  private readonly prefix: string;

  constructor(prefix: string = '') {
    this.prefix = prefix ? `[${prefix}] ` : '';
  }

  /** Log informational messages */
  log(...args: unknown[]): void {
    if (isDebug) {
      console.log(this.prefix, ...args);
    }
  }

  /** Log warnings */
  warn(...args: unknown[]): void {
    if (isDebug) {
      console.warn(this.prefix, ...args);
    }
  }

  /** Log errors (always output, even in production) */
  error(...args: unknown[]): void {
    console.error(this.prefix, ...args);
  }

  /** Log debug information */
  debug(...args: unknown[]): void {
    if (isDebug) {
      console.debug(this.prefix, ...args);
    }
  }

  /** Create a new logger with a sub-prefix */
  withPrefix(subPrefix: string): Logger {
    return new Logger(this.prefix + subPrefix);
  }
}

// Default logger export
export const logger = new Logger();

// Export class for creating custom loggers
export { Logger };

// Export debug flag check
export const isDebugEnabled = () => isDebug;
