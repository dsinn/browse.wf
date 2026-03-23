/**
 * Tests for updateDescendia() in src/descendia.ts
 *
 * The global test setup (setup.ts) loads live.html as the DOM fixture, which already
 * contains #descendia-table, #descent-checks, and [data-collapse-toggle="descendia"].
 * We use those elements directly.
 *
 * Covers:
 *  - Retry when worldState is missing or empty (setTimeout)
 *  - Retry when no active descent found (stale worldState)
 *  - Active descent: header update, expiry badge, table rendered
 *  - Re-render scheduled at expiry
 *  - Missing header / table handled gracefully
 */
import {
	describe, test, expect, beforeAll, beforeEach, afterEach, vi,
} from 'vitest';
import {updateDescendia} from '../../../src/descendia/index';
import {mockBootstrapTooltip} from '../../helpers/dom-helpers';
import {loadMock} from '../../helpers/api-mocks';
import {freezeTime, MOCK_TIMESTAMP} from '../../helpers/time-helpers';

// Captured before any fake timers are installed
const realNow = Date.now();

declare function getDictPromise(): Promise<Record<string, string>>;

const mockWorldState = {Descents: loadMock('worldState.json').Descents};

beforeAll(() => {
	(globalThis as any).worldState = mockWorldState;
});

beforeEach(() => {
	vi.clearAllMocks();
	vi.useFakeTimers();
	freezeTime(MOCK_TIMESTAMP);
	mockBootstrapTooltip();

	(globalThis as any).getDictPromise = vi.fn(async () => ({}));
	(globalThis as any).createExpiryBadge = vi.fn((ms: number) => {
		const span = document.createElement('span');
		span.className = 'expiry-badge';
		span.dataset.expiry = String(ms);
		return span;
	});
});

afterEach(() => {
	vi.useRealTimers();
	(globalThis as any).worldState = mockWorldState;
	delete (globalThis as any).getDictPromise;
	delete (globalThis as any).createExpiryBadge;
});

describe('updateDescendia — worldState not ready', () => {
	test('schedules retry when worldState is undefined', () => {
		delete (globalThis as any).worldState;

		updateDescendia();

		expect(vi.getTimerCount()).toBeGreaterThan(0);
	});

	test('schedules retry when Descents is empty', () => {
		(globalThis as any).worldState = {Descents: []};

		updateDescendia();

		expect(vi.getTimerCount()).toBeGreaterThan(0);
	});

	test('does not render table when worldState is not ready', () => {
		delete (globalThis as any).worldState;

		updateDescendia();

		expect((globalThis as any).getDictPromise).not.toHaveBeenCalled();
	});
});

describe('updateDescendia — no active descent', () => {
	beforeEach(() => {
		freezeTime(realNow);
	});

	test('schedules retry when all descents are in the past', () => {
		updateDescendia();

		expect(vi.getTimerCount()).toBeGreaterThan(0);
		expect((globalThis as any).getDictPromise).not.toHaveBeenCalled();
	});
});

describe('updateDescendia — active descent', () => {
	let activeDescent: any;

	beforeEach(() => {
		activeDescent = mockWorldState.Descents[0];
	});

	test('calls getDictPromise to render the table', async () => {
		updateDescendia();
		for (let i = 0; i < 20; i++) {
			await Promise.resolve();
		}

		expect((globalThis as any).getDictPromise).toHaveBeenCalled();
	});

	test('appends expiry badge to header', async () => {
		updateDescendia();
		for (let i = 0; i < 20; i++) {
			await Promise.resolve();
		}

		const badge = document.querySelector('.card-header .expiry-badge');
		expect(badge).not.toBeNull();
	});

	test('passes expiry timestamp to createExpiryBadge', () => {
		const expiryMs = Number.parseInt(activeDescent.Expiry.$date.$numberLong, 10);
		updateDescendia();

		expect((globalThis as any).createExpiryBadge).toHaveBeenCalledWith(expiryMs);
	});

	test('schedules re-render at descent expiry', () => {
		updateDescendia();

		// At least one timer pending for the expiry re-render
		expect(vi.getTimerCount()).toBeGreaterThan(0);
	});

	test('replaces existing tbody when table exists', async () => {
		const table = document.querySelector('#descendia-table')!;

		// Mark the existing tbody so we can verify it gets replaced
		const oldTbody = table.querySelector('tbody')!;
		oldTbody.className = 'old-tbody';

		updateDescendia();
		for (let i = 0; i < 20; i++) {
			await Promise.resolve();
		}

		// Old tbody should be gone
		expect(table.querySelector('.old-tbody')).toBeNull();
		// New tbody should be present
		expect(table.querySelector('tbody')).not.toBeNull();
	});

	test('collapse toggle is preserved in header after update', async () => {
		updateDescendia();
		for (let i = 0; i < 20; i++) {
			await Promise.resolve();
		}

		const toggle = document.querySelector('[data-collapse-toggle="descendia"]');
		expect(toggle).not.toBeNull();
	});

	test('checks span is preserved in header after update', async () => {
		updateDescendia();
		for (let i = 0; i < 20; i++) {
			await Promise.resolve();
		}

		const checks = document.querySelector('#descent-checks');
		expect(checks).not.toBeNull();
	});
});

describe('updateDescendia — missing DOM elements', () => {
	test('does not throw when card header is absent', async () => {
		document.querySelector('.card-header:has(#descent-checks)')?.remove();

		expect(() => {
			updateDescendia();
		}).not.toThrow();
		for (let i = 0; i < 20; i++) {
			await Promise.resolve();
		}
	});

	test('does not throw when #descendia-table is absent', async () => {
		document.querySelector('#descendia-table')?.remove();

		expect(() => {
			updateDescendia();
		}).not.toThrow();
		for (let i = 0; i < 20; i++) {
			await Promise.resolve();
		}
	});
});
