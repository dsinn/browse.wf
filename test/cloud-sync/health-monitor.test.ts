/**
 * Tests for CloudSyncHealthMonitor
 * Heartbeat interval tracking and visibility-triggered pull fallback.
 */
import {
	describe, test, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {CloudSyncHealthMonitor} from '../../src/cloud-sync/health-monitor';

vi.mock('../../src/logger', () => ({
	logger: {
		debug: vi.fn(),
		log: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

describe('CloudSyncHealthMonitor', () => {
	let monitor: CloudSyncHealthMonitor;

	beforeEach(() => {
		monitor = new CloudSyncHealthMonitor();
	});

	describe('constants', () => {
		test('quickReconnectThresholdMs is 10 seconds', () => {
			expect(CloudSyncHealthMonitor.quickReconnectThresholdMs).toBe(10_000);
		});

		test('heartbeatIntervalMs is 5 seconds', () => {
			expect(CloudSyncHealthMonitor.heartbeatIntervalMs).toBe(5000);
		});

		test('visibilityPullThrottleMs is 60 seconds', () => {
			expect(CloudSyncHealthMonitor.visibilityPullThrottleMs).toBe(60_000);
		});
	});

	describe('startHeartbeat', () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		test('updates timestamp when channel is joined', () => {
			const setLastFreshTimestamp = vi.fn<(ts: number) => void>();

			monitor.startHeartbeat(() => 'joined', setLastFreshTimestamp);
			vi.advanceTimersByTime(5000);

			expect(setLastFreshTimestamp).toHaveBeenCalledWith(expect.any(Number));
		});

		test('does not update timestamp when channel is not joined', () => {
			const setLastFreshTimestamp = vi.fn<(ts: number) => void>();

			monitor.startHeartbeat(() => 'closed', setLastFreshTimestamp);
			vi.advanceTimersByTime(5000);

			expect(setLastFreshTimestamp).not.toHaveBeenCalled();
		});

		test('does not update timestamp when channel is undefined', () => {
			const setLastFreshTimestamp = vi.fn<(ts: number) => void>();

			monitor.startHeartbeat(() => undefined, setLastFreshTimestamp);
			vi.advanceTimersByTime(5000);

			expect(setLastFreshTimestamp).not.toHaveBeenCalled();
		});

		test('fires every 5 seconds', () => {
			const setLastFreshTimestamp = vi.fn<(ts: number) => void>();

			monitor.startHeartbeat(() => 'joined', setLastFreshTimestamp);
			vi.advanceTimersByTime(15_000);

			expect(setLastFreshTimestamp).toHaveBeenCalledTimes(3);
		});
	});

	describe('startVisibilityFallback', () => {
		async function triggerVisibilityChange(hidden: boolean) {
			Object.defineProperty(document, 'hidden', {value: hidden, configurable: true});
			document.dispatchEvent(new Event('visibilitychange'));
			await Promise.resolve();
			await Promise.resolve();
		}

		afterEach(() => {
			Object.defineProperty(document, 'hidden', {value: false, configurable: true});
		});

		function setupMonitor(overrides: {
			userId?: string;
			noUserId?: true;
			channelState?: string;
			syncing?: boolean;
			lastFreshTimestamp?: number;
			noLastFreshTimestamp?: true;
			pullFn?: ReturnType<typeof vi.fn<(userId: string) => Promise<void>>>;
			onPullComplete?: ReturnType<typeof vi.fn<(ts: number) => void>>;
			setSyncing?: ReturnType<typeof vi.fn<(value: boolean) => void>>;
		} = {}) {
			const userId = overrides.noUserId ? undefined : (overrides.userId ?? 'test-user');
			const channelState = overrides.channelState ?? 'closed';
			const syncing = overrides.syncing ?? false;
			const lastFreshTimestamp = overrides.noLastFreshTimestamp
				? undefined
				: (overrides.lastFreshTimestamp ?? Date.now() - 120_000);
			const pullFn = overrides.pullFn ?? vi.fn<(userId: string) => Promise<void>>().mockResolvedValue(undefined);
			const onPullComplete = overrides.onPullComplete ?? vi.fn<(ts: number) => void>();
			const setSyncing = overrides.setSyncing ?? vi.fn<(value: boolean) => void>();

			monitor.startVisibilityFallback({
				getCurrentUserId: () => userId,
				getChannelState: () => channelState,
				isSyncing: () => syncing,
				getLastFreshTimestamp: () => lastFreshTimestamp,
				pullFn,
				onPullComplete,
				setSyncing,
			});

			return {pullFn, onPullComplete, setSyncing};
		}

		test('pulls when tab becomes visible with stale data and unhealthy WebSocket', async () => {
			const {pullFn} = setupMonitor();

			await triggerVisibilityChange(false);

			expect(pullFn).toHaveBeenCalledWith('test-user');
		});

		test('calls onPullComplete with current timestamp after successful pull', async () => {
			const {onPullComplete} = setupMonitor();

			await triggerVisibilityChange(false);

			expect(onPullComplete).toHaveBeenCalledWith(expect.any(Number));
		});

		test('calls setSyncing(true) before pull and setSyncing(false) after', async () => {
			const setSyncing = vi.fn<(value: boolean) => void>();

			setupMonitor({setSyncing});

			await triggerVisibilityChange(false);

			expect(setSyncing).toHaveBeenCalledWith(true);
			expect(setSyncing).toHaveBeenCalledWith(false);
		});

		test('skips pull when tab is still hidden', async () => {
			const {pullFn} = setupMonitor();

			await triggerVisibilityChange(true);

			expect(pullFn).not.toHaveBeenCalled();
		});

		test('skips pull when no userId', async () => {
			const {pullFn} = setupMonitor({noUserId: true});

			await triggerVisibilityChange(false);

			expect(pullFn).not.toHaveBeenCalled();
		});

		test('skips pull when syncing is in progress', async () => {
			const {pullFn} = setupMonitor({syncing: true});

			await triggerVisibilityChange(false);

			expect(pullFn).not.toHaveBeenCalled();
		});

		test('skips pull when WebSocket is healthy (joined)', async () => {
			const {pullFn} = setupMonitor({channelState: 'joined'});

			await triggerVisibilityChange(false);

			expect(pullFn).not.toHaveBeenCalled();
		});

		test('skips pull when last fresh timestamp is within throttle window (60s)', async () => {
			const {pullFn} = setupMonitor({lastFreshTimestamp: Date.now() - 30_000});

			await triggerVisibilityChange(false);

			expect(pullFn).not.toHaveBeenCalled();
		});

		test('pulls when no fresh timestamp (never synced = treated as Infinity stale)', async () => {
			const {pullFn} = setupMonitor({noLastFreshTimestamp: true});

			await triggerVisibilityChange(false);

			expect(pullFn).toHaveBeenCalled();
		});

		test('handles pull error gracefully — does not throw, calls setSyncing(false)', async () => {
			const setSyncing = vi.fn<(value: boolean) => void>();
			const rejectedPullFn = vi.fn<(userId: string) => Promise<void>>().mockRejectedValue(new Error('network timeout'));

			setupMonitor({pullFn: rejectedPullFn, setSyncing});

			await expect(triggerVisibilityChange(false)).resolves.toBeUndefined();
			expect(setSyncing).toHaveBeenLastCalledWith(false);
		});
	});
});
