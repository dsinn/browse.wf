import {describe, it, expect} from 'vitest';
import {canonicalizeMissionType} from './mission-helpers';

describe('mission-helpers', () => {
	describe('canonicalizeMissionType', () => {
		it('maps MT_INTEL to MT_SPY', () => {
			expect(canonicalizeMissionType('MT_INTEL')).toBe('MT_SPY');
		});

		it('leaves MT_SPY unchanged', () => {
			expect(canonicalizeMissionType('MT_SPY')).toBe('MT_SPY');
		});

		it('leaves other mission types unchanged', () => {
			expect(canonicalizeMissionType('MT_EXTERMINATION')).toBe('MT_EXTERMINATION');
			expect(canonicalizeMissionType('MT_SURVIVAL')).toBe('MT_SURVIVAL');
			expect(canonicalizeMissionType('MT_CAPTURE')).toBe('MT_CAPTURE');
		});
	});
});
