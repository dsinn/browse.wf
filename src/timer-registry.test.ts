import {
	describe,
	test,
	expect,
	beforeEach,
	afterEach,
	vi,
} from 'vitest';
import {
	registerTimerBadge,
	resetTimerRegistry,
	scheduleAt,
	scheduleReload,
	setTimerText,
	getPendingLabel,
	TICK_MS,
} from './timer-registry';

function attachedBadge(): HTMLSpanElement {
	const badge = document.createElement('span');
	document.body.append(badge);
	return badge;
}

describe('timer-registry', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		resetTimerRegistry();
		document.body.replaceChildren();
		vi.useRealTimers();
	});

	test('renders on registration, then again on each tick', () => {
		let n = 0;
		const badge = attachedBadge();
		registerTimerBadge(badge, () => {
			setTimerText(badge, String(n++));
			return true;
		});
		expect(badge.textContent).toBe('0');

		vi.advanceTimersByTime(TICK_MS * 3);
		expect(badge.textContent).toBe('3');
	});

	test('stops rendering a badge removed from the DOM', () => {
		const render = vi.fn(() => true);
		const badge = attachedBadge();
		registerTimerBadge(badge, render);

		vi.advanceTimersByTime(TICK_MS);
		expect(render).toHaveBeenCalledTimes(2);

		badge.remove();
		vi.advanceTimersByTime(1000);
		expect(render).toHaveBeenCalledTimes(2);
	});

	test('prunes removed badges but skips rendering while the tab is hidden', () => {
		const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
		const keptRender = vi.fn(() => true);
		const removedRender = vi.fn(() => true);
		const kept = attachedBadge();
		const removed = attachedBadge();
		registerTimerBadge(kept, keptRender);
		registerTimerBadge(removed, removedRender);

		vi.advanceTimersByTime(TICK_MS);
		removed.remove();
		vi.advanceTimersByTime(TICK_MS);
		expect(keptRender).toHaveBeenCalledTimes(1);
		expect(removedRender).toHaveBeenCalledTimes(1);

		// Only the removed badge was pruned: the kept one renders again once the tab is visible
		hidden.mockReturnValue(false);
		vi.advanceTimersByTime(TICK_MS);
		expect(keptRender).toHaveBeenCalledTimes(2);
		expect(removedRender).toHaveBeenCalledTimes(1);
	});

	test('keeps a badge that has not been attached yet, however long that takes', () => {
		const render = vi.fn(() => true);
		const badge = document.createElement('span');
		registerTimerBadge(badge, render);

		vi.advanceTimersByTime(10 * 60 * 1000);
		expect(render).toHaveBeenCalledTimes(1);

		document.body.append(badge);
		vi.advanceTimersByTime(TICK_MS);
		expect(render).toHaveBeenCalledTimes(2);
	});

	test('drops a badge when its update returns false', () => {
		let calls = 0;
		const badge = attachedBadge();
		const render = vi.fn(() => {
			calls++;
			setTimerText(badge, calls < 3 ? String(calls) : 'final');
			return calls < 3;
		});
		registerTimerBadge(badge, render);

		vi.advanceTimersByTime(TICK_MS * 2);
		expect(badge.textContent).toBe('final');
		expect(render).toHaveBeenCalledTimes(3);

		vi.advanceTimersByTime(1000);
		expect(render).toHaveBeenCalledTimes(3);
	});

	test('does not register a badge whose first update returns false', () => {
		const badge = attachedBadge();
		const render = vi.fn(() => {
			setTimerText(badge, 'final');
			return false;
		});
		registerTimerBadge(badge, render);

		expect(badge.textContent).toBe('final');
		expect(vi.getTimerCount()).toBe(0);

		vi.advanceTimersByTime(1000);
		expect(render).toHaveBeenCalledTimes(1);
	});

	test('re-reads the pending label on every render', () => {
		const badge = attachedBadge();
		registerTimerBadge(badge, () => {
			setTimerText(badge, badge.dataset.label ?? getPendingLabel());
			return true;
		});
		expect(badge.textContent).toBe('Pending update');

		badge.dataset.label = 'Custom';
		vi.advanceTimersByTime(TICK_MS);
		expect(badge.textContent).toBe('Custom');
	});
});

