/**
 * Tests for AuthService
 * Discord OAuth authentication and session management
 */
import {
	describe, test, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {AuthService} from './auth';
import {db, isDatabaseConfigured} from './database';

// Mock the database module
vi.mock('./database', () => ({
	db: {
		auth: {
			getUser: vi.fn(),
			onAuthStateChange: vi.fn(),
			signInWithOAuth: vi.fn(),
			signOut: vi.fn(),
		},
	},
	isDatabaseConfigured: vi.fn(() => true),
}));

// Mock the manager module
vi.mock('./manager', () => ({
	CloudSyncManager: {
		getInstance: vi.fn(() => ({
			handleLogin: vi.fn(),
			unsubscribeFromRealtimeUpdates: vi.fn(),
		})),
	},
}));

describe('AuthService', () => {
	let authService: AuthService;

	beforeEach(() => {
		vi.clearAllMocks();

		// Reset singleton by clearing the instance
		(AuthService as any).instance = undefined;

		authService = AuthService.getInstance();
	});

	afterEach(() => {
		sessionStorage.clear();

		// Clean up singleton
		(AuthService as any).instance = undefined;
	});

	describe('initialize', () => {
		test('should get current user on initialize', async () => {
			const mockUser = {
				id: 'user-123',
				user_metadata: {provider_id: 'discord-456'},
			};

			vi.mocked(db.auth.getUser).mockResolvedValue({
				data: {user: mockUser},
				error: null,
			} as any);

			vi.mocked(db.auth.onAuthStateChange).mockReturnValue({
				data: {subscription: {}},
			} as any);

			await authService.initialize();

			expect(db.auth.getUser).toHaveBeenCalled();
			expect(authService.getCurrentUser()).toEqual(mockUser);
		});

		test('should handle no user on initialize', async () => {
			vi.mocked(db.auth.getUser).mockResolvedValue({
				data: {user: null},
				error: null,
			} as any);

			vi.mocked(db.auth.onAuthStateChange).mockReturnValue({
				data: {subscription: {}},
			} as any);

			await authService.initialize();

			expect(authService.isAuthenticated()).toBe(false);
		});

		test('should set up auth state change listener', async () => {
			vi.mocked(db.auth.getUser).mockResolvedValue({
				data: {user: null},
				error: null,
			} as any);

			vi.mocked(db.auth.onAuthStateChange).mockReturnValue({
				data: {subscription: {}},
			} as any);

			await authService.initialize();

			expect(db.auth.onAuthStateChange).toHaveBeenCalled();
		});
	});

	describe('signInWithDiscord', () => {
		test('should initiate OAuth flow', async () => {
			const mockData = {url: 'https://discord.com/oauth'};

			vi.mocked(db.auth.signInWithOAuth).mockResolvedValue({
				data: mockData,
				error: null,
			} as any);

			// Set up location
			Object.defineProperty(globalThis, 'location', {
				value: {
					origin: 'https://example.com',
					pathname: '/live.html',
					search: '?foo=bar',
					hash: '#test',
				},
				writable: true,
			});

			const result = await authService.signInWithDiscord();

			expect(db.auth.signInWithOAuth).toHaveBeenCalledWith({
				provider: 'discord',
				options: {
					redirectTo: 'https://example.com/live.html?foo=bar',
				},
			});

			expect(result).toEqual(mockData);
		});

		test('should save non-OAuth hash before sign-in', async () => {
			vi.mocked(db.auth.signInWithOAuth).mockResolvedValue({
				data: {},
				error: null,
			} as any);

			Object.defineProperty(globalThis, 'location', {
				value: {
					origin: 'https://example.com',
					pathname: '/arbys.html',
					search: '',
					hash: '#days=30',
				},
				writable: true,
			});

			await authService.signInWithDiscord();

			expect(sessionStorage.getItem('pre_auth_hash')).toBe('#days=30');
		});

		test('should not save OAuth-related hash', async () => {
			vi.mocked(db.auth.signInWithOAuth).mockResolvedValue({
				data: {},
				error: null,
			} as any);

			Object.defineProperty(globalThis, 'location', {
				value: {
					origin: 'https://example.com',
					pathname: '/live.html',
					search: '',
					hash: '#access_token=abc123',
				},
				writable: true,
			});

			await authService.signInWithDiscord();

			expect(sessionStorage.getItem('pre_auth_hash')).toBeNull();
		});

		test('should handle OAuth error', async () => {
			const mockError = new Error('OAuth failed');

			vi.mocked(db.auth.signInWithOAuth).mockResolvedValue({
				data: null,
				error: mockError,
			} as any);

			Object.defineProperty(globalThis, 'location', {
				value: {
					origin: 'https://example.com',
					pathname: '/live.html',
					search: '',
					hash: '',
				},
				writable: true,
			});

			await expect(authService.signInWithDiscord()).rejects.toThrow('OAuth failed');
		});
	});

	describe('signOut', () => {
		test('should sign out successfully', async () => {
			vi.mocked(db.auth.signOut).mockResolvedValue({
				error: null,
			} as any);

			await authService.signOut();

			expect(db.auth.signOut).toHaveBeenCalled();
		});

		test('should handle sign out error', async () => {
			const mockError = new Error('Sign out failed');

			vi.mocked(db.auth.signOut).mockResolvedValue({
				error: mockError,
			} as any);

			await expect(authService.signOut()).rejects.toThrow('Sign out failed');
		});
	});

	describe('getCurrentUser', () => {
		test('should return current user', async () => {
			const mockUser = {
				id: 'user-123',
				user_metadata: {provider_id: 'discord-456'},
			};

			vi.mocked(db.auth.getUser).mockResolvedValue({
				data: {user: mockUser},
				error: null,
			} as any);

			vi.mocked(db.auth.onAuthStateChange).mockReturnValue({
				data: {subscription: {}},
			} as any);

			await authService.initialize();

			expect(authService.getCurrentUser()).toEqual(mockUser);
		});

		test('should return null when not authenticated', () => {
			expect(authService.getCurrentUser()).toBeUndefined();
		});
	});

	describe('isAuthenticated', () => {
		test('should return true when user is logged in', async () => {
			const mockUser = {
				id: 'user-123',
				user_metadata: {provider_id: 'discord-456'},
			};

			vi.mocked(db.auth.getUser).mockResolvedValue({
				data: {user: mockUser},
				error: null,
			} as any);

			vi.mocked(db.auth.onAuthStateChange).mockReturnValue({
				data: {subscription: {}},
			} as any);

			await authService.initialize();

			expect(authService.isAuthenticated()).toBe(true);
		});

		test('should return false when not logged in', () => {
			expect(authService.isAuthenticated()).toBe(false);
		});
	});

	describe('getUserId', () => {
		test('should return user ID when authenticated', async () => {
			const mockUser = {id: 'user-123', user_metadata: {}};
			vi.mocked(db.auth.getUser).mockResolvedValue({data: {user: mockUser}, error: null} as any);
			vi.mocked(db.auth.onAuthStateChange).mockReturnValue({data: {subscription: {}}} as any);
			await authService.initialize();
			expect(authService.getUserId()).toBe('user-123');
		});

		test('should return undefined when not authenticated', () => {
			expect(authService.getUserId()).toBeUndefined();
		});
	});

	describe('getDiscordUserId', () => {
		test('should return Discord user ID from metadata', async () => {
			const mockUser = {
				id: 'user-123',
				user_metadata: {provider_id: 'discord-456'},
			};

			vi.mocked(db.auth.getUser).mockResolvedValue({
				data: {user: mockUser},
				error: null,
			} as any);

			vi.mocked(db.auth.onAuthStateChange).mockReturnValue({
				data: {subscription: {}},
			} as any);

			await authService.initialize();

			expect(authService.getDiscordUserId()).toBe('discord-456');
		});

		test('should return null when not authenticated', () => {
			expect(authService.getDiscordUserId()).toBeUndefined();
		});

		test('should return null when provider_id missing', async () => {
			const mockUser = {
				id: 'user-123',
				user_metadata: {},
			};

			vi.mocked(db.auth.getUser).mockResolvedValue({
				data: {user: mockUser},
				error: null,
			} as any);

			vi.mocked(db.auth.onAuthStateChange).mockReturnValue({
				data: {subscription: {}},
			} as any);

			await authService.initialize();

			expect(authService.getDiscordUserId()).toBeUndefined();
		});
	});

	describe('initialize — auth state change callback', () => {
		test('should update currentUser and dispatch auth event when state changes', async () => {
			vi.useFakeTimers();

			const mockUser = {id: 'user-abc', user_metadata: {}};
			vi.mocked(db.auth.getUser).mockResolvedValue({data: {user: null}, error: null} as any);

			let capturedCallback: ((event: string, session: any) => void) | undefined;
			vi.mocked(db.auth.onAuthStateChange).mockImplementation((cb: any) => {
				capturedCallback = cb;
				return {data: {subscription: {}}} as any;
			});

			await authService.initialize();

			const events: string[] = [];
			globalThis.addEventListener('auth-signed-in', () => {
				events.push('auth-signed-in');
			}, {once: true});

			capturedCallback!('SIGNED_IN', {user: mockUser});
			expect(authService.getCurrentUser()).toEqual(mockUser);

			vi.advanceTimersByTime(0);
			await vi.runAllTimersAsync();

			expect(events).toContain('auth-signed-in');

			vi.useRealTimers();
		});
	});

	describe('initialize — database not configured', () => {
		test('should return early without calling db when not configured', async () => {
			vi.mocked(isDatabaseConfigured).mockReturnValueOnce(false);
			await authService.initialize();
			expect(db.auth.getUser).not.toHaveBeenCalled();
		});
	});

	describe('signInWithDiscord — database not configured', () => {
		test('should throw when database is not configured', async () => {
			vi.mocked(isDatabaseConfigured).mockReturnValueOnce(false);
			await expect(authService.signInWithDiscord()).rejects.toThrow('Database not configured');
		});
	});

	describe('signOut — database not configured', () => {
		test('should return early without calling db when not configured', async () => {
			vi.mocked(isDatabaseConfigured).mockReturnValueOnce(false);
			await authService.signOut();
			expect(db.auth.signOut).not.toHaveBeenCalled();
		});
	});
});
