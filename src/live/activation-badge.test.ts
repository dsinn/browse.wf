import {
	describe, test, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {createActivationBadge} from './activation-badge';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function attached(elapsed: number): HTMLSpanElement {
	const badge = createActivationBadge(Date.now() - elapsed);
	document.body.append(badge);
	return badge;
}

describe('activation-badge', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
	});

	afterEach(() => {
		document.body.replaceChildren();
		vi.useRealTimers();
	});

	test('creates a badge with the activation attribute', () => {
		const activation = Date.now() - HOUR;
		const badge = createActivationBadge(activation);
		expect(badge.classList.contains('badge')).toBe(true);
		expect(badge.dataset.activation).toBe(String(activation));
	});

	test.each([
		[0, '1m'],
		[5 * SECOND, '1m'],
		[59 * SECOND, '1m'],
		[MINUTE, '1m'],
		[(2 * MINUTE) + (5 * SECOND), '2m'],
		[(3 * HOUR) + MINUTE, '3h'],
		[(4 * DAY) + HOUR, '4d'],
	])('shows only the largest unit, and at least a minute, for %i ms elapsed', (elapsed, expected) => {
		expect(createActivationBadge(Date.now() - elapsed).textContent).toBe(expected);
	});

	test('stays at 1m through the first two minutes, then becomes 2m', () => {
		const badge = attached(5 * SECOND);
		expect(badge.textContent).toBe('1m');

		vi.advanceTimersByTime((2 * MINUTE) - (5 * SECOND) - 1);
		expect(badge.textContent).toBe('1m');

		vi.advanceTimersByTime(1);
		expect(badge.textContent).toBe('2m');
	});

	test.each([
		{
			name: 'minutes', elapsed: (2 * MINUTE) + (30 * SECOND), unit: MINUTE, before: '2m', after: '3m',
		},
		{
			name: 'hours', elapsed: (3 * HOUR) + (10 * MINUTE), unit: HOUR, before: '3h', after: '4h',
		},
		{
			name: 'days', elapsed: (4 * DAY) + (6 * HOUR), unit: DAY, before: '4d', after: '5d',
		},
	])('updates $name exactly when the unit changes, using one timeout', ({
		elapsed, unit, before, after,
	}) => {
		const badge = attached(elapsed);
		expect(badge.textContent).toBe(before);
		expect(vi.getTimerCount()).toBe(1);

		const untilChange = unit - (elapsed % unit);
		vi.advanceTimersByTime(untilChange - 1);
		expect(badge.textContent).toBe(before);

		vi.advanceTimersByTime(1);
		expect(badge.textContent).toBe(after);
	});

	test('stops updating when the badge has been removed', () => {
		const badge = attached(5 * MINUTE);
		expect(vi.getTimerCount()).toBe(1);

		badge.remove();
		vi.advanceTimersByTime(MINUTE);
		expect(vi.getTimerCount()).toBe(0);
	});

	test('does not loop when the activation time is far in the future', () => {
		const badge = attached(-100 * DAY);
		expect(badge.textContent).toBe('1m');

		// Reschedules itself in bounded steps rather than firing immediately and repeatedly
		const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
		vi.advanceTimersByTime(DAY);
		expect(timeoutSpy.mock.calls.length).toBeLessThan(5);
	});

	test('schedules nothing for an invalid activation time', () => {
		const badge = createActivationBadge(Number.NaN);
		document.body.append(badge);

		expect(badge.textContent).toBe('');
		expect(vi.getTimerCount()).toBe(0);
	});
});
