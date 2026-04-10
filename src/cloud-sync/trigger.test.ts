import {
	describe, test, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {
	registerSyncHandler,
	triggerCloudSync,
	triggerCloudSyncWithDebounce,
	flushDebounce,
} from './trigger';

describe('trigger', () => {
	let mockHandler: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.useFakeTimers();
		mockHandler = vi.fn(async () => undefined);
		registerSyncHandler(mockHandler as () => Promise<void>);
	});

	afterEach(() => {
		// Drain any pending debounce timer so it doesn't leak into other tests
		vi.runAllTimers();
		vi.useRealTimers();
	});

	describe('triggerCloudSync', () => {
		test('calls handler immediately', () => {
			triggerCloudSync();
			expect(mockHandler).toHaveBeenCalledOnce();
		});

		test('is a no-op when no handler is registered', () => {
			registerSyncHandler(undefined as any);
			expect(() => {
				triggerCloudSync();
			}).not.toThrow();
		});
	});

	describe('triggerCloudSyncWithDebounce', () => {
		test('does not call handler immediately', () => {
			triggerCloudSyncWithDebounce();
			expect(mockHandler).not.toHaveBeenCalled();
		});

		test('calls handler after 5 seconds', async () => {
			triggerCloudSyncWithDebounce();
			await vi.runAllTimersAsync();
			expect(mockHandler).toHaveBeenCalledOnce();
		});

		test('does not call handler before 5 seconds have elapsed', () => {
			triggerCloudSyncWithDebounce();
			vi.advanceTimersByTime(4999);
			expect(mockHandler).not.toHaveBeenCalled();
		});

		test('resets the timer on subsequent calls', async () => {
			triggerCloudSyncWithDebounce();
			vi.advanceTimersByTime(3000);

			triggerCloudSyncWithDebounce();
			vi.advanceTimersByTime(3000);

			// First timer was cancelled — still no call yet
			expect(mockHandler).not.toHaveBeenCalled();

			await vi.runAllTimersAsync();
			expect(mockHandler).toHaveBeenCalledOnce();
		});

		test('is a no-op when no handler is registered', async () => {
			registerSyncHandler(undefined as any);
			triggerCloudSyncWithDebounce();
			await vi.runAllTimersAsync();
			expect(mockHandler).not.toHaveBeenCalled();
		});
	});

	describe('flushDebounce', () => {
		test('fires pending debounce immediately', async () => {
			triggerCloudSyncWithDebounce();
			await flushDebounce();
			expect(mockHandler).toHaveBeenCalledOnce();
		});

		test('cancels the timer so handler is not called again after 5 seconds', async () => {
			triggerCloudSyncWithDebounce();
			await flushDebounce();
			await vi.runAllTimersAsync();
			expect(mockHandler).toHaveBeenCalledOnce();
		});

		test('is a no-op when there is no pending debounce', async () => {
			await flushDebounce();
			expect(mockHandler).not.toHaveBeenCalled();
		});

		test('awaits the handler', async () => {
			const order: string[] = [];
			registerSyncHandler(async () => {
				order.push('handler');
			});
			triggerCloudSyncWithDebounce();
			await flushDebounce();
			order.push('after flush');
			expect(order).toEqual(['handler', 'after flush']);
		});
	});
});
