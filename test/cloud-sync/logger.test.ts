/**
 * Tests for conditional logger utility
 */
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Logger', () => {
  let consoleLogSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Clear any existing window.__ENV__
    delete (window as any).__ENV__;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();

    // Clean up module cache
    vi.resetModules();
  });

  describe('debug method', () => {
    test('should log in development (no VITE_ENV set)', async () => {
      // No VITE_ENV = not production = should log
      const { logger } = await import('../../src/logger');

      logger.debug('test message', 123);

      expect(consoleLogSpy).toHaveBeenCalledWith('test message', 123);
    });

    test('should log when VITE_ENV is development', async () => {
      (window as any).__ENV__ = { VITE_ENV: 'development' };

      const { logger } = await import('../../src/logger');

      logger.debug('dev message');

      expect(consoleLogSpy).toHaveBeenCalledWith('dev message');
    });

    test('should suppress in production', async () => {
      (window as any).__ENV__ = { VITE_ENV: 'production' };

      const { logger } = await import('../../src/logger');

      logger.debug('should not appear');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    test('should handle multiple arguments', async () => {
      const { logger } = await import('../../src/logger');

      logger.debug('message', { foo: 'bar' }, [1, 2, 3]);

      expect(consoleLogSpy).toHaveBeenCalledWith('message', { foo: 'bar' }, [1, 2, 3]);
    });
  });

  describe('log method', () => {
    test('should always log regardless of environment', async () => {
      (window as any).__ENV__ = { VITE_ENV: 'production' };

      const { logger } = await import('../../src/logger');

      logger.log('info message');

      expect(consoleLogSpy).toHaveBeenCalledWith('info message');
    });

    test('should log in development', async () => {
      (window as any).__ENV__ = { VITE_ENV: 'development' };

      const { logger } = await import('../../src/logger');

      logger.log('dev info');

      expect(consoleLogSpy).toHaveBeenCalledWith('dev info');
    });
  });

  describe('info method', () => {
    test('should always log (alias for log)', async () => {
      (window as any).__ENV__ = { VITE_ENV: 'production' };

      const { logger } = await import('../../src/logger');

      logger.info('info message');

      expect(consoleLogSpy).toHaveBeenCalledWith('info message');
    });
  });

  describe('warn method', () => {
    test('should always warn in production', async () => {
      (window as any).__ENV__ = { VITE_ENV: 'production' };

      const { logger } = await import('../../src/logger');

      logger.warn('warning message');

      expect(consoleWarnSpy).toHaveBeenCalledWith('warning message');
    });

    test('should always warn in development', async () => {
      const { logger } = await import('../../src/logger');

      logger.warn('dev warning');

      expect(consoleWarnSpy).toHaveBeenCalledWith('dev warning');
    });
  });

  describe('error method', () => {
    test('should always error in production', async () => {
      (window as any).__ENV__ = { VITE_ENV: 'production' };

      const { logger } = await import('../../src/logger');

      logger.error('error message');

      expect(consoleErrorSpy).toHaveBeenCalledWith('error message');
    });

    test('should always error in development', async () => {
      const { logger } = await import('../../src/logger');

      logger.error('dev error');

      expect(consoleErrorSpy).toHaveBeenCalledWith('dev error');
    });
  });
});
