/**
 * Tests for auth-init.ts UI functions: updateAuthUI, generateGenericAvatar, showToast,
 * and the registerSyncHandler wiring.
 *
 * The global test setup (setup.ts) loads live.html as the DOM fixture before each test,
 * which already contains #auth-button. We use that element directly.
 */
import {
	describe, test, expect, beforeEach, afterEach, vi,
} from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
	mockInitialize,
	mockIsAuthenticated,
	mockGetCurrentUser,
	mockGetUserId,
	mockSignOut,
	mockSignInWithDiscord,
	mockFlushPendingChanges,
	mockDebouncedPush,
	mockIsDatabaseConfigured,
	mockRegisterSyncHandler,
} = vi.hoisted(() => ({
	mockInitialize: vi.fn(),
	mockIsAuthenticated: vi.fn(() => false),
	mockGetCurrentUser: vi.fn<() => any>(() => null),
	mockGetUserId: vi.fn<() => any>(() => null),
	mockSignOut: vi.fn(async () => undefined),
	mockSignInWithDiscord: vi.fn(),
	mockFlushPendingChanges: vi.fn(),
	mockDebouncedPush: vi.fn(),
	mockIsDatabaseConfigured: vi.fn(() => true),
	mockRegisterSyncHandler: vi.fn(),
}));

vi.mock('../../src/cloud-sync/database', () => ({
	db: {auth: {getSession: vi.fn()}},
	isDatabaseConfigured: mockIsDatabaseConfigured,
}));

vi.mock('../../src/cloud-sync/auth', () => ({
	AuthService: {
		getInstance: vi.fn(() => ({
			initialize: mockInitialize,
			isAuthenticated: mockIsAuthenticated,
			getCurrentUser: mockGetCurrentUser,
			getUserId: mockGetUserId,
			signOut: mockSignOut,
			signInWithDiscord: mockSignInWithDiscord,
		})),
	},
}));

vi.mock('../../src/cloud-sync/storage-sync', () => ({
	StorageSyncService: {
		getInstance: vi.fn(() => ({
			flushPendingChanges: mockFlushPendingChanges,
			debouncedPush: mockDebouncedPush,
		})),
	},
}));

vi.mock('../../src/cloud-sync/trigger', () => ({
	registerSyncHandler: mockRegisterSyncHandler,
}));

// ---------------------------------------------------------------------------
// Helper: import the module fresh and let async initializeAuth() settle
// ---------------------------------------------------------------------------

async function importAuthInit() {
	vi.resetModules();
	await import('../../src/cloud-sync/auth-init');
	// Drain microtasks so the async initialize() chain completes
	for (let i = 0; i < 20; i++) {
		await Promise.resolve();
	}
}

// ---------------------------------------------------------------------------
// updateAuthUI — unauthenticated
// ---------------------------------------------------------------------------

describe('updateAuthUI — unauthenticated', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockIsDatabaseConfigured.mockReturnValue(true);
		mockIsAuthenticated.mockReturnValue(false);
		mockGetCurrentUser.mockReturnValue(null);
	});

	test('renders an anonymous avatar image', async () => {
		await importAuthInit();
		const authButton = document.querySelector('#auth-button')!;
		const img = authButton.querySelector<HTMLImageElement>('img');
		expect(img).not.toBeNull();
		expect(img!.src).toMatch(/^data:image\/svg\+xml;base64,/u);
		expect(img!.getAttribute('alt')).toBe('Anonymous user');
	});

	test('renders a sign-in link', async () => {
		await importAuthInit();
		const authButton = document.querySelector('#auth-button')!;
		const link = authButton.querySelector('#signin-link');
		expect(link).not.toBeNull();
		expect(link!.textContent).toContain('Sign in');
	});

	test('sign-in link click calls signInWithDiscord', async () => {
		await importAuthInit();
		const link = document.querySelector<HTMLElement>('#signin-link')!;
		link.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
		expect(mockSignInWithDiscord).toHaveBeenCalledOnce();
	});
});

