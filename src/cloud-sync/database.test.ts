/**
 * Tests for database client configuration
 */
import {
	describe, test, expect, beforeEach, afterEach, vi,
} from 'vitest';

// Mock logger before other imports
const mockLoggerInfo = vi.fn();
const mockLoggerDebug = vi.fn();
const mockLoggerWarn = vi.fn();
const mockLoggerError = vi.fn();
const mockLoggerLog = vi.fn();

vi.mock('../../src/logger', () => ({
	logger: {
		info: mockLoggerInfo,
		debug: mockLoggerDebug,
		warn: mockLoggerWarn,
		error: mockLoggerError,
		log: mockLoggerLog,
	},
}));

// Mock Supabase client creation to avoid requiring valid URLs
vi.mock('@supabase/supabase-js', () => ({
	createClient: vi.fn(() => ({
		auth: {
			getUser: vi.fn(),
			onAuthStateChange: vi.fn(),
			signInWithOAuth: vi.fn(),
			signOut: vi.fn(),
		},
		from: vi.fn(),
		channel: vi.fn(),
	})),
}));

describe('Database Client', () => {
	beforeEach(() => {
		// Clear any existing window.__ENV__
		delete (globalThis as any).__ENV__;

		// Clear mock calls
		mockLoggerInfo.mockClear();
		mockLoggerDebug.mockClear();
		mockLoggerWarn.mockClear();
		mockLoggerError.mockClear();
		mockLoggerLog.mockClear();
	});

	afterEach(() => {
		// Clean up modules cache to allow re-import with different env
		vi.resetModules();
	});

	test('should detect configured database when credentials present', async () => {
		(globalThis as any).__ENV__ = {
			VITE_DATABASE_URL: 'https://example.supabase.co',
			VITE_DATABASE_ANON_KEY: 'test-key-123',
		};

		const {isDatabaseConfigured} = await import('../../src/cloud-sync/database');

		expect(isDatabaseConfigured()).toBe(true);
	});

	test('should detect unconfigured database when URL missing', async () => {
		(globalThis as any).__ENV__ = {
			VITE_DATABASE_URL: '',
			VITE_DATABASE_ANON_KEY: 'test-key-123',
		};

		const {isDatabaseConfigured} = await import('../../src/cloud-sync/database');

		expect(isDatabaseConfigured()).toBe(false);
	});

	test('should detect unconfigured database when key missing', async () => {
		(globalThis as any).__ENV__ = {
			VITE_DATABASE_URL: 'https://example.supabase.co',
			VITE_DATABASE_ANON_KEY: '',
		};

		const {isDatabaseConfigured} = await import('../../src/cloud-sync/database');

		expect(isDatabaseConfigured()).toBe(false);
	});

	test('should detect unconfigured database when __ENV__ missing', async () => {
		// No window.__ENV__ set

		const {isDatabaseConfigured} = await import('../../src/cloud-sync/database');

		expect(isDatabaseConfigured()).toBe(false);
	});

	test('should create Supabase client with credentials', async () => {
		(globalThis as any).__ENV__ = {
			VITE_DATABASE_URL: 'https://example.supabase.co',
			VITE_DATABASE_ANON_KEY: 'test-key-123',
		};

		const {db} = await import('../../src/cloud-sync/database');

		// Basic smoke test - Supabase client should have expected methods
		expect(db).toBeDefined();
		expect(db.auth).toBeDefined();
		expect(db.from).toBeDefined();
	});

	test('should log info message when database not configured', async () => {
		(globalThis as any).__ENV__ = {
			VITE_DATABASE_URL: '',
			VITE_DATABASE_ANON_KEY: '',
		};

		await import('../../src/cloud-sync/database');

		expect(mockLoggerInfo).toHaveBeenCalledWith(expect.stringContaining('Database not configured'));
	});
});
