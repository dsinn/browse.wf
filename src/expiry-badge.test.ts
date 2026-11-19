import {
	describe,
	test,
	expect,
	beforeEach,
	afterEach,
	vi,
} from 'vitest';
import {resetTimerRegistry, TICK_MS} from './timer-registry';
import {createExpiryBadge} from './expiry-badge';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('expiry-badge', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
	});

	afterEach(() => {
		resetTimerRegistry();
		document.body.replaceChildren();
		vi.useRealTimers();
	});

	describe('createExpiryBadge()', () => {
		test('creates a badge with the expiry attribute', () => {
			const expiry = Date.now() + MINUTE;
			const badge = createExpiryBadge(expiry);
			expect(badge.classList.contains('badge')).toBe(true);
			expect(badge.dataset.expiry).toBe(String(expiry));
		});

		// The badge shows the time remaining rounded up to the next whole second, hence the extra -SECOND
		test.each([
			[5 * SECOND, '05s'],
			[MINUTE + (5 * SECOND), '1m 05s'],
			[HOUR + MINUTE + (5 * SECOND), '1h 1m 05s'],
			[DAY + HOUR + MINUTE + SECOND, '1d 1h 1m 01s'],
			[DAY, '1d 0h 0m 00s'],
		])('formats %i ms remaining as "%s"', (remaining, expected) => {
			expect(createExpiryBadge(Date.now() + remaining - SECOND).textContent).toBe(expected);
		});

		test('shows the pending label once expired', () => {
			expect(createExpiryBadge(Date.now() - (5 * SECOND)).textContent).toBe('Pending update');
			expect(createExpiryBadge(Date.now() - SECOND).textContent).toBe('Pending update');
			expect(createExpiryBadge(Date.now()).textContent).toBe('01s');
		});

		test('counts down and ends on the pending label', () => {
			const badge = createExpiryBadge(Date.now() + (5 * SECOND));
			document.body.append(badge);
			expect(badge.textContent).toBe('06s');

			vi.advanceTimersByTime(2 * SECOND);
			expect(badge.textContent).toBe('04s');

			vi.advanceTimersByTime(10 * SECOND);
			expect(badge.textContent).toBe('Pending update');

			// The ticker drops the badge once it has shown the pending label, so it isn't updated again
			badge.dataset.expiry = String(Date.now() + MINUTE);
			vi.advanceTimersByTime(TICK_MS);
			expect(badge.textContent).toBe('Pending update');
		});

		test('accepts the expiry as a numeric string', () => {
			const badge = createExpiryBadge(String(Date.now() + (5 * SECOND)) as unknown as number);
			document.body.append(badge);

			vi.advanceTimersByTime(10 * SECOND);
			expect(badge.textContent).toBe('Pending update');
		});
	});
});