// ---------------------------------------------------------------------------
// updateAuthUI — authenticated
// ---------------------------------------------------------------------------

describe('updateAuthUI — authenticated', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockIsDatabaseConfigured.mockReturnValue(true);
		mockIsAuthenticated.mockReturnValue(true);
		mockGetCurrentUser.mockReturnValue({user_metadata: {avatar_url: 'https://cdn.example.com/avatar.png'}});
	});

	test('renders the user avatar from user_metadata.avatar_url', async () => {
		await importAuthInit();
		const authButton = document.querySelector('#auth-button')!;
		const img = authButton.querySelector<HTMLImageElement>('img');
		expect(img).not.toBeNull();
		expect(img!.src).toBe('https://cdn.example.com/avatar.png');
		expect(img!.getAttribute('alt')).toBe('User avatar');
	});

	test('renders a sign-out link', async () => {
		await importAuthInit();
		const authButton = document.querySelector('#auth-button')!;
		const link = authButton.querySelector('#signout-link');
		expect(link).not.toBeNull();
		expect(link!.textContent).toContain('Sign out');
	});

	test('sign-out link click calls signOut', async () => {
		await importAuthInit();
		const link = document.querySelector<HTMLElement>('#signout-link')!;
		link.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
		expect(mockSignOut).toHaveBeenCalledOnce();
	});
});

// ---------------------------------------------------------------------------
// updateAuthUI — authenticated without avatar_url
// ---------------------------------------------------------------------------

describe('updateAuthUI — authenticated without avatar_url', () => {
	test('falls back to generic SVG avatar', async () => {
		vi.clearAllMocks();
		mockIsDatabaseConfigured.mockReturnValue(true);
		mockIsAuthenticated.mockReturnValue(true);
		mockGetCurrentUser.mockReturnValue({user_metadata: {}});

		await importAuthInit();

		const authButton = document.querySelector('#auth-button')!;
		const img = authButton.querySelector<HTMLImageElement>('img');
		expect(img).not.toBeNull();
		expect(img!.src).toMatch(/^data:image\/svg\+xml;base64,/u);
	});
});

// ---------------------------------------------------------------------------
// updateAuthUI — database not configured
// ---------------------------------------------------------------------------

describe('updateAuthUI — database not configured', () => {
	test('hides the auth button when auth-state-changed fires while db is unconfigured', async () => {
		// When isDatabaseConfigured() is false, initializeAuth() returns early without
		// calling updateAuthUI(). updateAuthUI is only reached via the auth-state-changed
		// event listener or subsequent calls. This test triggers it via the event.
		vi.clearAllMocks();
		mockIsDatabaseConfigured.mockReturnValue(true); // Allow initializeAuth to proceed
		mockIsAuthenticated.mockReturnValue(false);
		mockGetCurrentUser.mockReturnValue(null);

		await importAuthInit();

		// Now simulate the database becoming unconfigured and an auth state change
		mockIsDatabaseConfigured.mockReturnValue(false);
		globalThis.dispatchEvent(new CustomEvent('auth-state-changed'));

		const authButton = document.querySelector<HTMLElement>('#auth-button')!;
		expect(authButton.style.display).toBe('none');
	});
});

// ---------------------------------------------------------------------------
// showToast
// ---------------------------------------------------------------------------

