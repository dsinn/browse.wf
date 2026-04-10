/**
 * Tests for AuthService.handleAuthChange (private method, called directly)
 *
 * After the cloud-sync refactor, auth.ts is responsible only for dispatching
 * events — it no longer orchestrates sync. Covered here:
 *
 *  - SIGNED_IN with user → dispatches 'auth-signed-in' with userId detail
 *  - SIGNED_IN without user → no event dispatched
 *  - INITIAL_SESSION with user → dispatches 'auth-signed-in'
 *  - SIGNED_OUT → dispatches 'auth-signed-out' and 'auth-state-changed'
 *  - Unrecognized events → no events dispatched
 */
import {
	describe, test, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {AuthService} from './auth';
import {db} from './database';

vi.mock('../../src/cloud-sync/database', () => ({
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

async function initService() {
	(AuthService as any).instance = undefined;
	const authService = AuthService.getInstance();

	vi.mocked(db.auth.getUser).mockResolvedValue({data: {user: null}, error: null} as any);
	vi.mocked(db.auth.onAuthStateChange).mockReturnValue({data: {subscription: {}}} as any);

	await authService.initialize();

	const call = (event: string, session: any) => {
		(authService as any).handleAuthChange(event, session);
	};

	return {authService, call};
}

beforeEach(() => {
	vi.clearAllMocks();
	(AuthService as any).instance = undefined;
});

afterEach(() => {
	(AuthService as any).instance = undefined;
});

describe('handleAuthChange — SIGNED_IN', () => {
	test('dispatches auth-signed-in with userId on SIGNED_IN with a user', async () => {
		const {call} = await initService();
		const session = {user: {id: 'user-1'}};
		const details: any[] = [];
		globalThis.addEventListener('auth-signed-in', (event: any) => {
			details.push(event.detail);
		});

		call('SIGNED_IN', session);

		expect(details).toHaveLength(1);
		expect(details[0].userId).toBe('user-1');
	});

	test('does not dispatch auth-signed-in when session has no user', async () => {
		const {call} = await initService();
		const events: string[] = [];
		globalThis.addEventListener('auth-signed-in', () => {
			events.push('auth-signed-in');
		});

		call('SIGNED_IN', null);

		expect(events).toHaveLength(0);
	});

	test('dispatches auth-signed-in on every SIGNED_IN (idempotency handled by CloudSyncManager)', async () => {
		const {call} = await initService();
		const session = {user: {id: 'user-1'}};
		const events: string[] = [];
		globalThis.addEventListener('auth-signed-in', () => {
			events.push('auth-signed-in');
		});

		call('SIGNED_IN', session);
		call('SIGNED_IN', session);

		expect(events).toHaveLength(2);
	});
});

describe('handleAuthChange — INITIAL_SESSION', () => {
	test('dispatches auth-signed-in on INITIAL_SESSION with a user', async () => {
		const {call} = await initService();
		const session = {user: {id: 'user-1'}};
		const events: string[] = [];
		globalThis.addEventListener('auth-signed-in', () => {
			events.push('auth-signed-in');
		});

		call('INITIAL_SESSION', session);

		expect(events).toContain('auth-signed-in');
	});
});

describe('handleAuthChange — SIGNED_OUT', () => {
	test('dispatches auth-signed-out on SIGNED_OUT', async () => {
		const {call} = await initService();
		const events: string[] = [];
		globalThis.addEventListener('auth-signed-out', () => {
			events.push('auth-signed-out');
		});

		call('SIGNED_OUT', null);

		expect(events).toContain('auth-signed-out');
	});

	test('dispatches auth-state-changed on SIGNED_OUT', async () => {
		const {call} = await initService();
		const events: string[] = [];
		globalThis.addEventListener('auth-state-changed', () => {
			events.push('auth-state-changed');
		});

		call('SIGNED_OUT', null);

		expect(events).toContain('auth-state-changed');
	});
});

describe('handleAuthChange — unrecognized event', () => {
	test('dispatches no events for unknown event types', async () => {
		const {call} = await initService();
		const events: string[] = [];

		for (const name of ['auth-signed-in', 'auth-signed-out', 'auth-state-changed']) {
			globalThis.addEventListener(name, () => {
				events.push(name);
			});
		}

		call('TOKEN_REFRESHED', {user: {id: 'u1'}});

		expect(events).toHaveLength(0);
	});
});
