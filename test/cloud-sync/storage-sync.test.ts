/**
 * Tests for StorageSyncService
 * Core cloud sync logic including bidirectional sync and real-time updates
 */
import {
	describe, test, expect, beforeEach, afterEach, vi,
} from 'vitest';
import type {UserData} from '../../src/cloud-sync/types';
import {StorageSyncService} from '../../src/cloud-sync/storage-sync';
import {db} from '../../src/cloud-sync/database';
import * as loggerModule from '../../src/logger';

// Mock the database module before importing
vi.mock('../../src/cloud-sync/database', () => ({
	db: {
		from: vi.fn(),
		channel: vi.fn(),
		auth: {
			getUser: vi.fn(),
			onAuthStateChange: vi.fn(),
			refreshSession: vi.fn(),
		},
	},
	isDatabaseConfigured: vi.fn(() => true),
}));

// Mock the auth module
vi.mock('../../src/cloud-sync/auth', () => ({
	AuthService: {
		getInstance: vi.fn(() => ({
			getUserId: vi.fn(() => 'mock-user-uuid'),
			getDiscordUserId: vi.fn(() => 'mock-discord-id'),
		})),
	},
}));

// Mock the logger module
vi.mock('../../src/cloud-sync/logger', () => ({
	logger: {
		debug: vi.fn(),
		log: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

// Get mocked logger
const logger = vi.mocked(loggerModule.logger);

describe('StorageSyncService', () => {
	let service: StorageSyncService;
	let mockFromChain: any;
	let mockChannel: any;

	beforeEach(() => {
		// Clear localStorage
		localStorage.clear();

		// Reset all mocks
		vi.clearAllMocks();

		// Setup window globals used by refreshUI
		(globalThis as any).refreshAllCompletionToggles = vi.fn();
		(globalThis as any).refreshCollapseStatus = vi.fn();
		(globalThis as any).refreshNotifStatus = vi.fn();

		// Setup mock Supabase chain
		mockFromChain = {
			select: vi.fn().mockReturnThis(),
			eq: vi.fn().mockReturnThis(),
			single: vi.fn(),
			maybeSingle: vi.fn().mockResolvedValue({data: null}), // Default: no existing data
			upsert: vi.fn(),
		};

		vi.mocked(db.from).mockReturnValue(mockFromChain);

		// Setup mock channel
		mockChannel = {
			on: vi.fn().mockReturnThis(),
			subscribe: vi.fn().mockReturnThis(),
			unsubscribe: vi.fn(),
		};
		vi.mocked(db.channel).mockReturnValue(mockChannel);

		// Get singleton instance and reset per-session state
		service = StorageSyncService.getInstance();
		(service as any).loginSyncComplete = false;
	});

	afterEach(() => {
		localStorage.clear();
		delete (globalThis as any).refreshAllCompletionToggles;
		delete (globalThis as any).refreshCollapseStatus;
		delete (globalThis as any).refreshNotifStatus;
	});

	describe('localStorageToData', () => {
		test('should convert localStorage to UserData object', () => {
			// Setup localStorage
			localStorage.setItem('lang', 'fr');
			localStorage.setItem('live.notif.alert1', 'true');
			localStorage.setItem('live.notif.alert2', 'true');
			localStorage.setItem('live.collapse.section1', 'true');
			localStorage.setItem('oids_completed', '["obj1","obj2"]');

			// Pruning happens via cloud-sync-before-push event (in src/live/sync.ts),
			// not inside pushToDatabase. Here we verify the raw serialization.
			mockFromChain.upsert.mockResolvedValue({error: null});

			const userId = 'test-user-uuid';
			return (service as any).pushToDatabase(userId).then(() => {
				expect(db.from).toHaveBeenCalledWith('user_data');
				expect(mockFromChain.upsert).toHaveBeenCalledWith({
					user_id: userId,
					data: {
						lang: 'fr',
						live: {
							notif: {
								alert1: 'true',
								alert2: 'true',
							},
							collapse: {
								section1: 'true',
							},
						},
						oids_completed: '["obj1","obj2"]',
					},
				});
			});
		});

		test('should handle empty completions', () => {
			localStorage.setItem('lang', 'en');

			mockFromChain.upsert.mockResolvedValue({error: null});

			return (service as any).pushToDatabase('test-user-uuid').then(() => {
				const call = vi.mocked(mockFromChain.upsert).mock.calls[0][0];
				expect(call.data.oids_completed).toBeUndefined();
			});
		});

		test('should include malformed completions JSON as-is (pruning is caller responsibility)', () => {
			localStorage.setItem('lang', 'en');
			localStorage.setItem('oids_completed', 'invalid-json');

			mockFromChain.upsert.mockResolvedValue({error: null});

			return (service as any).pushToDatabase('test-user-uuid').then(() => {
				const call = vi.mocked(mockFromChain.upsert).mock.calls[0][0];
				// Pruning via cloud-sync-before-push event happens before pushToDatabase is called.
				// storage-sync.ts serializes whatever is in localStorage at call time.
				expect(call.data.oids_completed).toBe('invalid-json');
			});
		});

		test('should exclude auth token from cloud sync (security)', () => {
			// Setup localStorage with auth token and regular data
			localStorage.setItem('lang', 'en');
			localStorage.setItem('sb-test-project-auth-token', 'sensitive-auth-token-value');
			localStorage.setItem('live.collapse.news', '1');

			mockFromChain.upsert.mockResolvedValue({error: null});

			return (service as any).pushToDatabase('test-user-uuid').then(() => {
				const call = vi.mocked(mockFromChain.upsert).mock.calls[0][0];

				// Regular data should be present
				expect(call.data.lang).toBe('en');
				expect(call.data.live.collapse.news).toBe('1');

				// Auth token should NOT be in the uploaded data
				expect(call.data.sb).toBeUndefined();
				expect(call.data['sb-test-project-auth-token']).toBeUndefined();

				// Verify auth token is still in localStorage (not removed)
				expect(localStorage.getItem('sb-test-project-auth-token')).toBe('sensitive-auth-token-value');
			});
		});
	});

	describe('dataToLocalStorage', () => {
		test('should convert UserData to localStorage', async () => {
			const userData: UserData = {
				lang: 'fr',
				live: {
					notif: {
						alert1: 'true',
					},
					collapse: {
						section1: 'true',
					},
				},
				oids_completed: '["obj1","obj2"]',
			};

			mockFromChain.single.mockResolvedValue({
				data: {data: userData},
				error: null,
			});

			await (service as any).pullFromDatabase('test-user');

			expect(localStorage.getItem('lang')).toBe('fr');
			expect(localStorage.getItem('live.notif.alert1')).toBe('true');
			expect(localStorage.getItem('live.collapse.section1')).toBe('true');
			expect(localStorage.getItem('oids_completed')).toBe('["obj1","obj2"]');
		});

		test('should clear localStorage keys not in cloud data', async () => {
			localStorage.setItem('live.notif.alert1', 'true');

			const userData: UserData = {
				lang: 'en',
			};

			mockFromChain.single.mockResolvedValue({
				data: {data: userData},
				error: null,
			});

			await (service as any).pullFromDatabase('test-user');

			// Keys not in cloud data are removed (except auth token)
			expect(localStorage.getItem('live.notif.alert1')).toBeNull();
		});

		test('should preserve auth token when pulling from cloud (security)', async () => {
			// Setup auth token and some other data
			localStorage.setItem('sb-test-project-auth-token', 'sensitive-auth-token-value');
			localStorage.setItem('live.notif.alert1', 'true');

			const userData: UserData = {
				lang: 'en',
			};

			mockFromChain.single.mockResolvedValue({
				data: {data: userData},
				error: null,
			});

			await (service as any).pullFromDatabase('test-user');

			// Regular data should be replaced
			expect(localStorage.getItem('lang')).toBe('en');
			expect(localStorage.getItem('live.notif.alert1')).toBeNull();

			// Auth token should be preserved (not cleared)
			expect(localStorage.getItem('sb-test-project-auth-token')).toBe('sensitive-auth-token-value');
		});

		test('should dispatch cloud-sync-pulled after pulling data', async () => {
			const userData: UserData = {
				lang: 'en',
			};

			mockFromChain.single.mockResolvedValue({
				data: {data: userData},
				error: null,
			});

			const events: string[] = [];
			globalThis.addEventListener('cloud-sync-pulled', () => {
				events.push('cloud-sync-pulled');
			}, {once: true});

			await (service as any).pullFromDatabase('test-user');

			expect(events).toContain('cloud-sync-pulled');
		});
	});

	describe('handleLogin', () => {
		test('should push to database on first login (no remote data)', async () => {
			localStorage.setItem('lang', 'en');

			mockFromChain.single.mockResolvedValue({
				data: null,
				error: {code: 'PGRST116'}, // Not found error
			});

			mockFromChain.upsert.mockResolvedValue({error: null});

			await service.handleLogin();

			expect(mockFromChain.upsert).toHaveBeenCalled();
			expect(db.channel).toHaveBeenCalled(); // Should subscribe to real-time
		});

		test('should pull from database when remote data exists (cloud is source of truth)', async () => {
			const remoteData: UserData = {
				lang: 'fr',
			};

			mockFromChain.single.mockResolvedValue({
				data: {
					data: remoteData,
				},
				error: null,
			});

			const events: string[] = [];
			globalThis.addEventListener('cloud-sync-pulled', () => {
				events.push('cloud-sync-pulled');
			}, {once: true});

			await service.handleLogin();

			expect(localStorage.getItem('lang')).toBe('fr');
			expect(events).toContain('cloud-sync-pulled');
		});
	});

	describe('saveWithFallback', () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		test('should save to localStorage immediately', async () => {
			await service.saveWithFallback('test-key', 'test-value');

			expect(localStorage.getItem('test-key')).toBe('test-value');
		});

		test('should debounce database push for 5 seconds', async () => {
			mockFromChain.upsert.mockResolvedValue({error: null});

			await service.saveWithFallback('test-key', 'test-value');

			// Should not push immediately
			expect(mockFromChain.upsert).not.toHaveBeenCalled();

			// Fast-forward 4 seconds - still no push
			vi.advanceTimersByTime(4000);
			expect(mockFromChain.upsert).not.toHaveBeenCalled();

			// Fast-forward 1 more second - should push
			vi.advanceTimersByTime(1000);
			await vi.runAllTimersAsync();

			expect(mockFromChain.upsert).toHaveBeenCalled();
		});

		test('should reset debounce timer on subsequent saves', async () => {
			mockFromChain.upsert.mockResolvedValue({error: null});

			await service.saveWithFallback('key1', 'value1');
			vi.advanceTimersByTime(3000);

			await service.saveWithFallback('key2', 'value2');
			vi.advanceTimersByTime(3000);

			// First timer was cancelled, so only 1 push after second timer completes
			expect(mockFromChain.upsert).not.toHaveBeenCalled();

			vi.advanceTimersByTime(2000);
			await vi.runAllTimersAsync();

			expect(mockFromChain.upsert).toHaveBeenCalledTimes(1);
		});

		test('should handle database push failure gracefully', async () => {
			mockFromChain.upsert.mockRejectedValue(new Error('Network error'));

			await service.saveWithFallback('test-key', 'test-value');

			vi.advanceTimersByTime(5000);
			await vi.runAllTimersAsync();

			// Should not throw - data still in localStorage
			expect(localStorage.getItem('test-key')).toBe('test-value');
		});
	});

	describe('subscribeToRealtimeUpdates', () => {
		test('should subscribe to user_data updates', () => {
			service.subscribeToRealtimeUpdates('test-user-uuid');

			expect(db.channel).toHaveBeenCalledWith('user_data:test-user-uuid');
			expect(mockChannel.on).toHaveBeenCalledWith(
				'postgres_changes',
				{
					event: 'UPDATE',
					schema: 'public',
					table: 'user_data',
					filter: 'user_id=eq.test-user-uuid',
				},
				expect.any(Function),
			);
			expect(mockChannel.subscribe).toHaveBeenCalled();
		});

		test('should pull data when remote update received', async () => {
			const userData: UserData = {
				lang: 'fr',
			};

			mockFromChain.single.mockResolvedValue({
				data: {data: userData},
				error: null,
			});

			service.subscribeToRealtimeUpdates('test-user-uuid');

			// Get the callback passed to .on()
			const updateCallback = vi.mocked(mockChannel.on).mock.calls[0][2];

			// Trigger update
			await updateCallback({new: userData});

			expect(mockFromChain.select).toHaveBeenCalled();
			expect(localStorage.getItem('lang')).toBe('fr');
		});

		test('should unsubscribe when called', () => {
			service.subscribeToRealtimeUpdates('test-user-uuid');
			service.unsubscribeFromRealtimeUpdates();

			expect(mockChannel.unsubscribe).toHaveBeenCalled();
		});

		test('should ignore own update after push (justPushed flag)', async () => {
			service.subscribeToRealtimeUpdates('test-user-uuid');

			// Get the WebSocket update callback
			const updateCallback = vi.mocked(mockChannel.on).mock.calls[0][2];

			// Perform a push
			mockFromChain.upsert.mockResolvedValue({error: null});
			await (service as any).pushToDatabase('test-user-uuid');

			// Trigger WebSocket update immediately after push
			const pullsBefore: number = vi.mocked(mockFromChain.select).mock.calls.length;
			await updateCallback({new: {lang: 'fr'}});

			// Should NOT trigger pull (justPushed flag is set)
			expect(mockFromChain.select).toHaveBeenCalledTimes(pullsBefore);
		});

		test('should pull update after justPushed flag clears (5 seconds)', async () => {
			vi.useFakeTimers();

			service.subscribeToRealtimeUpdates('test-user-uuid');
			const updateCallback = vi.mocked(mockChannel.on).mock.calls[0][2];

			// Perform a push
			mockFromChain.upsert.mockResolvedValue({error: null});
			await (service as any).pushToDatabase('test-user-uuid');

			// Fast-forward 5 seconds (flag should clear)
			vi.advanceTimersByTime(5000);
			await vi.runAllTimersAsync();

			// Now trigger WebSocket update
			mockFromChain.single.mockResolvedValue({
				data: {data: {lang: 'fr'}},
				error: null,
			});

			const pullsBefore: number = vi.mocked(mockFromChain.select).mock.calls.length;
			await updateCallback({new: {lang: 'fr'}});

			// Should trigger pull (flag has cleared)
			expect(mockFromChain.select).toHaveBeenCalledTimes(pullsBefore + 1);

			vi.useRealTimers();
		});

		test('should set justPushed flag in handleLogin', async () => {
			vi.useFakeTimers();

			// First login - no remote data
			mockFromChain.single.mockResolvedValue({
				data: null,
				error: {code: 'PGRST116'},
			});
			mockFromChain.upsert.mockResolvedValue({error: null});

			await service.handleLogin();

			// Get WebSocket callback
			const updateCallback = vi.mocked(mockChannel.on).mock.calls[0][2];

			// Trigger update immediately after first login push
			const pullsBefore: number = vi.mocked(mockFromChain.select).mock.calls.length;
			await updateCallback({new: {lang: 'fr'}});

			// Should NOT trigger pull (justPushed flag is set)
			expect(mockFromChain.select).toHaveBeenCalledTimes(pullsBefore);

			vi.useRealTimers();
		});
	});

	describe('WebSocket Reconnection', () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		test('should trigger reconnect on CLOSED status', async () => {
			// Setup: Mock auth refresh
			vi.mocked(db.auth.refreshSession).mockResolvedValue({
				data: {session: {access_token: 'mock-token'}},
				error: null,
			} as any);

			service.subscribeToRealtimeUpdates('test-user-uuid');

			// Get the subscribe callback
			const subscribeCallback = vi.mocked(mockChannel.subscribe).mock.calls[0][0];

			const initialChannelCalls: number = vi.mocked(db.channel).mock.calls.length;

			// Trigger CLOSED status
			await subscribeCallback('CLOSED');

			// Fast-forward 1.875 seconds
			vi.advanceTimersByTime(1875);
			await vi.runAllTimersAsync();

			// Should attempt to reconnect (db.channel called again)
			expect(db.channel).toHaveBeenCalledTimes(initialChannelCalls + 1);
			expect(db.channel).toHaveBeenCalledWith('user_data:test-user-uuid');
		});

		test('should use exponential backoff: 1.875s, 3.75s, 7.5s, 15s', async () => {
			vi.mocked(db.auth.refreshSession).mockResolvedValue({
				data: {session: {access_token: 'mock-token'}},
				error: null,
			} as any);

			service.subscribeToRealtimeUpdates('test-user-uuid');
			const subscribeCallback = vi.mocked(mockChannel.subscribe).mock.calls[0][0];

			const initialCalls: number = vi.mocked(db.channel).mock.calls.length;

			// Attempt 1: 1.875 second delay
			await subscribeCallback('CLOSED');
			vi.advanceTimersByTime(1874); // Just before 1.875 seconds
			expect(db.channel).toHaveBeenCalledTimes(initialCalls); // No reconnect yet

			vi.advanceTimersByTime(1); // Hit 1.875 seconds
			await vi.runAllTimersAsync();
			expect(db.channel).toHaveBeenCalledTimes(initialCalls + 1); // Reconnected!

			// Attempt 2: 3.75 second delay
			await subscribeCallback('TIMED_OUT');
			vi.advanceTimersByTime(3749); // Just before 3.75 seconds
			expect(db.channel).toHaveBeenCalledTimes(initialCalls + 1); // No reconnect yet

			vi.advanceTimersByTime(1); // Hit 3.75 seconds
			await vi.runAllTimersAsync();
			expect(db.channel).toHaveBeenCalledTimes(initialCalls + 2); // Reconnected!

			// Attempt 3: 7.5 second delay
			await subscribeCallback('CHANNEL_ERROR');
			vi.advanceTimersByTime(7499); // Just before 7.5 seconds
			expect(db.channel).toHaveBeenCalledTimes(initialCalls + 2); // No reconnect yet

			vi.advanceTimersByTime(1); // Hit 7.5 seconds
			await vi.runAllTimersAsync();
			expect(db.channel).toHaveBeenCalledTimes(initialCalls + 3); // Reconnected!
		});

		test('should cap backoff at 5 minutes (300 seconds)', async () => {
			vi.mocked(db.auth.refreshSession).mockResolvedValue({
				data: {session: {access_token: 'mock-token'}},
				error: null,
			} as any);

			service.subscribeToRealtimeUpdates('test-user-uuid');
			const subscribeCallback = vi.mocked(mockChannel.subscribe).mock.calls[0][0];

			const initialCalls: number = vi.mocked(db.channel).mock.calls.length;

			// Trigger many failures to reach the cap
			// 1.875s * 2^0 = 1.875s
			// 1.875s * 2^1 = 3.75s
			// 1.875s * 2^2 = 7.5s
			// 1.875s * 2^3 = 15s
			// 1.875s * 2^4 = 30s
			// 1.875s * 2^5 = 60s
			// 1.875s * 2^6 = 120s
			// 1.875s * 2^7 = 240s
			// 1.875s * 2^8 = 480s (exceeds 300s cap)
			for (let i = 0; i < 9; i++) {
				await subscribeCallback('CLOSED');
				vi.advanceTimersByTime(Math.min(1875 * (2 ** i), 300_000));
				await vi.runAllTimersAsync();
			}

			// Next attempt should use 5 minutes (capped) - test by ensuring it doesn't reconnect before 5 minutes
			await subscribeCallback('CLOSED');
			const callsBeforeWait: number = vi.mocked(db.channel).mock.calls.length;

			vi.advanceTimersByTime(299_999); // Just before 5 minutes
			expect(db.channel).toHaveBeenCalledTimes(callsBeforeWait); // No reconnect yet

			vi.advanceTimersByTime(1); // Hit 5 minutes
			await vi.runAllTimersAsync();
			expect(db.channel).toHaveBeenCalledTimes(callsBeforeWait + 1); // Reconnected!
		});

		test('should escalate to longer delays for extended outages', async () => {
			vi.mocked(db.auth.refreshSession).mockResolvedValue({
				data: {session: {access_token: 'mock-token'}},
				error: null,
			} as any);

			service.subscribeToRealtimeUpdates('test-user-uuid');
			const subscribeCallback = vi.mocked(mockChannel.subscribe).mock.calls[0][0];

			const initialCalls: number = vi.mocked(db.channel).mock.calls.length;

			// Simulate extended outage with exponentially increasing delays
			// 1.875s, 3.75s, 7.5s, 15s, 30s, 60s
			const delays = [1875, 3750, 7500, 15_000, 30_000, 60_000];

			for (const [i, delay] of delays.entries()) {
				await subscribeCallback('CLOSED');

				// Verify it doesn't reconnect before the delay
				vi.advanceTimersByTime(delay - 1);
				expect(db.channel).toHaveBeenCalledTimes(initialCalls + i);

				// Hit the delay threshold and reconnect
				vi.advanceTimersByTime(1);
				await vi.runAllTimersAsync();
				expect(db.channel).toHaveBeenCalledTimes(initialCalls + i + 1);
			}
		});

		test('should track last connection timestamp', async () => {
			vi.mocked(db.auth.refreshSession).mockResolvedValue({
				data: {session: {access_token: 'mock-token'}},
				error: null,
			} as any);

			// Set last known fresh data timestamp
			const testTimestamp = Date.now();
			(service as any).lastKnownFreshDataTimestamp = testTimestamp;

			service.subscribeToRealtimeUpdates('test-user-uuid');
			const subscribeCallback = vi.mocked(mockChannel.subscribe).mock.calls[0][0];

			// Trigger a failure
			await subscribeCallback('CLOSED');

			// Verify timestamp is still set (implementation maintains it during reconnection)
			expect((service as any).lastKnownFreshDataTimestamp).toBe(testTimestamp);
		});

		test('should track when connection has never succeeded', async () => {
			vi.mocked(db.auth.refreshSession).mockResolvedValue({
				data: {session: {access_token: 'mock-token'}},
				error: null,
			} as any);

			// Ensure lastKnownFreshDataTimestamp is null (never connected)
			(service as any).lastKnownFreshDataTimestamp = null;

			service.subscribeToRealtimeUpdates('test-user-uuid');
			const subscribeCallback = vi.mocked(mockChannel.subscribe).mock.calls[0][0];

			// Trigger a failure
			await subscribeCallback('CLOSED');

			// Verify timestamp is still null (no successful connection)
			expect((service as any).lastKnownFreshDataTimestamp).toBeNull();
		});

		test('should continue retrying indefinitely (no max attempts)', async () => {
			vi.mocked(db.auth.refreshSession).mockResolvedValue({
				data: {session: {access_token: 'mock-token'}},
				error: null,
			} as any);

			service.subscribeToRealtimeUpdates('test-user-uuid');
			const subscribeCallback = vi.mocked(mockChannel.subscribe).mock.calls[0][0];

			const initialCalls: number = vi.mocked(db.channel).mock.calls.length;

			// Simulate 20 consecutive failures (well beyond old 10-attempt limit)
			for (let i = 0; i < 20; i++) {
				await subscribeCallback('CLOSED');
				vi.advanceTimersByTime(300_000); // Use max backoff (5 minutes)
				await vi.runAllTimersAsync();
			}

			// Should still be able to reconnect (attempt 21)
			await subscribeCallback('CLOSED');
			vi.advanceTimersByTime(300_000);
			await vi.runAllTimersAsync();

			// Verify we reconnected 21 times (never gave up)
			expect(db.channel).toHaveBeenCalledTimes(initialCalls + 21);
		});

		test('should clear pending reconnect timer when SUBSCRIBED fires before timer', async () => {
			vi.useFakeTimers();

			vi.mocked(db.auth.refreshSession).mockResolvedValue({
				data: {session: {access_token: 'tok'}},
				error: null,
			} as any);

			service.subscribeToRealtimeUpdates('test-user-uuid');
			const subscribeCallback = vi.mocked(mockChannel.subscribe).mock.calls[0][0];

			// Trigger a failure — starts reconnect timer
			await subscribeCallback('CLOSED');
			expect((service as any).reconnectTimer).toBeDefined();

			// SUBSCRIBED fires before the timer — should cancel it
			(service as any).hasSubscribedBefore = true;
			(service as any).lastKnownFreshDataTimestamp = Date.now() - 5000; // Recent
			await subscribeCallback('SUBSCRIBED');

			expect((service as any).reconnectTimer).toBeUndefined();

			// Reset state leaked to singleton
			(service as any).hasSubscribedBefore = false;
			(service as any).reconnectAttempts = 0;

			vi.useRealTimers();
		});

		test('should reset reconnect counter on successful connection', async () => {
			vi.mocked(db.auth.refreshSession).mockResolvedValue({
				data: {session: {access_token: 'mock-token'}},
				error: null,
			} as any);

			service.subscribeToRealtimeUpdates('test-user-uuid');
			const subscribeCallback = vi.mocked(mockChannel.subscribe).mock.calls[0][0];

			// Fail 3 times
			for (let i = 0; i < 3; i++) {
				await subscribeCallback('CLOSED');
				vi.advanceTimersByTime(1875 * (2 ** i));
				await vi.runAllTimersAsync();
			}

			// Succeed
			await subscribeCallback('SUBSCRIBED');

			const callsAfterSuccess: number = vi.mocked(db.channel).mock.calls.length;

			// Next failure should restart from attempt 1 (1.875 second delay)
			await subscribeCallback('CLOSED');
			vi.advanceTimersByTime(1874); // Just before 1.875 seconds
			expect(db.channel).toHaveBeenCalledTimes(callsAfterSuccess); // No reconnect yet

			vi.advanceTimersByTime(1); // Hit 1.875 seconds
			await vi.runAllTimersAsync();
			expect(db.channel).toHaveBeenCalledTimes(callsAfterSuccess + 1); // Reconnected with 1.875s delay!
		});

		test('should skip pull on SUBSCRIBED reconnect when heartbeat is recent', async () => {
			vi.useFakeTimers();

			// Simulate a prior subscription
			(service as any).hasSubscribedBefore = true;
			// Heartbeat was 5 seconds ago (within 10s threshold)
			(service as any).lastKnownFreshDataTimestamp = Date.now() - 5000;

			service.subscribeToRealtimeUpdates('test-user-uuid');
			const subscribeCallback = vi.mocked(mockChannel.subscribe).mock.calls[0][0];

			const selectCallsBefore: number = vi.mocked(mockFromChain.select).mock.calls.length;

			// SUBSCRIBED after recent heartbeat — should skip pull
			await subscribeCallback('SUBSCRIBED');

			expect(mockFromChain.select).toHaveBeenCalledTimes(selectCallsBefore);

			vi.useRealTimers();
		});

		test('should pull on SUBSCRIBED reconnect when heartbeat is stale', async () => {
			vi.useFakeTimers();

			(service as any).hasSubscribedBefore = true;
			// Heartbeat was 20 seconds ago (beyond 10s threshold)
			(service as any).lastKnownFreshDataTimestamp = Date.now() - 20_000;

			mockFromChain.single.mockResolvedValue({
				data: {data: {lang: 'fr'}},
				error: null,
			});

			service.subscribeToRealtimeUpdates('test-user-uuid');
			const subscribeCallback = vi.mocked(mockChannel.subscribe).mock.calls[0][0];

			await subscribeCallback('SUBSCRIBED');

			expect(mockFromChain.select).toHaveBeenCalled();

			vi.useRealTimers();
		});

		test('should skip pull on SUBSCRIBED reconnect when syncing is in progress', async () => {
			vi.useFakeTimers();

			(service as any).hasSubscribedBefore = true;
			(service as any).lastKnownFreshDataTimestamp = Date.now() - 20_000; // Stale
			(service as any).syncing = true;

			service.subscribeToRealtimeUpdates('test-user-uuid');
			const subscribeCallback = vi.mocked(mockChannel.subscribe).mock.calls[0][0];

			const selectCallsBefore: number = vi.mocked(mockFromChain.select).mock.calls.length;
			await subscribeCallback('SUBSCRIBED');

			expect(mockFromChain.select).toHaveBeenCalledTimes(selectCallsBefore);

			(service as any).syncing = false;
			vi.useRealTimers();
		});

		test('should skip pull on SUBSCRIBED reconnect when no heartbeat (first sub sets flag)', async () => {
			// HasSubscribedBefore = false (default for new subscribe)
			(service as any).hasSubscribedBefore = false;

			service.subscribeToRealtimeUpdates('test-user-uuid');
			const subscribeCallback = vi.mocked(mockChannel.subscribe).mock.calls[0][0];

			const selectCallsBefore: number = vi.mocked(mockFromChain.select).mock.calls.length;
			await subscribeCallback('SUBSCRIBED');

			// First-ever SUBSCRIBED — no pull, just marks flag
			expect(mockFromChain.select).toHaveBeenCalledTimes(selectCallsBefore);
			expect((service as any).hasSubscribedBefore).toBe(true);
		});

		test('should skip remote update pull when syncing is already in progress', async () => {
			service.subscribeToRealtimeUpdates('test-user-uuid');
			const updateCallback = vi.mocked(mockChannel.on).mock.calls[0][2];

			(service as any).syncing = true;

			const selectCallsBefore: number = vi.mocked(mockFromChain.select).mock.calls.length;
			await updateCallback({});

			expect(mockFromChain.select).toHaveBeenCalledTimes(selectCallsBefore);

			(service as any).syncing = false;
		});

		test('should handle session refresh failure gracefully during reconnect', async () => {
			vi.useFakeTimers();

			vi.mocked(db.auth.refreshSession).mockResolvedValue({
				data: {session: null},
				error: {message: 'token expired'},
			} as any);

			service.subscribeToRealtimeUpdates('test-user-uuid');
			const subscribeCallback = vi.mocked(mockChannel.subscribe).mock.calls[0][0];
			const initialCalls: number = vi.mocked(db.channel).mock.calls.length;

			await subscribeCallback('CLOSED');
			vi.advanceTimersByTime(1875);
			await vi.runAllTimersAsync();

			// Despite session refresh failure, should still attempt reconnect
			expect(db.channel).toHaveBeenCalledTimes(initialCalls + 1);

			vi.useRealTimers();
		});

		test('should handle session refresh exception gracefully during reconnect', async () => {
			vi.useFakeTimers();

			vi.mocked(db.auth.refreshSession).mockRejectedValue(new Error('network timeout'));

			service.subscribeToRealtimeUpdates('test-user-uuid');
			const subscribeCallback = vi.mocked(mockChannel.subscribe).mock.calls[0][0];
			const initialCalls: number = vi.mocked(db.channel).mock.calls.length;

			await subscribeCallback('CLOSED');
			vi.advanceTimersByTime(1875);
			await vi.runAllTimersAsync();

			// Despite session refresh exception, should still attempt reconnect
			expect(db.channel).toHaveBeenCalledTimes(initialCalls + 1);

			vi.useRealTimers();
		});

		test('should not reconnect when currentUserId is unset (after unsubscribe)', async () => {
			vi.useFakeTimers();

			vi.mocked(db.auth.refreshSession).mockResolvedValue({
				data: {session: {access_token: 'tok'}},
				error: null,
			} as any);

			service.subscribeToRealtimeUpdates('test-user-uuid');
			const subscribeCallback = vi.mocked(mockChannel.subscribe).mock.calls[0][0];
			const initialCalls: number = vi.mocked(db.channel).mock.calls.length;

			// Trigger failure then clear userId before timer fires
			await subscribeCallback('CLOSED');
			(service as any).currentUserId = undefined;

			vi.advanceTimersByTime(1875);
			await vi.runAllTimersAsync();

			// Should not reconnect without a userId
			expect(db.channel).toHaveBeenCalledTimes(initialCalls);

			vi.useRealTimers();
		});

		test('should continue retrying on attempt 6 (60s delay)', async () => {
			vi.useFakeTimers();

			vi.mocked(db.auth.refreshSession).mockResolvedValue({
				data: {session: {access_token: 'tok'}},
				error: null,
			} as any);

			service.subscribeToRealtimeUpdates('test-user-uuid');
			const subscribeCallback = vi.mocked(mockChannel.subscribe).mock.calls[0][0];
			const initialCalls: number = vi.mocked(db.channel).mock.calls.length;

			// Advance to attempt 6 (1.875 * 2^5 = 60s delay)
			for (let i = 0; i < 5; i++) {
				await subscribeCallback('CLOSED');
				vi.advanceTimersByTime(Math.min(1875 * (2 ** i), 300_000));
				await vi.runAllTimersAsync();
			}

			// Attempt 6 has 60s delay — verify it reconnects after 60s
			await subscribeCallback('CLOSED');
			vi.advanceTimersByTime(59_999); // Just before
			expect(db.channel).toHaveBeenCalledTimes(initialCalls + 5); // Still waiting

			vi.advanceTimersByTime(1); // Hit 60s
			await vi.runAllTimersAsync();
			expect(db.channel).toHaveBeenCalledTimes(initialCalls + 6); // Reconnected

			vi.useRealTimers();
		});

		test('should clear reconnect timer on unsubscribe', async () => {
			vi.mocked(db.auth.refreshSession).mockResolvedValue({
				data: {session: {access_token: 'mock-token'}},
				error: null,
			} as any);

			service.subscribeToRealtimeUpdates('test-user-uuid');
			const subscribeCallback = vi.mocked(mockChannel.subscribe).mock.calls[0][0];

			// Trigger reconnection
			await subscribeCallback('CLOSED');

			// Unsubscribe before timer fires
			service.unsubscribeFromRealtimeUpdates();

			// Fast-forward past timer
			vi.advanceTimersByTime(10_000);
			await vi.runAllTimersAsync();

			// Should not attempt to reconnect
			const channelCallCount = vi.mocked(db.channel).mock.calls.length;
			expect(channelCallCount).toBe(1); // Only initial subscription
		});
	});

	describe('pushToDatabase error handling', () => {
		test('should clear justPushed flag and rethrow on upsert error', async () => {
			mockFromChain.upsert.mockResolvedValue({error: {message: 'DB write failed'}});

			await expect((service as any).pushToDatabase('test-user')).rejects.toThrow('DB write failed');
			expect((service as any).justPushed).toBe(false);
		});

		test('should clear justPushed and justPushedTimeout when upsert rejects', async () => {
			vi.useFakeTimers();

			// First a successful push to start the timeout
			mockFromChain.upsert.mockResolvedValue({error: null});
			await (service as any).pushToDatabase('test-user');
			expect((service as any).justPushed).toBe(true);
			expect((service as any).justPushedTimeout).toBeDefined();

			// Now fail a second push — existing timeout should be cleared too
			mockFromChain.upsert.mockResolvedValue({error: {message: 'fail'}});
			await expect((service as any).pushToDatabase('test-user')).rejects.toThrow();

			expect((service as any).justPushed).toBe(false);
			expect((service as any).justPushedTimeout).toBeUndefined();

			vi.useRealTimers();
		});

		test('should dispatch cloud-sync-before-push before serializing', async () => {
			mockFromChain.upsert.mockResolvedValue({error: null});

			const events: string[] = [];
			globalThis.addEventListener('cloud-sync-before-push', () => {
				events.push('cloud-sync-before-push');
			}, {once: true});

			await (service as any).pushToDatabase('test-user');

			expect(events).toContain('cloud-sync-before-push');
		});
	});

	describe('pullFromDatabase edge cases', () => {
		test('should throw when db returns an error', async () => {
			mockFromChain.single.mockResolvedValue({
				data: null,
				error: {message: 'connection reset'},
			});

			await expect((service as any).pullFromDatabase('test-user')).rejects.toThrow('connection reset');
		});

		test('should do nothing when row is null (no data)', async () => {
			mockFromChain.single.mockResolvedValue({data: null, error: null});

			await (service as any).pullFromDatabase('test-user');

			// No keys restored, no event dispatched
			expect(localStorage.length).toBe(0);
		});
	});

	describe('handleLogin edge cases', () => {
		test('should throw and dispatch cloud-sync-error when userId is missing', async () => {
			const {AuthService} = await import('../../src/cloud-sync/auth');
			vi.mocked(AuthService.getInstance).mockReturnValueOnce({
				getUserId: vi.fn(() => undefined),
			} as any);

			const events: string[] = [];
			globalThis.addEventListener('cloud-sync-error', () => {
				events.push('cloud-sync-error');
			}, {once: true});

			await service.handleLogin();

			expect(events).toContain('cloud-sync-error');
		});

		test('should be a no-op when syncing is already in progress', async () => {
			(service as any).syncing = true;

			await service.handleLogin();

			expect(mockFromChain.select).not.toHaveBeenCalled();

			(service as any).syncing = false;
		});

		test('should dispatch cloud-sync-complete on successful first login push', async () => {
			mockFromChain.single.mockResolvedValue({data: null, error: {code: 'PGRST116'}});
			mockFromChain.upsert.mockResolvedValue({error: null});

			const events: string[] = [];
			globalThis.addEventListener('cloud-sync-complete', () => {
				events.push('cloud-sync-complete');
			}, {once: true});

			await service.handleLogin();

			expect(events).toContain('cloud-sync-complete');
		});

		test('should dispatch cloud-sync-error when push fails during first login', async () => {
			mockFromChain.single.mockResolvedValue({data: null, error: {code: 'PGRST116'}});
			mockFromChain.upsert.mockResolvedValue({error: {message: 'write failed'}});

			const events: string[] = [];
			globalThis.addEventListener('cloud-sync-error', () => {
				events.push('cloud-sync-error');
			}, {once: true});

			await service.handleLogin();

			expect(events).toContain('cloud-sync-error');
			// `loginSyncComplete` stays false so a subsequent login attempt can retry
			expect((service as any).loginSyncComplete).toBe(false);
		});
	});

	describe('flushPendingChanges', () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		test('should immediately push pending changes', async () => {
			mockFromChain.upsert.mockResolvedValue({error: null});

			await service.saveWithFallback('test-key', 'test-value');

			// Without flush, would need to wait 5 seconds
			await service.flushPendingChanges();

			expect(mockFromChain.upsert).toHaveBeenCalled();
		});

		test('should do nothing if no pending changes', async () => {
			await service.flushPendingChanges();

			expect(mockFromChain.upsert).not.toHaveBeenCalled();
		});

		test('should not throw when push fails during flush', async () => {
			mockFromChain.upsert.mockResolvedValue({error: {message: 'network error'}});

			await service.saveWithFallback('test-key', 'test-value');

			// Should not throw even when push fails
			await expect(service.flushPendingChanges()).resolves.toBeUndefined();
		});
	});

	describe('heartbeat', () => {
		test('updates lastKnownFreshDataTimestamp when channel is joined', () => {
			vi.useFakeTimers();

			// Re-register heartbeat under fake timers (constructor ran before fake timers)
			(service as any).realtimeChannel = {state: 'joined'};
			(service as any).startHeartbeat();

			vi.advanceTimersByTime(5000);

			expect((service as any).lastKnownFreshDataTimestamp).toBeDefined();

			vi.useRealTimers();
		});

		test('does not update lastKnownFreshDataTimestamp when channel is not joined', () => {
			vi.useFakeTimers();

			(service as any).realtimeChannel = {state: 'closed'};
			(service as any).lastKnownFreshDataTimestamp = undefined;
			(service as any).startHeartbeat();

			vi.advanceTimersByTime(5000);

			expect((service as any).lastKnownFreshDataTimestamp).toBeUndefined();

			vi.useRealTimers();
		});
	});

	describe('unsubscribeFromRealtimeUpdates edge cases', () => {
		test('should be a no-op when no channel is set', () => {
			(service as any).realtimeChannel = undefined;
			(service as any).reconnectTimer = undefined;

			// Should not throw
			expect(() => {
				service.unsubscribeFromRealtimeUpdates();
			}).not.toThrow();
		});

		test('should reset loginSyncComplete, currentUserId, and lastKnownFreshDataTimestamp', () => {
			(service as any).loginSyncComplete = true;
			(service as any).currentUserId = 'some-user';
			(service as any).lastKnownFreshDataTimestamp = 123_456;

			service.unsubscribeFromRealtimeUpdates();

			expect((service as any).loginSyncComplete).toBe(false);
			expect((service as any).currentUserId).toBeUndefined();
			expect((service as any).lastKnownFreshDataTimestamp).toBeUndefined();
		});
	});

	describe('visibility pull fallback', () => {
		async function triggerVisibilityChange(hidden: boolean) {
			Object.defineProperty(document, 'hidden', {value: hidden, configurable: true});
			document.dispatchEvent(new Event('visibilitychange'));
			// Drain microtasks so the async IIFE inside the listener completes
			await Promise.resolve();
			await Promise.resolve();
		}

		afterEach(() => {
			Object.defineProperty(document, 'hidden', {value: false, configurable: true});
			(service as any).syncing = false;
		});

		test('should pull when tab becomes visible with unhealthy WebSocket and stale data', async () => {
			(service as any).currentUserId = 'test-user';
			(service as any).lastKnownFreshDataTimestamp = Date.now() - 120_000; // 2 minutes stale
			(service as any).realtimeChannel = {state: 'closed'}; // Not 'joined'

			mockFromChain.single.mockResolvedValue({
				data: {data: {lang: 'de'}},
				error: null,
			});

			await triggerVisibilityChange(false); // Become visible

			expect(mockFromChain.select).toHaveBeenCalled();
		});

		test('should skip pull when tab is still hidden', async () => {
			(service as any).currentUserId = 'test-user';
			(service as any).lastKnownFreshDataTimestamp = Date.now() - 120_000;
			(service as any).realtimeChannel = {state: 'closed'};

			await triggerVisibilityChange(true); // Still hidden

			expect(mockFromChain.select).not.toHaveBeenCalled();
		});

		test('should skip pull when WebSocket is healthy (joined)', async () => {
			(service as any).currentUserId = 'test-user';
			(service as any).lastKnownFreshDataTimestamp = Date.now() - 120_000;
			(service as any).realtimeChannel = {state: 'joined'};

			await triggerVisibilityChange(false);

			expect(mockFromChain.select).not.toHaveBeenCalled();
		});

		test('should skip pull when no currentUserId', async () => {
			(service as any).currentUserId = undefined;
			(service as any).lastKnownFreshDataTimestamp = Date.now() - 120_000;
			(service as any).realtimeChannel = {state: 'closed'};

			await triggerVisibilityChange(false);

			expect(mockFromChain.select).not.toHaveBeenCalled();
		});

		test('should skip pull when last pull was within throttle window (60s)', async () => {
			(service as any).currentUserId = 'test-user';
			(service as any).lastKnownFreshDataTimestamp = Date.now() - 30_000; // 30s ago (< 60s)
			(service as any).realtimeChannel = {state: 'closed'};

			await triggerVisibilityChange(false);

			expect(mockFromChain.select).not.toHaveBeenCalled();
		});

		test('should skip pull when syncing is in progress', async () => {
			(service as any).currentUserId = 'test-user';
			(service as any).lastKnownFreshDataTimestamp = Date.now() - 120_000;
			(service as any).realtimeChannel = {state: 'closed'};
			(service as any).syncing = true;

			await triggerVisibilityChange(false);

			expect(mockFromChain.select).not.toHaveBeenCalled();
		});

		test('should handle pull error gracefully in visibility fallback', async () => {
			(service as any).currentUserId = 'test-user';
			(service as any).lastKnownFreshDataTimestamp = Date.now() - 120_000;
			(service as any).realtimeChannel = {state: 'closed'};

			mockFromChain.single.mockResolvedValue({
				data: null,
				error: {message: 'timeout'},
			});

			// Should not throw
			await triggerVisibilityChange(false);

			expect((service as any).syncing).toBe(false);
		});

		test('should pull when no heartbeat timestamp (never synced)', async () => {
			(service as any).currentUserId = 'test-user';
			(service as any).lastKnownFreshDataTimestamp = undefined;
			(service as any).realtimeChannel = {state: 'closed'};

			mockFromChain.single.mockResolvedValue({
				data: {data: {lang: 'jp'}},
				error: null,
			});

			await triggerVisibilityChange(false);

			expect(mockFromChain.select).toHaveBeenCalled();
		});
	});

	describe('Dropdown Filter Syncing', () => {
		test('should sync dropdown filter values (numeric strings) via saveWithFallback', async () => {
			mockFromChain.upsert.mockResolvedValue({error: null});

			// Use saveWithFallback to properly trigger sync
			await service.saveWithFallback('live.filter.bounties.ZarimanSyndicate', '3');
			await service.saveWithFallback('live.filter.bounties.EntratiLabSyndicate', '5');
			await service.saveWithFallback('live.filter.bounties.HexSyndicate', '-1');

			// Flush to trigger immediate sync
			await service.flushPendingChanges();

			// Check the data property was called with nested structure
			const call = vi.mocked(mockFromChain.upsert).mock.calls[0][0];
			expect(call.data.live.filter.bounties.ZarimanSyndicate).toBe('3');
			expect(call.data.live.filter.bounties.EntratiLabSyndicate).toBe('5');
			expect(call.data.live.filter.bounties.HexSyndicate).toBe('-1');
		});

		test('should restore dropdown filter values from cloud', async () => {
			const mockData: UserData = {
				lang: 'en',
				live: {
					filter: {
						bounties: {
							ZarimanSyndicate: '4',
							EntratiLabSyndicate: '2',
							HexSyndicate: '7',
						},
					},
				},
			};

			mockFromChain.single.mockResolvedValue({
				data: {data: mockData},
				error: null,
			});

			// Call pullFromDatabase directly
			await (service as any).pullFromDatabase('test-user-id');

			// Verify dropdown values restored correctly
			expect(localStorage.getItem('live.filter.bounties.ZarimanSyndicate')).toBe('4');
			expect(localStorage.getItem('live.filter.bounties.EntratiLabSyndicate')).toBe('2');
			expect(localStorage.getItem('live.filter.bounties.HexSyndicate')).toBe('7');
		});

		test('should handle both checkbox and dropdown filters in same sync', async () => {
			mockFromChain.upsert.mockResolvedValue({error: null});

			// Set both checkbox filters (boolean "0"/"1") and dropdown filters (string "0"-"7")
			await service.saveWithFallback('live.filter.news.danger', '1');
			await service.saveWithFallback('live.filter.news.primary', '0');
			await service.saveWithFallback('live.filter.bounties.ZarimanSyndicate', '3');

			await service.flushPendingChanges();

			// Check the data property has both filter types in nested structure
			const call = vi.mocked(mockFromChain.upsert).mock.calls[0][0];
			expect(call.data.live.filter.news.danger).toBe('1');
			expect(call.data.live.filter.news.primary).toBe('0');
			expect(call.data.live.filter.bounties.ZarimanSyndicate).toBe('3');
		});
	});

	describe('Round Trip: Serialize/Deserialize', () => {
		test('collapse state round-trips correctly', () => {
			const service = StorageSyncService.getInstance();

			// Set up: Collapse a card
			localStorage.setItem('live.collapse.news', '1');

			// Serialize
			const serialized = (service as any).localStorageToData();
			expect(serialized.live.collapse.news).toBe('1');

			// Clear and deserialize
			localStorage.clear();
			(service as any).dataToLocalStorage(serialized);

			// Verify: Card stays collapsed
			expect(localStorage.getItem('live.collapse.news')).toBe('1');
		});

		test('expanding card (removing key) round-trips correctly', () => {
			const service = StorageSyncService.getInstance();

			// Set up: No collapse key (card is expanded)
			localStorage.clear();

			// Serialize
			const serialized = (service as any).localStorageToData();
			expect(serialized.live?.collapse?.news).toBeUndefined();

			// Deserialize
			localStorage.setItem('live.collapse.news', '1'); // Start with collapsed
			(service as any).dataToLocalStorage(serialized);

			// Verify: Card stays expanded (key not set)
			expect(localStorage.getItem('live.collapse.news')).toBeNull();
		});

		test('filter states round-trip correctly', () => {
			const service = StorageSyncService.getInstance();

			// Set up: Set various filters
			localStorage.setItem('live.filter.news.danger', '0');
			localStorage.setItem('live.filter.bounties.ZarimanSyndicate', '3');
			localStorage.setItem('live.filter.bounties.HexSyndicate', '-1');

			// Serialize
			const serialized = (service as any).localStorageToData();
			expect(serialized.live.filter.news.danger).toBe('0');
			expect(serialized.live.filter.bounties.ZarimanSyndicate).toBe('3');
			expect(serialized.live.filter.bounties.HexSyndicate).toBe('-1');

			// Clear and deserialize
			localStorage.clear();
			(service as any).dataToLocalStorage(serialized);

			// Verify: Filters restored
			expect(localStorage.getItem('live.filter.news.danger')).toBe('0');
			expect(localStorage.getItem('live.filter.bounties.ZarimanSyndicate')).toBe('3');
			expect(localStorage.getItem('live.filter.bounties.HexSyndicate')).toBe('-1');
		});

		test('mixed collapse and filter states round-trip correctly', () => {
			const service = StorageSyncService.getInstance();

			// Set up: Collapse card AND set filter
			localStorage.setItem('live.collapse.news', '1');
			localStorage.setItem('live.filter.news.danger', '0');

			// Serialize
			const serialized = (service as any).localStorageToData();
			expect(serialized.live.collapse.news).toBe('1');
			expect(serialized.live.filter.news.danger).toBe('0');

			// Clear and deserialize
			localStorage.clear();
			(service as any).dataToLocalStorage(serialized);

			// Verify: Both restored
			expect(localStorage.getItem('live.collapse.news')).toBe('1');
			expect(localStorage.getItem('live.filter.news.danger')).toBe('0');
		});

		test('notification states round-trip correctly', () => {
			const service = StorageSyncService.getInstance();

			// Set up: Enable some notifications
			localStorage.setItem('live.notif.news', 'true');
			localStorage.setItem('live.notif.bounties', 'true');

			// Serialize
			const serialized = (service as any).localStorageToData();
			expect(serialized.live.notif.news).toBe('true');
			expect(serialized.live.notif.bounties).toBe('true');

			// Clear and deserialize
			localStorage.clear();
			(service as any).dataToLocalStorage(serialized);

			// Verify: Notifications restored
			expect(localStorage.getItem('live.notif.news')).toBe('true');
			expect(localStorage.getItem('live.notif.bounties')).toBe('true');
		});

		test('completed objectives round-trip correctly', () => {
			const service = StorageSyncService.getInstance();

			// Set up: Mark some objectives as completed
			const completions = ['archon1', 'kahlb1', 'kahlb2'];
			localStorage.setItem('oids_completed', JSON.stringify(completions));

			// Serialize
			const serialized = (service as any).localStorageToData();
			expect(serialized.oids_completed).toBe(JSON.stringify(completions));

			// Clear and deserialize
			localStorage.clear();
			(service as any).dataToLocalStorage(serialized);

			// Verify: Completions restored
			expect(localStorage.getItem('oids_completed')).toBe(JSON.stringify(completions));
		});
	});
});