describe('showToast', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockIsDatabaseConfigured.mockReturnValue(true);
		mockIsAuthenticated.mockReturnValue(true);
		mockGetCurrentUser.mockReturnValue({user_metadata: {}});
		mockSignOut.mockResolvedValue(undefined);
	});

	afterEach(() => {
		document.querySelector('#toast-container')?.remove();
	});

	test('appends a toast element after sign out', async () => {
		await importAuthInit();

		const link = document.querySelector<HTMLElement>('#signout-link')!;
		link.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
		for (let i = 0; i < 20; i++) {
			await Promise.resolve();
		}

		const toast = document.querySelector('.toast');
		expect(toast).not.toBeNull();
		expect(toast!.textContent).toContain('Signed out successfully');
	});

	test('creates #toast-container if one does not exist', async () => {
		await importAuthInit();

		expect(document.querySelector('#toast-container')).toBeNull();

		const link = document.querySelector<HTMLElement>('#signout-link')!;
		link.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
		for (let i = 0; i < 20; i++) {
			await Promise.resolve();
		}

		expect(document.querySelector('#toast-container')).not.toBeNull();
	});

	test('reuses an existing #toast-container', async () => {
		const existing = document.createElement('div');
		existing.id = 'toast-container';
		document.body.append(existing);

		await importAuthInit();

		const link = document.querySelector<HTMLElement>('#signout-link')!;
		link.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
		for (let i = 0; i < 20; i++) {
			await Promise.resolve();
		}

		expect(document.querySelectorAll('#toast-container')).toHaveLength(1);
	});

	test('calls Bootstrap Toast.show() when bootstrap is present', async () => {
		const mockShow = vi.fn();
		// Bootstrap.Toast must be a real constructor (used with `new`)
		// eslint-disable-next-line @typescript-eslint/naming-convention
		function ToastCtor() {
			return {show: mockShow};
		}

		(globalThis as any).bootstrap = {Toast: ToastCtor};

		await importAuthInit();

		const link = document.querySelector<HTMLElement>('#signout-link')!;
		link.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
		for (let i = 0; i < 20; i++) {
			await Promise.resolve();
		}

		expect(mockShow).toHaveBeenCalledOnce();
		delete (globalThis as any).bootstrap;
	});
});

// ---------------------------------------------------------------------------
// auth-state-changed event
// ---------------------------------------------------------------------------

describe('auth-state-changed event', () => {
	test('re-renders auth button when auth-state-changed fires', async () => {
		vi.clearAllMocks();
		mockIsDatabaseConfigured.mockReturnValue(true);
		mockIsAuthenticated.mockReturnValue(false);
		mockGetCurrentUser.mockReturnValue(null);

		await importAuthInit();

		// Switch to authenticated and fire the event
		mockIsAuthenticated.mockReturnValue(true);
		mockGetCurrentUser.mockReturnValue({user_metadata: {avatar_url: 'https://example.com/pic.png'}});

		globalThis.dispatchEvent(new CustomEvent('auth-state-changed'));

		const authButton = document.querySelector('#auth-button')!;
		const img = authButton.querySelector<HTMLImageElement>('img');
		expect(img).not.toBeNull();
		expect(img!.src).toBe('https://example.com/pic.png');
	});
});

// ---------------------------------------------------------------------------
// registerSyncHandler wiring
// ---------------------------------------------------------------------------

