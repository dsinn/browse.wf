/**
 * Tests for CloudSyncManager
 * Integration tests for login orchestration, realtime subscription wiring,
 * reconnect/pull coordination, heartbeat, and visibility fallback.
 *
 * Unit-level tests for serialization → serializer.test.ts
 * Unit-level tests for push/pull/justPushed → handler.test.ts
 * Unit-level tests for backoff/session-refresh → reconnection.test.ts
 */
import {
	describe, test, expect, beforeEach, afterEach, vi,
} from 'vitest';
import type {UserData} from '../../src/cloud-sync/types';
import {CloudSyncManager} from '../../src/cloud-sync/manager';
import {localStorageToData, dataToLocalStorage} from '../../src/cloud-sync/serializer';
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

describe('CloudSyncManager', () => {
	let service: CloudSyncManager;
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
		service = CloudSyncManager.getInstance();
		(service as any).loginSyncComplete = false;
		(service as any).handler.syncing = false;
		(service as any).handler.justPushed = false;
	});

	afterEach(() => {
		localStorage.clear();
		delete (globalThis as any).refreshAllCompletionToggles;
		delete (globalThis as any).refreshCollapseStatus;
		delete (globalThis as any).refreshNotifStatus;
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

		test('should skip remote update pull when syncing is already in progress', async () => {
			service.subscribeToRealtimeUpdates('test-user-uuid');
			const updateCallback = vi.mocked(mockChannel.on).mock.calls[0][2];

			(service as any).handler.syncing = true;

			const selectCallsBefore: number = vi.mocked(mockFromChain.select).mock.calls.length;
			await updateCallback({});

			expect(mockFromChain.select).toHaveBeenCalledTimes(selectCallsBefore);

			(service as any).handler.syncing = false;
		});
	});

	describe('WebSocket Reconnection', () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		test('should clear pending reconnect timer when SUBSCRIBED fires before timer', async () => {
			vi.mocked(db.auth.refreshSession).mockResolvedValue({
				data: {session: {access_token: 'tok'}},
				error: null,
			} as any);

			service.subscribeToRealtimeUpdates('test-user-uuid');
			const subscribeCallback = vi.mocked(mockChannel.subscribe).mock.calls[0][0];

			// Trigger a failure — starts reconnect timer
			await subscribeCallback('CLOSED');
			expect((service as any).reconnection.reconnectTimer).toBeDefined();

			// SUBSCRIBED fires before the timer — should cancel it
			(service as any).subscription.hasSubscribedBefore = true;
			(service as any).reconnection.lastFreshTimestamp = Date.now() - 5000; // Recent
			await subscribeCallback('SUBSCRIBED');

			expect((service as any).reconnection.reconnectTimer).toBeUndefined();

			// Reset state leaked to singleton
			(service as any).subscription.hasSubscribedBefore = false;
			(service as any).reconnection.reconnectAttempts = 0;
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
			// Simulate a prior subscription
			(service as any).subscription.hasSubscribedBefore = true;
			// Heartbeat was 5 seconds ago (within 10s threshold)
			(service as any).reconnection.lastFreshTimestamp = Date.now() - 5000;

			service.subscribeToRealtimeUpdates('test-user-uuid');
			const subscribeCallback = vi.mocked(mockChannel.subscribe).mock.calls[0][0];

			const selectCallsBefore: number = vi.mocked(mockFromChain.select).mock.calls.length;

			// SUBSCRIBED after recent heartbeat — should skip pull
			await subscribeCallback('SUBSCRIBED');

			expect(mockFromChain.select).toHaveBeenCalledTimes(selectCallsBefore);
		});

		test('should pull on SUBSCRIBED reconnect when heartbeat is stale', async () => {
			(service as any).subscription.hasSubscribedBefore = true;
			// Heartbeat was 20 seconds ago (beyond 10s threshold)
			(service as any).reconnection.lastFreshTimestamp = Date.now() - 20_000;

			mockFromChain.single.mockResolvedValue({
				data: {data: {lang: 'fr'}},
				error: null,
			});

			service.subscribeToRealtimeUpdates('test-user-uuid');
			const subscribeCallback = vi.mocked(mockChannel.subscribe).mock.calls[0][0];

			await subscribeCallback('SUBSCRIBED');

			expect(mockFromChain.select).toHaveBeenCalled();
		});

		test('should skip pull on SUBSCRIBED reconnect when syncing is in progress', async () => {
			(service as any).subscription.hasSubscribedBefore = true;
			(service as any).reconnection.lastFreshTimestamp = Date.now() - 20_000; // Stale
			(service as any).handler.syncing = true;

			service.subscribeToRealtimeUpdates('test-user-uuid');
			const subscribeCallback = vi.mocked(mockChannel.subscribe).mock.calls[0][0];

			const selectCallsBefore: number = vi.mocked(mockFromChain.select).mock.calls.length;
			await subscribeCallback('SUBSCRIBED');

			expect(mockFromChain.select).toHaveBeenCalledTimes(selectCallsBefore);

			(service as any).handler.syncing = false;
		});

		test('should skip pull on SUBSCRIBED reconnect when no heartbeat (first sub sets flag)', async () => {
			// HasSubscribedBefore = false (default for new subscribe)
			(service as any).subscription.hasSubscribedBefore = false;

			service.subscribeToRealtimeUpdates('test-user-uuid');
			const subscribeCallback = vi.mocked(mockChannel.subscribe).mock.calls[0][0];

			const selectCallsBefore: number = vi.mocked(mockFromChain.select).mock.calls.length;
			await subscribeCallback('SUBSCRIBED');

			// First-ever SUBSCRIBED — no pull, just marks flag
			expect(mockFromChain.select).toHaveBeenCalledTimes(selectCallsBefore);
			expect((service as any).subscription.hasSubscribedBefore).toBe(true);
		});

		test('should trigger reconnect on TIMED_OUT status', async () => {
			service.subscribeToRealtimeUpdates('test-user-uuid');
			const subscribeCallback = vi.mocked(mockChannel.subscribe).mock.calls[0][0];

			await subscribeCallback('TIMED_OUT');

			expect((service as any).reconnection.reconnectTimer).toBeDefined();

			// Reset leaked state
			(service as any).reconnection.reconnectAttempts = 0;
			clearTimeout((service as any).reconnection.reconnectTimer);
			(service as any).reconnection.reconnectTimer = undefined;
		});

		test('should trigger reconnect on CHANNEL_ERROR status', async () => {
			service.subscribeToRealtimeUpdates('test-user-uuid');
			const subscribeCallback = vi.mocked(mockChannel.subscribe).mock.calls[0][0];

			await subscribeCallback('CHANNEL_ERROR');

			expect((service as any).reconnection.reconnectTimer).toBeDefined();

			// Reset leaked state
			(service as any).reconnection.reconnectAttempts = 0;
			clearTimeout((service as any).reconnection.reconnectTimer);
			(service as any).reconnection.reconnectTimer = undefined;
		});

		test('should pull on SUBSCRIBED reconnect when no prior heartbeat (never connected)', async () => {
			(service as any).subscription.hasSubscribedBefore = true;
			(service as any).reconnection.lastFreshTimestamp = undefined; // No heartbeat ever

			mockFromChain.single.mockResolvedValue({
				data: {data: {lang: 'fr'}},
				error: null,
			});

			service.subscribeToRealtimeUpdates('test-user-uuid');
			const subscribeCallback = vi.mocked(mockChannel.subscribe).mock.calls[0][0];

			await subscribeCallback('SUBSCRIBED');

			// Should pull since timeSinceLastFreshMs = Infinity > quickReconnectThresholdMs
			expect(mockFromChain.select).toHaveBeenCalled();
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
			(service as any).handler.syncing = true;

			await service.handleLogin();

			expect(mockFromChain.select).not.toHaveBeenCalled();

			(service as any).handler.syncing = false;
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

	describe('heartbeat', () => {
		test('updates lastKnownFreshDataTimestamp when channel is joined', () => {
			vi.useFakeTimers();

			// Re-register heartbeat under fake timers (constructor ran before fake timers)
			(service as any).subscription.channel = {state: 'joined'};
			(service as any).startHeartbeat();

			vi.advanceTimersByTime(5000);

			expect((service as any).reconnection.lastFreshTimestamp).toBeDefined();

			vi.useRealTimers();
		});

		test('does not update lastKnownFreshDataTimestamp when channel is not joined', () => {
			vi.useFakeTimers();

			(service as any).subscription.channel = {state: 'closed'};
			(service as any).reconnection.lastFreshTimestamp = undefined;
			(service as any).startHeartbeat();

			vi.advanceTimersByTime(5000);

			expect((service as any).reconnection.lastFreshTimestamp).toBeUndefined();

			vi.useRealTimers();
		});
	});

	describe('unsubscribeFromRealtimeUpdates edge cases', () => {
		test('should be a no-op when no channel is set', () => {
			(service as any).subscription.channel = undefined;
			(service as any).reconnection.reconnectTimer = undefined;

			// Should not throw
			expect(() => {
				service.unsubscribeFromRealtimeUpdates();
			}).not.toThrow();
		});

		test('should reset loginSyncComplete, currentUserId, and lastKnownFreshDataTimestamp', () => {
			(service as any).loginSyncComplete = true;
			(service as any).currentUserId = 'some-user';
			(service as any).reconnection.lastFreshTimestamp = 123_456;

			service.unsubscribeFromRealtimeUpdates();

			expect((service as any).loginSyncComplete).toBe(false);
			expect((service as any).currentUserId).toBeUndefined();
			expect((service as any).reconnection.lastFreshTimestamp).toBeUndefined();
		});
	});

	describe('visibility pull fallback', () => {
		async function triggerVisibilityChange(hidden: boolean) {
			Object.defineProperty(document, 'hidden', {value: hidden, configurable: true});
			document.dispatchEvent(new Event('visibilitychange'));
			// Drain microtasks so the async IIFE inside the listener completes
			// (5 hops: event handler, pullFn wrapper, pullFromDatabase, handler, db call)
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
		}

		afterEach(() => {
			Object.defineProperty(document, 'hidden', {value: false, configurable: true});
			(service as any).handler.syncing = false;
		});

		test('should pull when tab becomes visible with unhealthy WebSocket and stale data', async () => {
			(service as any).currentUserId = 'test-user';
			(service as any).reconnection.lastFreshTimestamp = Date.now() - 120_000; // 2 minutes stale
			(service as any).subscription.channel = {state: 'closed'}; // Not 'joined'

			mockFromChain.single.mockResolvedValue({
				data: {data: {lang: 'de'}},
				error: null,
			});

			await triggerVisibilityChange(false); // Become visible

			expect(mockFromChain.select).toHaveBeenCalled();
		});

		test('should skip pull when tab is still hidden', async () => {
			(service as any).currentUserId = 'test-user';
			(service as any).reconnection.lastFreshTimestamp = Date.now() - 120_000;
			(service as any).subscription.channel = {state: 'closed'};

			await triggerVisibilityChange(true); // Still hidden

			expect(mockFromChain.select).not.toHaveBeenCalled();
		});

		test('should skip pull when WebSocket is healthy (joined)', async () => {
			(service as any).currentUserId = 'test-user';
			(service as any).reconnection.lastFreshTimestamp = Date.now() - 120_000;
			(service as any).subscription.channel = {state: 'joined'};

			await triggerVisibilityChange(false);

			expect(mockFromChain.select).not.toHaveBeenCalled();
		});

		test('should skip pull when no currentUserId', async () => {
			(service as any).currentUserId = undefined;
			(service as any).reconnection.lastFreshTimestamp = Date.now() - 120_000;
			(service as any).subscription.channel = {state: 'closed'};

			await triggerVisibilityChange(false);

			expect(mockFromChain.select).not.toHaveBeenCalled();
		});

		test('should skip pull when last pull was within throttle window (60s)', async () => {
			(service as any).currentUserId = 'test-user';
			(service as any).reconnection.lastFreshTimestamp = Date.now() - 30_000; // 30s ago (< 60s)
			(service as any).subscription.channel = {state: 'closed'};

			await triggerVisibilityChange(false);

			expect(mockFromChain.select).not.toHaveBeenCalled();
		});

		test('should skip pull when syncing is in progress', async () => {
			(service as any).currentUserId = 'test-user';
			(service as any).reconnection.lastFreshTimestamp = Date.now() - 120_000;
			(service as any).subscription.channel = {state: 'closed'};
			(service as any).handler.syncing = true;

			await triggerVisibilityChange(false);

			expect(mockFromChain.select).not.toHaveBeenCalled();
		});

		test('should handle pull error gracefully in visibility fallback', async () => {
			(service as any).currentUserId = 'test-user';
			(service as any).reconnection.lastFreshTimestamp = Date.now() - 120_000;
			(service as any).subscription.channel = {state: 'closed'};

			mockFromChain.single.mockResolvedValue({
				data: null,
				error: {message: 'timeout'},
			});

			// Should not throw
			await triggerVisibilityChange(false);

			expect((service as any).handler.syncing).toBe(false);
		});

		test('should pull when no heartbeat timestamp (never synced)', async () => {
			(service as any).currentUserId = 'test-user';
			(service as any).reconnection.lastFreshTimestamp = undefined;
			(service as any).subscription.channel = {state: 'closed'};

			mockFromChain.single.mockResolvedValue({
				data: {data: {lang: 'jp'}},
				error: null,
			});

			await triggerVisibilityChange(false);

			expect(mockFromChain.select).toHaveBeenCalled();
		});
	});

	describe('Round Trip: Serialize/Deserialize', () => {
		test('collapse state round-trips correctly', () => {
			// Set up: Collapse a card
			localStorage.setItem('live.collapse.news', '1');

			// Serialize
			const serialized = localStorageToData();
			expect(serialized.live.collapse.news).toBe('1');

			// Clear and deserialize
			localStorage.clear();
			dataToLocalStorage(serialized);

			// Verify: Card stays collapsed
			expect(localStorage.getItem('live.collapse.news')).toBe('1');
		});

		test('expanding card (removing key) round-trips correctly', () => {
			// Set up: No collapse key (card is expanded)
			localStorage.clear();

			// Serialize
			const serialized = localStorageToData();
			expect(serialized.live?.collapse?.news).toBeUndefined();

			// Deserialize
			localStorage.setItem('live.collapse.news', '1'); // Start with collapsed
			dataToLocalStorage(serialized);

			// Verify: Card stays expanded (key not set)
			expect(localStorage.getItem('live.collapse.news')).toBeNull();
		});

		test('filter states round-trip correctly', () => {
			// Set up: Set various filters
			localStorage.setItem('live.filter.news.danger', '0');
			localStorage.setItem('live.filter.bounties.ZarimanSyndicate.minTier', '3');
			localStorage.setItem('live.filter.bounties.HexSyndicate.minTier', '-1');

			// Serialize
			const serialized = localStorageToData();
			expect(serialized.live.filter.news.danger).toBe('0');
			expect(serialized.live.filter.bounties.ZarimanSyndicate.minTier).toBe('3');
			expect(serialized.live.filter.bounties.HexSyndicate.minTier).toBe('-1');

			// Clear and deserialize
			localStorage.clear();
			dataToLocalStorage(serialized);

			// Verify: Filters restored
			expect(localStorage.getItem('live.filter.news.danger')).toBe('0');
			expect(localStorage.getItem('live.filter.bounties.ZarimanSyndicate.minTier')).toBe('3');
			expect(localStorage.getItem('live.filter.bounties.HexSyndicate.minTier')).toBe('-1');
		});

		test('mixed collapse and filter states round-trip correctly', () => {
			// Set up: Collapse card AND set filter
			localStorage.setItem('live.collapse.news', '1');
			localStorage.setItem('live.filter.news.danger', '0');

			// Serialize
			const serialized = localStorageToData();
			expect(serialized.live.collapse.news).toBe('1');
			expect(serialized.live.filter.news.danger).toBe('0');

			// Clear and deserialize
			localStorage.clear();
			dataToLocalStorage(serialized);

			// Verify: Both restored
			expect(localStorage.getItem('live.collapse.news')).toBe('1');
			expect(localStorage.getItem('live.filter.news.danger')).toBe('0');
		});

		test('notification states round-trip correctly', () => {
			// Set up: Enable some notifications
			localStorage.setItem('live.notif.news', 'true');
			localStorage.setItem('live.notif.bounties', 'true');

			// Serialize
			const serialized = localStorageToData();
			expect(serialized.live.notif.news).toBe('true');
			expect(serialized.live.notif.bounties).toBe('true');

			// Clear and deserialize
			localStorage.clear();
			dataToLocalStorage(serialized);

			// Verify: Notifications restored
			expect(localStorage.getItem('live.notif.news')).toBe('true');
			expect(localStorage.getItem('live.notif.bounties')).toBe('true');
		});

		test('completed objectives round-trip correctly', () => {
			// Set up: Mark some objectives as completed
			const completions = ['archon1', 'kahlb1', 'kahlb2'];
			localStorage.setItem('oids_completed', JSON.stringify(completions));

			// Serialize
			const serialized = localStorageToData();
			expect(serialized.oids_completed).toBe(JSON.stringify(completions));

			// Clear and deserialize
			localStorage.clear();
			dataToLocalStorage(serialized);

			// Verify: Completions restored
			expect(localStorage.getItem('oids_completed')).toBe(JSON.stringify(completions));
		});
	});
});
