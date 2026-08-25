/**
 * Tests for updateCircuit() in src/live/circuit.ts
 *
 * The global test setup (setup.ts) loads live.html as the DOM fixture, which
 * contains #circuit-frames, #circuit-weapons, #circuit-frames-check,
 * #circuit-weapons-check, and [data-collapse-toggle="weekly-missions"].
 */
import {
	describe, test, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {loadMock} from '@test/helpers/api-mocks';
import {freezeTime, MOCK_TIMESTAMP} from '@test/helpers/time-helpers';
import {updateCircuitChoices as updateCircuit} from './circuit';
import * as weekly from './weekly';

const mockWorldState = {EndlessXpSchedule: loadMock('worldState.json').EndlessXpSchedule};

const EXPIRY = Number.parseInt(
	mockWorldState.EndlessXpSchedule[0].Expiry.$date.$numberLong,
	10,
);

function setupGlobals() {
	(globalThis as any).worldState = mockWorldState;
	(globalThis as any).setDatum = vi.fn();
	(globalThis as any).createCompletionToggle = vi.fn((key: string) => {
		const span = document.createElement('span');
		span.className = 'completion-toggle';
		span.dataset.key = key;
		return span;
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.useFakeTimers();
	freezeTime(MOCK_TIMESTAMP);
	setupGlobals();
	vi.spyOn(weekly, 'filterWeeklyMissions').mockReturnValue(undefined);
});

afterEach(() => {
	vi.useRealTimers();
	(globalThis as any).worldState = mockWorldState;
	delete (globalThis as any).setDatum;
	delete (globalThis as any).createCompletionToggle;
});

describe('updateCircuit — worldState not ready', () => {
	test('schedules retry when worldState is undefined', () => {
		delete (globalThis as any).worldState;

		updateCircuit();

		expect(vi.getTimerCount()).toBeGreaterThan(0);
	});

	test('schedules retry when EndlessXpSchedule is missing', () => {
		(globalThis as any).worldState = {};

		updateCircuit();

		expect(vi.getTimerCount()).toBeGreaterThan(0);
	});

	test('schedules retry when EndlessXpSchedule is empty', () => {
		(globalThis as any).worldState = {EndlessXpSchedule: []};

		updateCircuit();

		expect(vi.getTimerCount()).toBeGreaterThan(0);
	});

	test('does not call setDatum when worldState is not ready', () => {
		delete (globalThis as any).worldState;

		updateCircuit();

		expect((globalThis as any).setDatum).not.toHaveBeenCalled();
	});
});

describe('updateCircuit — no active entry', () => {
	test('schedules retry when all entries are in the past', () => {
		vi.spyOn(Date, 'now').mockReturnValue(9_999_999_999_000);

		updateCircuit();

		expect(vi.getTimerCount()).toBeGreaterThan(0);
		expect((globalThis as any).setDatum).not.toHaveBeenCalled();
	});
});

describe('updateCircuit — active entry', () => {
	test('calls setDatum with "Weekly Missions" and correct expiry', () => {
		updateCircuit();

		expect((globalThis as any).setDatum).toHaveBeenCalledWith('circuit-header', 'Weekly Missions', EXPIRY);
	});

	test('creates circuit-normal completion toggle keyed with expiry', () => {
		updateCircuit();

		expect((globalThis as any).createCompletionToggle).toHaveBeenCalledWith(`circuit-normal-${EXPIRY}`);
	});

	test('creates circuit-hard completion toggle keyed with expiry', () => {
		updateCircuit();

		expect((globalThis as any).createCompletionToggle).toHaveBeenCalledWith(`circuit-hard-${EXPIRY}`);
	});

	test('appends circuit-normal toggle to #circuit-frames-check', () => {
		updateCircuit();

		const element = document.querySelector('#circuit-frames-check');
		expect(element?.querySelector('.completion-toggle')).not.toBeNull();
	});

	test('appends circuit-hard toggle to #circuit-weapons-check', () => {
		updateCircuit();

		const element = document.querySelector('#circuit-weapons-check');
		expect(element?.querySelector('.completion-toggle')).not.toBeNull();
	});

	test('schedules re-render at entry expiry', () => {
		updateCircuit();

		expect(vi.getTimerCount()).toBeGreaterThan(0);
	});

	test('renders frame names in #circuit-frames', () => {
		updateCircuit();

		const element = document.querySelector('#circuit-frames');
		// EXC_NORMAL choices are ['Nidus', 'Octavia', 'Harrow']
		expect(element?.textContent).toContain('Nidus');
		expect(element?.textContent).toContain('Octavia');
		expect(element?.textContent).toContain('Harrow');
	});

	test('renders weapon names in #circuit-weapons', () => {
		updateCircuit();

		const element = document.querySelector('#circuit-weapons');
		// EXC_HARD choices are ['Braton', 'Lato', 'Skana', 'Paris', 'Kunai']
		expect(element?.textContent).toContain('Braton');
		expect(element?.textContent).toContain('Lato');
		expect(element?.textContent).toContain('Skana');
	});

	test('calls filterWeeklyMissions after rendering', () => {
		updateCircuit();

		expect(weekly.filterWeeklyMissions).toHaveBeenCalled();
	});

	test('frame names are separated by middots', () => {
		updateCircuit();

		const element = document.querySelector('#circuit-frames');
		expect(element?.textContent).toMatch(/Nidus\u00A0·\s*Octavia\u00A0·\s*Harrow/u);
	});
});

describe('updateCircuit — choice display names', () => {
	test('renders ampersand for "And" in weapon names', () => {
		(globalThis as any).worldState = {EndlessXpSchedule: loadMock('worldState-circuit.json').EndlessXpSchedule};

		updateCircuit();

		const element = document.querySelector('#circuit-weapons');
		expect(element?.textContent).toContain('Ack & Brunt');
		expect(element?.textContent).toContain('Dual Ichor');
	});
});