describe('registerSyncHandler wiring', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		mockIsDatabaseConfigured.mockReturnValue(true);
		mockIsAuthenticated.mockReturnValue(false);
		mockGetCurrentUser.mockReturnValue(null);
		await importAuthInit();
	});

	test('registerSyncHandler is called on module load', () => {
		expect(mockRegisterSyncHandler).toHaveBeenCalledOnce();
		expect(mockRegisterSyncHandler).toHaveBeenCalledWith(expect.any(Function));
	});

	test('sync handler calls debouncedPush when userId is present', () => {
		mockGetUserId.mockReturnValue('user-123');
		const handler = mockRegisterSyncHandler.mock.calls[0][0];
		handler();
		expect(mockDebouncedPush).toHaveBeenCalledWith('user-123');
	});

	test('sync handler does not call debouncedPush when userId is null', () => {
		mockGetUserId.mockReturnValue(null);
		const handler = mockRegisterSyncHandler.mock.calls[0][0];
		handler();
		expect(mockDebouncedPush).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// OAuth hash cleanup
// ---------------------------------------------------------------------------

describe('OAuth hash cleanup', () => {
	function mockLocation(hash: string, pathname = '/live', search = '') {
		Object.defineProperty(globalThis, 'location', {
			value: {hash, pathname, search},
			configurable: true,
			writable: true,
		});
	}

	beforeEach(() => {
		vi.clearAllMocks();
		mockIsDatabaseConfigured.mockReturnValue(true);
		mockIsAuthenticated.mockReturnValue(false);
		mockGetCurrentUser.mockReturnValue(null);
		sessionStorage.clear();
	});

	afterEach(() => {
		sessionStorage.clear();
		vi.restoreAllMocks();
	});

	test('removes access_token hash after OAuth redirect', async () => {
		mockLocation('#access_token=abc123&type=bearer');
		const replaced: string[] = [];
		vi.spyOn(history, 'replaceState').mockImplementation((_s, _t, url) => {
			replaced.push(url as string);
		});

		await importAuthInit();

		expect(replaced[0]).not.toContain('access_token');
	});

	test('restores pre-auth hash after OAuth redirect', async () => {
		mockLocation('#access_token=abc123');
		sessionStorage.setItem('pre_auth_hash', '#section-1');
		const replaced: string[] = [];
		vi.spyOn(history, 'replaceState').mockImplementation((_s, _t, url) => {
			replaced.push(url as string);
		});

		await importAuthInit();

		expect(replaced[0]).toContain('#section-1');
		expect(sessionStorage.getItem('pre_auth_hash')).toBeNull();
	});

	test('does not call replaceState when there is no OAuth hash', async () => {
		mockLocation('');
		const replaceState = vi.spyOn(history, 'replaceState');

		await importAuthInit();

		expect(replaceState).not.toHaveBeenCalled();
	});

	test('cleans URL when hash is bare #', async () => {
		mockLocation('#');
		const replaced: string[] = [];
		vi.spyOn(history, 'replaceState').mockImplementation((_s, _t, url) => {
			replaced.push(url as string);
		});

		await importAuthInit();

		expect(replaced[0]).not.toContain('#');
	});
});

// ---------------------------------------------------------------------------
// beforeunload handler
// ---------------------------------------------------------------------------

describe('beforeunload handler', () => {
	test('calls flushPendingChanges when tab closes', async () => {
		vi.clearAllMocks();
		mockIsDatabaseConfigured.mockReturnValue(true);
		mockIsAuthenticated.mockReturnValue(false);
		mockGetCurrentUser.mockReturnValue(null);

		await importAuthInit();

		globalThis.dispatchEvent(new Event('beforeunload'));

		expect(mockFlushPendingChanges).toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// auth-signed-out handler
// ---------------------------------------------------------------------------

describe('auth-signed-out handler', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		mockIsDatabaseConfigured.mockReturnValue(true);
		mockIsAuthenticated.mockReturnValue(false);
		mockGetCurrentUser.mockReturnValue(null);
		await importAuthInit();
	});

	test('flushes and unsubscribes when userId is set', async () => {
		const mockUnsubscribe = vi.fn();
		const {StorageSyncService} = await import('../../src/cloud-sync/storage-sync');
		vi.mocked(StorageSyncService.getInstance).mockReturnValue({
			flushPendingChanges: mockFlushPendingChanges,
			unsubscribeFromRealtimeUpdates: mockUnsubscribe,
		} as any);
		mockGetUserId.mockReturnValue('user-123');

		globalThis.dispatchEvent(new CustomEvent('auth-signed-out'));
		// Drain microtasks
		for (let i = 0; i < 20; i++) {
			await Promise.resolve();
		}

		expect(mockFlushPendingChanges).toHaveBeenCalled();
		expect(mockUnsubscribe).toHaveBeenCalled();
	});

	test('does not flush when no userId', async () => {
		mockGetUserId.mockReturnValue(null);

		globalThis.dispatchEvent(new CustomEvent('auth-signed-out'));
		for (let i = 0; i < 20; i++) {
			await Promise.resolve();
		}

		expect(mockFlushPendingChanges).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// DOMContentLoaded path
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// auth-signed-in handler
// ---------------------------------------------------------------------------

describe('auth-signed-in handler', () => {
	test('calls handleLogin when auth-signed-in fires', async () => {
		vi.clearAllMocks();
		mockIsDatabaseConfigured.mockReturnValue(true);
		mockIsAuthenticated.mockReturnValue(false);
		mockGetCurrentUser.mockReturnValue(null);

		const mockHandleLogin = vi.fn();
		const {StorageSyncService} = await import('../../src/cloud-sync/storage-sync');
		vi.mocked(StorageSyncService.getInstance).mockReturnValue({
			handleLogin: mockHandleLogin,
			flushPendingChanges: mockFlushPendingChanges,
			debouncedPush: mockDebouncedPush,
		} as any);

		await importAuthInit();

		globalThis.dispatchEvent(new CustomEvent('auth-signed-in'));
		for (let i = 0; i < 20; i++) {
			await Promise.resolve();
		}

		expect(mockHandleLogin).toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// updateAuthUI — no auth button
// ---------------------------------------------------------------------------

describe('updateAuthUI — no auth button', () => {
	test('returns early when #auth-button is absent', async () => {
		vi.clearAllMocks();
		mockIsDatabaseConfigured.mockReturnValue(true);
		mockIsAuthenticated.mockReturnValue(false);
		mockGetCurrentUser.mockReturnValue(null);

		// Remove the auth button from the DOM
		const authButton = document.querySelector('#auth-button');
		authButton?.remove();

		// Should not throw when auth-state-changed fires with no button in DOM
		await importAuthInit();
		expect(() => {
			globalThis.dispatchEvent(new CustomEvent('auth-state-changed'));
		}).not.toThrow();

		// Restore auth button (live.html fixture won't re-add it without reload)
		const btn = document.createElement('div');
		btn.id = 'auth-button';
		document.body.append(btn);
	});
});

// ---------------------------------------------------------------------------
// showToast — hidden.bs.toast cleanup
// ---------------------------------------------------------------------------

describe('showToast — toast cleanup on hide', () => {
	test('removes toast element when hidden.bs.toast fires', async () => {
		vi.clearAllMocks();
		mockIsDatabaseConfigured.mockReturnValue(true);
		mockIsAuthenticated.mockReturnValue(true);
		mockGetCurrentUser.mockReturnValue({user_metadata: {}});
		mockSignOut.mockResolvedValue(undefined);

		let capturedToast: HTMLElement | undefined;
		function toastCtor(element: HTMLElement) {
			capturedToast = element;
			return {
				show() {
					return undefined;
				},
			};
		}

		(globalThis as any).bootstrap = {Toast: toastCtor};

		await importAuthInit();

		// Trigger sign-out to show a toast
		const link = document.querySelector<HTMLElement>('#signout-link')!;
		link.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
		for (let i = 0; i < 20; i++) {
			await Promise.resolve();
		}

		expect(capturedToast).toBeDefined();
		const container = capturedToast!.closest('#toast-container');
		expect(container).toBeDefined();

		// Fire the hidden.bs.toast event — should remove the toast
		capturedToast!.dispatchEvent(new Event('hidden.bs.toast'));
		expect(capturedToast!.isConnected).toBe(false);

		container?.remove();
	});
});

describe('DOMContentLoaded path', () => {
	test('calls initializeAuth on DOMContentLoaded when readyState is loading', async () => {
		vi.clearAllMocks();
		mockIsDatabaseConfigured.mockReturnValue(true);
		mockIsAuthenticated.mockReturnValue(false);
		mockGetCurrentUser.mockReturnValue(null);

		Object.defineProperty(document, 'readyState', {value: 'loading', configurable: true});

		vi.resetModules();
		await import('../../src/cloud-sync/auth-init');

		document.dispatchEvent(new Event('DOMContentLoaded'));
		for (let i = 0; i < 20; i++) {
			await Promise.resolve();
		}

		expect(mockInitialize).toHaveBeenCalled();

		Object.defineProperty(document, 'readyState', {value: 'complete', configurable: true});
	});
});
