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
