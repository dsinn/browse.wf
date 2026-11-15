import {
	describe,
	test,
	expect,
	beforeEach,
	afterEach,
	vi,
} from 'vitest';
import {MILLIS_PER_HOUR, MILLIS_PER_WEEK} from '../helpers/time-helpers';
import {findCurrentConquest} from './weekly';

const THIS_WEEK = Date.UTC(2026, 10, 16);
const NEXT_WEEK = THIS_WEEK + MILLIS_PER_WEEK;

const mongoDate = (ms: number) => ({$date: {$numberLong: String(ms)}});
const labConquest = (activation: number) => ({
	Type: 'CT_LAB',
	Activation: mongoDate(activation),
	Expiry: mongoDate(activation + MILLIS_PER_WEEK),
});

describe('findCurrentConquest', () => {
	beforeEach(() => {
		vi.useFakeTimers({toFake: ['Date']});
		vi.setSystemTime(NEXT_WEEK - MILLIS_PER_HOUR);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	test('picks this week\'s even when next week\'s is listed first', () => {
		// Not yet observed in the wild, but just in case
		const thisWeek = labConquest(THIS_WEEK);
		expect(findCurrentConquest([labConquest(NEXT_WEEK), thisWeek], 'CT_LAB')).toBe(thisWeek);
	});
});