describe('timer-registry scheduleAt', () => {
	const T0 = 1_800_000_000_000;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(T0);
	});

	afterEach(() => {
		resetTimerRegistry();
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	test('runs the callback once, on the first tick at or after the time', () => {
		const callback = vi.fn();
		scheduleAt(T0 + 1000, callback);

		vi.advanceTimersByTime(750);
		expect(callback).not.toHaveBeenCalled();

		vi.advanceTimersByTime(TICK_MS);
		expect(callback).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(10_000);
		expect(callback).toHaveBeenCalledTimes(1);
	});

	test('runs after a jump in the clock that no timer accounts for, like a device waking from sleep', () => {
		const callback = vi.fn();
		scheduleAt(T0 + (30 * 60 * 1000), callback);

		// A setTimeout would still be waiting out its delay: the wall clock moved but the ticker's own time did not
		vi.setSystemTime(T0 + (45 * 60 * 1000));
		vi.advanceTimersByTime(TICK_MS);

		expect(callback).toHaveBeenCalledTimes(1);
	});

	test('runs in a hidden tab', () => {
		vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
		const callback = vi.fn();
		scheduleAt(T0 + 1000, callback);

		vi.advanceTimersByTime(1000);

		expect(callback).toHaveBeenCalledTimes(1);
	});

	test('does not call a slow callback again while it is still running', async () => {
		const callback = vi.fn(async () => new Promise<void>(() => {
			// Never settles, like a fetch that hangs
		}));
		scheduleAt(T0 + 1000, callback);

		await vi.advanceTimersByTimeAsync(60_000);

		expect(callback).toHaveBeenCalledTimes(1);
	});

	test('runs a callback scheduled for a time already reached on the next tick, not in the same pass', () => {
		const rescheduled = vi.fn();
		scheduleAt(T0 + 1000, () => {
			scheduleAt(Date.now(), rescheduled);
		});

		vi.advanceTimersByTime(1000);
		expect(rescheduled).not.toHaveBeenCalled();

		vi.advanceTimersByTime(TICK_MS);
		expect(rescheduled).toHaveBeenCalledTimes(1);
	});

	test('can schedule the next run from inside a callback', () => {
		const callback = vi.fn();
		scheduleAt(T0 + 1000, () => {
			callback();
			scheduleAt(T0 + 3000, callback);
		});

		vi.advanceTimersByTime(5000);

		expect(callback).toHaveBeenCalledTimes(2);
	});

	test('logs a callback that throws or rejects and still runs the others', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const healthy = vi.fn();
		scheduleAt(T0 + 1000, () => {
			throw new Error('sync failure');
		});
		scheduleAt(T0 + 1000, async () => {
			throw new Error('async failure');
		});
		scheduleAt(T0 + 1000, healthy);

		await vi.advanceTimersByTimeAsync(1000);

		expect(healthy).toHaveBeenCalledTimes(1);
		expect(error).toHaveBeenCalledTimes(2);
	});

	test('does not run a callback that was cancelled', () => {
		const callback = vi.fn();
		const cancel = scheduleAt(T0 + 1000, callback);

		cancel();
		vi.advanceTimersByTime(5000);

		expect(callback).not.toHaveBeenCalled();
	});

	test('drops everything on resetTimerRegistry', () => {
		const callback = vi.fn();
		scheduleAt(T0 + 1000, callback);

		resetTimerRegistry();
		vi.advanceTimersByTime(5000);

		expect(callback).not.toHaveBeenCalled();
	});
});

describe('timer-registry scheduleReload', () => {
	const T0 = 1_800_000_000_000;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(T0);
	});

	afterEach(() => {
		resetTimerRegistry();
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	test('reloads once the clock reaches the time, even after a jump no timer accounts for', () => {
		const reload = vi.fn();
		vi.stubGlobal('location', {...location, reload});
		scheduleReload(T0 + (60 * 60 * 1000));

		vi.advanceTimersByTime(1000);
		expect(reload).not.toHaveBeenCalled();

		// Like a device waking from sleep: the wall clock moves past the time without timers elapsing
		vi.setSystemTime(T0 + (2 * 60 * 60 * 1000));
		vi.advanceTimersByTime(TICK_MS);
		expect(reload).toHaveBeenCalledTimes(1);
	});

	test('does not reload once cancelled', () => {
		const reload = vi.fn();
		vi.stubGlobal('location', {...location, reload});
		const cancel = scheduleReload(T0 + 1000);

		cancel();
		vi.advanceTimersByTime(5000);

		expect(reload).not.toHaveBeenCalled();
	});
});
