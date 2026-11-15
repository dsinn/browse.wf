import {
	describe,
	test,
	expect,
	beforeEach,
	vi,
} from 'vitest';
import {mockBootstrapTooltip} from '@test/helpers/dom-helpers';
import {formatAlertRewards, makeAlertMissionIcons} from './alerts';

vi.mock('../public-export-fetcher.js', () => ({
	fetchExport: async () => ({}),
}));

describe('formatAlertRewards', () => {
	test('credits-only reward has no delimiter', () => {
		expect(formatAlertRewards([], 15_000)).toBe('15,000 Credits');
	});

	test('puts credits after a single reward', () => {
		expect(formatAlertRewards(['Rifle Riven Mod'], 10_000)).toBe('Rifle Riven Mod, 10,000 Credits');
	});

	test('keeps reward order and puts credits last with several rewards', () => {
		expect(formatAlertRewards(['Forma Blueprint', '50X Moonflesh', 'Orokin Catalyst'], 17_000))
			.toBe('Forma Blueprint, 50X Moonflesh, Orokin Catalyst, 17,000 Credits');
	});

	test('does not mutate the input list', () => {
		const names = ['50X Moonflesh'];
		formatAlertRewards(names, 17_000);
		expect(names).toEqual(['50X Moonflesh']);
	});

	test('formats zero credits', () => {
		expect(formatAlertRewards(['50X Moonflesh'], 0)).toBe('50X Moonflesh, 0 Credits');
	});

	test('registers itself on window for live.ts', () => {
		expect((window as any).formatAlertRewards).toBe(formatAlertRewards);
	});
});

describe('makeAlertMissionIcons', () => {
	beforeEach(() => {
		mockBootstrapTooltip();
		(globalThis as any).setImageSource = (img: HTMLImageElement, icon: string) => {
			img.dataset.src = icon;
		};

		(globalThis as any).getItemNamePromise = async (uniqueName: string) =>
			({'/Lotus/Types/Keys/JadeShadows/JadeShadowQuestKeyChain': 'Jade Shadows'})[uniqueName] ?? uniqueName;
	});

	test('returns nothing for an alert without requirements', async () => {
		expect(await makeAlertMissionIcons({})).toEqual([]);
	});

	test('adds a lock with the required quest name as its tooltip', async () => {
		const [space, lock] = await makeAlertMissionIcons({questReq: '/Lotus/Types/Keys/JadeShadows/JadeShadowQuestKeyChain'});
		expect(space).toBe(' ');
		expect(lock).toBeInstanceOf(HTMLElement);
		expect((lock as HTMLElement).textContent).toBe('🔒\u{FE0E}');
		expect((lock as HTMLElement).dataset.bsTitle).toBe('Requires quest: Jade Shadows');
	});

	test.each(['archwingRequired', 'isSharkwingMission'])('adds the Archwing icon when %s is set', async flag => {
		const [space, icon] = await makeAlertMissionIcons({[flag]: true});
		expect(space).toBe(' ');
		expect((icon as HTMLElement).dataset.bsTitle).toBe('Archwing');
	});

	test('adds one Archwing icon when both Archwing flags are set', async () => {
		const icons = await makeAlertMissionIcons({archwingRequired: true, isSharkwingMission: true});
		expect(icons.filter(icon => typeof icon !== 'string')).toHaveLength(1);
	});

	test('registers itself on window for live.ts', () => {
		expect(window.makeAlertMissionIcons).toBe(makeAlertMissionIcons);
	});
});
