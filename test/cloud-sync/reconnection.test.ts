/**
 * Tests for CloudSyncReconnection
 * Exponential backoff state machine, session refresh, and indefinite retry
 */
import {
	describe, test, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {CloudSyncReconnection} from '../../src/cloud-sync/reconnection';
import {db} from '../../src/cloud-sync/database';

vi.mock('../../src/cloud-sync/database', () => ({
	db: {
		auth: {
			refreshSession: vi.fn(),
		},
	},
	isDatabaseConfigured: vi.fn(() => true),
}));

vi.mock('../../src/logger', () => ({
	logger: {
		debug: vi.fn(),
		log: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

describe('CloudSyncReconnection', () => {
	let manager: CloudSyncReconnection;
	let onReconnect: ReturnType<typeof vi.fn<(userId: string) => void>>;
	let currentUserId: string | undefined;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();

		onReconnect = vi.fn<(userId: string) => void>();
		currentUserId = 'test-user-uuid';

		manager = new CloudSyncReconnection(
			userId => {
				onReconnect(userId);
			},
			() => currentUserId,
		);

		vi.mocked(db.auth.refreshSession).mockResolvedValue({
			data: {session: {access_token: 'mock-token'}},
			error: null,
		} as any);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('attemptReconnect', () => {
		test('should call onReconnect after 1.875s on first attempt', async () => {
			manager.attemptReconnect();

			vi.advanceTimersByTime(1874);
			expect(onReconnect).not.toHaveBeenCalled();

			vi.advanceTimersByTime(1);
			await vi.runAllTimersAsync();

			expect(onReconnect).toHaveBeenCalledWith('test-user-uuid');
		});

		test('should use exponential backoff: 1.875s, 3.75s, 7.5s, 15s', async () => {
			// Attempt 1: 1.875s
			manager.attemptReconnect();
			vi.advanceTimersByTime(1874);
			expect(onReconnect).toHaveBeenCalledTimes(0);
			vi.advanceTimersByTime(1);
			await vi.runAllTimersAsync();
			expect(onReconnect).toHaveBeenCalledTimes(1);

			// Attempt 2: 3.75s
			manager.attemptReconnect();
			vi.advanceTimersByTime(3749);
			expect(onReconnect).toHaveBeenCalledTimes(1);
			vi.advanceTimersByTime(1);
			await vi.runAllTimersAsync();
			expect(onReconnect).toHaveBeenCalledTimes(2);

			// Attempt 3: 7.5s
			manager.attemptReconnect();
			vi.advanceTimersByTime(7499);
			expect(onReconnect).toHaveBeenCalledTimes(2);
			vi.advanceTimersByTime(1);
			await vi.runAllTimersAsync();
			expect(onReconnect).toHaveBeenCalledTimes(3);
		});

		test('should cap backoff at 5 minutes (300 seconds)', async () => {
			// Fast-forward to beyond cap: 1.875 * 2^8 = 480s (exceeds 300s cap)
			for (let i = 0; i < 9; i++) {
				manager.attemptReconnect();
				vi.advanceTimersByTime(Math.min(1875 * (2 ** i), 300_000));
				await vi.runAllTimersAsync();
			}

			// Next attempt should use 5 minutes cap
			manager.attemptReconnect();
			vi.advanceTimersByTime(299_999);
			const countBefore = onReconnect.mock.calls.length;

			vi.advanceTimersByTime(1); // Hit 5 minutes
			await vi.runAllTimersAsync();
			expect(onReconnect).toHaveBeenCalledTimes(countBefore + 1);
		});

		test('should escalate through 1.875s, 3.75s, 7.5s, 15s, 30s, 60s', async () => {
			const delays = [1875, 3750, 7500, 15_000, 30_000, 60_000];

			for (const [i, delay] of delays.entries()) {
				manager.attemptReconnect();

				vi.advanceTimersByTime(delay - 1);
				expect(onReconnect).toHaveBeenCalledTimes(i);

				vi.advanceTimersByTime(1);
				await vi.runAllTimersAsync();
				expect(onReconnect).toHaveBeenCalledTimes(i + 1);
			}
		});

		test('should continue retrying indefinitely (no max attempts)', async () => {
			for (let i = 0; i < 21; i++) {
				manager.attemptReconnect();
				vi.advanceTimersByTime(300_000);
				await vi.runAllTimersAsync();
			}

			expect(onReconnect).toHaveBeenCalledTimes(21);
		});

		test('should not reconnect when userId becomes undefined before timer fires', async () => {
			manager.attemptReconnect();
			currentUserId = undefined; // Simulate logout

			vi.advanceTimersByTime(1875);
			await vi.runAllTimersAsync();

			expect(onReconnect).not.toHaveBeenCalled();
		});

		test('should clear pending timer before scheduling a new one', async () => {
			// First call: attempt 1, delay = 1875ms
			manager.attemptReconnect();
			expect(manager.timer).toBeDefined();

			// Second call immediately: clears first timer, attempt 2, delay = 3750ms
			manager.attemptReconnect();

			// After 1875ms (first timer would have fired) — should NOT fire
			vi.advanceTimersByTime(1875);
			expect(onReconnect).not.toHaveBeenCalled();

			// After 3750ms total — second timer fires
			vi.advanceTimersByTime(3750 - 1875);
			await vi.runAllTimersAsync();
			expect(onReconnect).toHaveBeenCalledTimes(1);
		});
	});

	describe('session refresh', () => {
		test('should refresh session before reconnecting', async () => {
			manager.attemptReconnect();
			vi.advanceTimersByTime(1875);
			await vi.runAllTimersAsync();

			expect(db.auth.refreshSession).toHaveBeenCalled();
			expect(onReconnect).toHaveBeenCalled();
		});

		test('should still reconnect when session refresh fails', async () => {
			vi.mocked(db.auth.refreshSession).mockResolvedValue({
				data: {session: null},
				error: {message: 'token expired'},
			} as any);

			manager.attemptReconnect();
			vi.advanceTimersByTime(1875);
			await vi.runAllTimersAsync();

			expect(onReconnect).toHaveBeenCalled();
		});

		test('should still reconnect when session refresh throws', async () => {
			vi.mocked(db.auth.refreshSession).mockRejectedValue(new Error('network timeout'));

			manager.attemptReconnect();
			vi.advanceTimersByTime(1875);
			await vi.runAllTimersAsync();

			expect(onReconnect).toHaveBeenCalled();
		});

		test('should still reconnect when session refresh returns null session (no error)', async () => {
			vi.mocked(db.auth.refreshSession).mockResolvedValue({
				data: {session: null},
				error: null,
			} as any);

			manager.attemptReconnect();
			vi.advanceTimersByTime(1875);
			await vi.runAllTimersAsync();

			expect(onReconnect).toHaveBeenCalled();
		});
	});

	describe('reset', () => {
		test('should clear timer and reset attempt counter', async () => {
			// Make 3 attempts
			for (let i = 0; i < 3; i++) {
				manager.attemptReconnect();
				vi.advanceTimersByTime(1875 * (2 ** i));
				await vi.runAllTimersAsync();
			}

			manager.reset();
			expect(manager.attempts).toBe(0);
			expect(manager.timer).toBeUndefined();
		});

		test('should not clear lastFreshTimestamp', () => {
			manager.lastFreshTimestamp = 12_345;
			manager.reset();
			expect(manager.lastFreshTimestamp).toBe(12_345);
		});

		test('should cancel pending timer so no reconnect fires', async () => {
			manager.attemptReconnect();
			manager.reset();

			vi.advanceTimersByTime(10_000);
			await vi.runAllTimersAsync();

			expect(onReconnect).not.toHaveBeenCalled();
		});

		test('next attempt after reset starts from 1.875s delay', async () => {
			// Make 3 attempts to advance the backoff
			for (let i = 0; i < 3; i++) {
				manager.attemptReconnect();
				vi.advanceTimersByTime(1875 * (2 ** i));
				await vi.runAllTimersAsync();
			}

			manager.reset();
			const countAfterReset = onReconnect.mock.calls.length;

			// Next attempt should restart from 1.875s
			manager.attemptReconnect();
			vi.advanceTimersByTime(1874);
			expect(onReconnect).toHaveBeenCalledTimes(countAfterReset);

			vi.advanceTimersByTime(1);
			await vi.runAllTimersAsync();
			expect(onReconnect).toHaveBeenCalledTimes(countAfterReset + 1);
		});
	});

	describe('clearAll', () => {
		test('should clear timer, attempts, and lastFreshTimestamp', async () => {
			manager.lastFreshTimestamp = 99_999;
			manager.attemptReconnect();

			manager.clearAll();

			expect(manager.attempts).toBe(0);
			expect(manager.timer).toBeUndefined();
			expect(manager.lastFreshTimestamp).toBeUndefined();
		});
	});

	describe('lastFreshTimestamp', () => {
		test('should be readable and writable via getter/setter', () => {
			expect(manager.lastFreshTimestamp).toBeUndefined();
			manager.lastFreshTimestamp = 12_345;
			expect(manager.lastFreshTimestamp).toBe(12_345);
		});
	});
});
