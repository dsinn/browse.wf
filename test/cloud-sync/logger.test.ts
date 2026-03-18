/**
 * Tests for conditional logger utility
 */
import {
	describe, test, expect, beforeEach, afterEach, vi,
} from 'vitest';

describe('Logger', () => {
	let consoleLogSpy: any;
	let consoleWarnSpy: any;
	let consoleErrorSpy: any;

	beforeEach(() => {
		// Spy on console methods
		consoleLogSpy = vi.spyOn(console, 'log').mockReturnValue(undefined);
		consoleWarnSpy = vi.spyOn(console, 'warn').mockReturnValue(undefined);
		consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue(undefined);

		// Clear any existing window.__ENV__
		delete (globalThis as any).__ENV__;
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
			const {logger} = await import('../../src/logger');

			logger.debug('test message', 123);

			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]$/u),
				'test message',
				123,
			);
		});

		test('should log when VITE_ENV is development', async () => {
			(globalThis as any).__ENV__ = {VITE_ENV: 'development'};

			const {logger} = await import('../../src/logger');

			logger.debug('dev message');

			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]$/u),
				'dev message',
			);
		});

		test('should suppress in production', async () => {
			(globalThis as any).__ENV__ = {VITE_ENV: 'production'};

			const {logger} = await import('../../src/logger');

			logger.debug('should not appear');

			expect(consoleLogSpy).not.toHaveBeenCalled();
		});

		test('should handle multiple arguments', async () => {
			const {logger} = await import('../../src/logger');

			logger.debug('message', {foo: 'bar'}, [1, 2, 3]);

			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]$/u),
				'message',
				{foo: 'bar'},
				[1, 2, 3],
			);
		});
	});

	describe('log method', () => {
		test('should always log regardless of environment', async () => {
			(globalThis as any).__ENV__ = {VITE_ENV: 'production'};

			const {logger} = await import('../../src/logger');

			logger.log('info message');

			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]$/u),
				'info message',
			);
		});

		test('should log in development', async () => {
			(globalThis as any).__ENV__ = {VITE_ENV: 'development'};

			const {logger} = await import('../../src/logger');

			logger.log('dev info');

			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]$/u),
				'dev info',
			);
		});
	});

	describe('info method', () => {
		test('should always log (alias for log)', async () => {
			(globalThis as any).__ENV__ = {VITE_ENV: 'production'};

			const {logger} = await import('../../src/logger');

			logger.info('info message');

			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]$/u),
				'info message',
			);
		});
	});

	describe('warn method', () => {
		test('should always warn in production', async () => {
			(globalThis as any).__ENV__ = {VITE_ENV: 'production'};

			const {logger} = await import('../../src/logger');

			logger.warn('warning message');

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]$/u),
				'warning message',
			);
		});

		test('should always warn in development', async () => {
			const {logger} = await import('../../src/logger');

			logger.warn('dev warning');

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]$/u),
				'dev warning',
			);
		});
	});

	describe('error method', () => {
		test('should always error in production', async () => {
			(globalThis as any).__ENV__ = {VITE_ENV: 'production'};

			const {logger} = await import('../../src/logger');

			logger.error('error message');

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]$/u),
				'error message',
			);
		});

		test('should always error in development', async () => {
			const {logger} = await import('../../src/logger');

			logger.error('dev error');

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]$/u),
				'dev error',
			);
		});
	});
});
