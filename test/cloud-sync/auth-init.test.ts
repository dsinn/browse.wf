/**
 * Tests for auth-init.ts global side effects
 *
 * Specifically: __getSupabaseAccessToken behaviour when the database is
 * configured vs. unconfigured (the unconfigured path caused CI failures
 * because db is null and calling db.auth.getSession() throws).
 */
import {
	describe, test, expect, beforeEach, vi,
} from 'vitest';
import {isDatabaseConfigured} from '../../src/cloud-sync/database';

const {mockGetSession} = vi.hoisted(() => ({mockGetSession: vi.fn()}));

vi.mock('../../src/cloud-sync/database', () => ({
	db: {
		auth: {
			getSession: mockGetSession,
		},
	},
	isDatabaseConfigured: vi.fn(),
}));

vi.mock('../../src/cloud-sync/auth', () => ({
	AuthService: {
		getInstance: vi.fn(() => ({
			initialize: vi.fn(),
			isAuthenticated: vi.fn(() => false),
			getCurrentUser: vi.fn(() => null),
			getUserId: vi.fn(() => null),
		})),
	},
}));

vi.mock('../../src/cloud-sync/storage-sync', () => ({
	StorageSyncService: {
		getInstance: vi.fn(() => ({})),
	},
}));

describe('__getSupabaseAccessToken', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		delete (globalThis as any).__getSupabaseAccessToken;
		// Re-import auth-init so its module-level side effects (which set
		// __getSupabaseAccessToken on window) run with the current mock state.
		vi.resetModules();
	});

	test('returns null without calling db when database is not configured', async () => {
		vi.mocked(isDatabaseConfigured).mockReturnValue(false);

		await import('../../src/cloud-sync/auth-init');

		const result = await (globalThis as any).__getSupabaseAccessToken();

		expect(result).toBeNull();
		expect(mockGetSession).not.toHaveBeenCalled();
	});

	test('returns the access token from the session when database is configured', async () => {
		vi.mocked(isDatabaseConfigured).mockReturnValue(true);
		mockGetSession.mockResolvedValue({data: {session: {access_token: 'jwt-abc'}}});

		await import('../../src/cloud-sync/auth-init');

		const result = await (globalThis as any).__getSupabaseAccessToken();

		expect(result).toBe('jwt-abc');
	});

	test('returns null when database is configured but there is no active session', async () => {
		vi.mocked(isDatabaseConfigured).mockReturnValue(true);
		mockGetSession.mockResolvedValue({data: {session: null}});

		await import('../../src/cloud-sync/auth-init');

		const result = await (globalThis as any).__getSupabaseAccessToken();

		expect(result).toBeNull();
	});
});
