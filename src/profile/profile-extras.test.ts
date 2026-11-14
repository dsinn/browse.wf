import {
	describe,
	it,
	expect,
	vi,
	beforeEach,
} from 'vitest';
import {renderAbilityStats} from './ability-stats';
import {renderDeathMarks} from './death-marks';
import {renderProfileExtras} from './profile-extras';
import {renderRaceStats} from './race-stats';
import {renderStatsOverview} from './stats-overview';
import {initStatsSubtabs} from './stats-subtabs';

// The parts are tested on their own; these tests are about how they are put together
vi.mock('./ability-stats', () => ({renderAbilityStats: vi.fn()}));
vi.mock('./death-marks', () => ({renderDeathMarks: vi.fn()}));
vi.mock('./race-stats', () => ({renderRaceStats: vi.fn()}));
vi.mock('./stats-overview', () => ({renderStatsOverview: vi.fn()}));
vi.mock('./stats-subtabs', () => ({initStatsSubtabs: vi.fn()}));

const parts = [
	renderDeathMarks,
	initStatsSubtabs,
	renderStatsOverview,
	renderRaceStats,
	renderAbilityStats,
];

describe('renderProfileExtras', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.spyOn(console, 'log').mockImplementation(() => undefined);
		vi.spyOn(console, 'warn').mockImplementation(() => undefined);
	});

	it('renders every part for the profile', async () => {
		const profile = {Results: []};
		await renderProfileExtras(profile);

		for (const part of parts) {
			expect(part).toHaveBeenCalledTimes(1);
		}

		expect(renderStatsOverview).toHaveBeenCalledWith(profile);
		expect(renderAbilityStats).toHaveBeenCalledWith(profile);
	});

	it('starts the parts that do not wait for anything straight away', () => {
		void renderProfileExtras({});

		expect(renderDeathMarks).toHaveBeenCalled();
		expect(renderStatsOverview).toHaveBeenCalled();
		expect(renderRaceStats).toHaveBeenCalled();
	});

	it.each([
		['death marks', renderDeathMarks],
		['stats sub-tabs', initStatsSubtabs],
		['stats overview', renderStatsOverview],
		['races', renderRaceStats],
	])('still renders the other parts when the %s part throws', async (_name, failing) => {
		vi.mocked(failing).mockImplementation(() => {
			throw new Error('broken');
		});
		await expect(renderProfileExtras({})).resolves.toBeUndefined();

		for (const part of parts) {
			expect(part).toHaveBeenCalledTimes(1);
		}
	});

	it('still renders the other parts when the abilities cannot be loaded, without rejecting', async () => {
		vi.mocked(renderAbilityStats).mockRejectedValue(new Error('export unavailable'));
		await expect(renderProfileExtras({})).resolves.toBeUndefined();

		expect(renderRaceStats).toHaveBeenCalledTimes(1);
		expect(renderStatsOverview).toHaveBeenCalledTimes(1);
	});

	it('logs a part that failed', async () => {
		vi.mocked(renderRaceStats).mockImplementation(() => {
			throw new Error('broken');
		});
		await renderProfileExtras({});

		expect(console.warn).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('races'), expect.any(Error));
	});
});
