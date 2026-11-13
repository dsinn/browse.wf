import {
	describe,
	it,
	expect,
	beforeEach,
	afterEach,
} from 'vitest';
import {mockBootstrapTooltip} from '@test/helpers/dom-helpers';
import {PROFILE_TIMESTAMP_STORAGE_KEY} from './profile-freshness';
import {
	calculateAccuracy,
	describeEventStat,
	humanizeStatKey,
	renderStatsOverview,
} from './stats-overview';

describe('humanizeStatKey', () => {
	it.each([
		['FomorianEventScore', 'Fomorian Event'],
		['KelaEventBonusScoreMax', 'Kela Event Bonus'],
		['Halloween19ScoreMax', 'Halloween 19'],
		['HiveEventScoreSum', 'Hive Event (Total)'],
		['ZephyrScore', 'Zephyr'],
		['FlotillaGroundBadgesTier2', 'Flotilla Ground Badges Tier 2'],
	])('turns %s into %s', (key, label) => {
		expect(humanizeStatKey(key)).toBe(label);
	});
});

describe('describeEventStat', () => {
	it.each([
		['FomorianEventScore', 'Eyes of Blight'],
		['ProjectSinisterEventScore', 'Shadow Debt'],
		['KelaEventBonusScoreMax', 'Rathuum'],
		['ColonistRescueEventScoreMax', 'The Pacifism Defect'],
		['AmalgamEventScoreMax', 'Hostile Mergers'],
		['Halloween16', 'Hallowed Nightmares'],
		['Halloween19ScoreMax', 'Hallowed Flame'],
		['HiveEventScoreSum', 'Breeding Grounds (Total)'],
		['FlotillaSpaceBadgesTier3', 'Scarlet Spear Space Badges Tier 3'],
		['MechSurvivalScoreMax', 'Orphix Venom'],
		['ZephyrScore', 'Happy Zephyr'],
		['SentinelGameScore', 'Wyrmius'],
	])('names %s as %s', (key, label) => {
		expect(describeEventStat(key)).toBe(label);
	});

	it('falls back to the key split into words when the event is not known', () => {
		expect(describeEventStat('SomeNewEventScoreMax')).toBe('Some New Event');
	});
});

describe('calculateAccuracy', () => {
	it('totals hits and shots over weapons that recorded both', () => {
		expect(calculateAccuracy([
			{fired: 100, hits: 40},
			{fired: 50, hits: 0},
			{fired: 5000}, // No hits key: hits probably aren't tracked for this weapon
			{hits: 999}, // No shots recorded, so it can't be attributed
		])).toEqual({hits: 40, fired: 150});
	});

	it('returns undefined when no shots were recorded', () => {
		expect(calculateAccuracy([{hits: 5}])).toBeUndefined();
		expect(calculateAccuracy(undefined)).toBeUndefined();
	});
});

describe('renderStatsOverview', () => {
	const raidKey = '/Lotus/Types/Keys/RaidKeys/';
	const eidolonPath = '/Lotus/Types/Enemies/Sentients/Eidolon/';
	const baseProfile = () => ({
		Results: [{
			PlayerLevel: 36,
			DailyFocus: 138_416,
			Missions: [
				{Tag: `${raidKey}Raid01Stage03KeyItem`, Completes: 114, RewardsCooldownTime: {$date: {$numberLong: '1518393600000'}}},
				{Tag: `${raidKey}Raid01Stage03NightmareKeyItem`, Completes: 105, RewardsCooldownTime: {$date: {$numberLong: '1518307200000'}}},
				{Tag: `${raidKey}RaidGolemStage03KeyItem`, Completes: 182},
				{Tag: `${raidKey}Raid01Stage01KeyItem`, Completes: 120},
			],
		}],
		Stats: {
			MeleeKills: 602_441,
			PickupCount: 10_037_206,
			Weapons: [{fired: 200, hits: 50}],
			Enemies: [
				{type: `${eidolonPath}SentientTeralystAvatar`, captures: 92, kills: 35},
				{type: `${eidolonPath}SentientTeralystRainAvatar`, captures: 72, kills: 32},
				{type: `${eidolonPath}SentientVomvalystAvatar`, kills: 2878},
				{type: '/Enemy/Lancer', kills: 3},
			],
			FomorianEventScore: 27_788_800,
			KelaEventBonusScoreMax: 169,
			Rank: 35,
		},
	});

	function text() {
		return document.querySelector('#stats-overview-extra')!.textContent;
	}

	function section(title: string) {
		return [...document.querySelectorAll<HTMLElement>('#stats-overview-extra > div')]
			.find(column => column.querySelector('h6')?.textContent === title);
	}

	function tableText(title: string) {
		return [...section(title)!.querySelectorAll<HTMLTableRowElement>('tr')]
			.map(row => [...row.cells].map(cell => cell.textContent));
	}

	beforeEach(() => {
		mockBootstrapTooltip();
		localStorage.clear();
		localStorage.setItem(PROFILE_TIMESTAMP_STORAGE_KEY, Date.now().toString());
		(globalThis as any).dict = {teralyst: 'Eidolon Teralyst', hydrolyst: 'Eidolon Hydrolyst', vomvalyst: 'Eidolon Vomvalyst'};
		(globalThis as any).ExportEnemies = {
			avatars: {
				[`${eidolonPath}SentientTeralystAvatar`]: {name: 'teralyst'},
				[`${eidolonPath}SentientTeralystRainAvatar`]: {name: 'hydrolyst'},
				[`${eidolonPath}SentientVomvalystAvatar`]: {name: 'vomvalyst'},
			},
		};
		document.body.innerHTML = `
			<span class="d-block">Average Cipher Time: <span id="stat-CipherTimeAvg">3.1s</span></span>
			<span class="d-block">Something after it</span>
			<div id="stats-overview-extra"></div>
		`;
	});

	afterEach(() => {
		delete (globalThis as any).ExportEnemies;
	});

	it('shows combat and collection totals that are present', () => {
		renderStatsOverview(baseProfile());

		expect(text()).toContain(`Melee Kills: ${(602_441).toLocaleString()}`);
		expect(text()).toContain(`Items Picked Up: ${(10_037_206).toLocaleString()}`);
		expect(text()).not.toContain('Fish Caught');
	});

	it('shows overall accuracy with the raw counts as a tooltip', () => {
		renderStatsOverview(baseProfile());

		expect(text()).toContain('Overall Accuracy: 25.0%');
		expect(document.querySelector<HTMLElement>('#stats-overview-extra .has-tooltip')?.dataset.bsTitle).toBe('50 hits / 200 fired');
	});

	describe('combat totals', () => {
		const totalsProfile = () => {
			const profile = baseProfile();
			profile.Stats.Enemies = [
				{
					type: '/Enemy/Lancer', kills: 1200, headshots: 100, assists: 30,
				},
				{type: '/Enemy/Crewman', kills: 800, headshots: 50},
				{type: '/Enemy/Moa', kills: 5, assists: 2},
			] as any;
			return profile;
		};

		it('adds total kills, headshot kills and kill assists to the combat section', () => {
			renderStatsOverview(totalsProfile());

			const lines = [...section('Combat & Collection')!.querySelectorAll('span.d-block')].map(line => line.textContent);
			expect(lines).toContain(`Total Kills: ${(2005).toLocaleString()}`);
			expect(lines).toContain('Headshot Kills: 150');
			expect(lines).toContain('Kill Assists: 32');
		});

		it('leaves them out when there are no enemy stats', () => {
			const profile = totalsProfile();
			profile.Stats.Enemies = [];
			renderStatsOverview(profile);

			expect(text()).not.toContain('Total Kills');
		});

		it('no longer has a kills by faction table, which is in the Enemies tab', () => {
			renderStatsOverview(totalsProfile());

			expect(section('Kills by Faction')).toBeUndefined();
		});
	});

	describe('Eidolons', () => {
		it('has a row per Eidolon, without the "Eidolon" prefix', () => {
			renderStatsOverview(baseProfile());

			expect(tableText('Eidolons')).toEqual([
				['Eidolon', 'Captured', 'Killed'],
				['Teralyst', '92', '35'],
				['Hydrolyst', '72', '32'],
			]);
		});

		it('leaves out the Vomvalyst, whose kills are in the Enemies tab', () => {
			renderStatsOverview(baseProfile());

			expect(section('Eidolons')?.textContent).not.toContain('Vomvalyst');
			expect(text()).not.toContain((2878).toLocaleString());
		});

		it('does not add a combined total to the combat section', () => {
			renderStatsOverview(baseProfile());

			expect(text()).not.toContain('Eidolons Captured');
		});

		it('has no Eidolons section when none appear in the stats', () => {
			const profile = baseProfile();
			profile.Stats.Enemies = [{type: '/Enemy/Lancer', kills: 3}];
			renderStatsOverview(profile);

			expect(section('Eidolons')).toBeUndefined();
		});
	});

	it('names the minigames the way the game does', () => {
		const profile = baseProfile();
		Object.assign(profile.Stats, {ZephyrScore: 7, CaliberChicksScore: 12});
		renderStatsOverview(profile);

		const labels = [...section('Event Scores & Minigames')!.querySelectorAll('span.d-block')].map(line => line.textContent);
		expect(labels).toContain('Happy Zephyr: 7');
		expect(labels).toContain('Caliber Chicks 2: 12');
	});

	it('shows event scores that are present, with readable names and no repeated "Score"', () => {
		renderStatsOverview(baseProfile());

		expect(section('Event Scores & Minigames')?.textContent).toContain(`Eyes of Blight: ${(27_788_800).toLocaleString()}`);
		expect(section('Event Scores & Minigames')?.textContent).toContain('Rathuum: 169');
		const labels = [...section('Event Scores & Minigames')!.querySelectorAll('span.d-block')].map(line => line.textContent);
		expect(labels.some(label => label.includes('Score'))).toBe(false);
		expect(text()).not.toContain('Rank');
	});

	describe('trials', () => {
		it('marks the section heading, not a column, with the asterisk the footnote refers to', () => {
			renderStatsOverview(baseProfile());

			expect(section('Trials*')?.querySelector('h6')?.textContent).toBe('Trials*');
			expect(tableText('Trials*')[0].join('')).not.toContain('*');
		});

		it('lists the completions and last completion date of each trial', () => {
			renderStatsOverview(baseProfile());

			const rows = tableText('Trials*');
			expect(rows[0]).toEqual(['Trial', 'Completions', 'Last completed']);
			expect(rows[1].slice(0, 2)).toEqual(['Law of Retribution', '114']);
			expect(rows[2].slice(0, 2)).toEqual(['Law of Retribution (Nightmare)', '105']);
			expect(rows[3]).toEqual(['Jordas Verdict', '182', '—']);
		});

		it('shows the date in UTC, so it does not slip a day in timezones behind UTC', () => {
			renderStatsOverview(baseProfile());

			// 1518393600000 is 2018-02-12T00:00:00Z
			expect(tableText('Trials*')[1][2]).toMatch(/12.*2018|2018.*12/u);
		});

		it('never shows the internal name "raid" to the user', () => {
			renderStatsOverview(baseProfile());

			expect(document.querySelector('#stats-overview-extra')!.textContent.toLowerCase()).not.toContain('raid');
		});

		it('only shows the final stage of each trial', () => {
			renderStatsOverview(baseProfile());

			expect(section('Trials*')?.textContent).not.toContain('120');
		});

		it('explains that trials were removed from the game', () => {
			renderStatsOverview(baseProfile());

			expect(section('Trials*')?.querySelector('small')?.textContent).toBe('* Trials were removed from the game on 2018-03-01.');
		});

		it('links to the wiki page about trials in the footnote, in a new tab', () => {
			renderStatsOverview(baseProfile());

			const link = section('Trials*')?.querySelector<HTMLAnchorElement>(':scope small a');
			expect(link?.href).toBe('https://wiki.warframe.com/w/Trial');
			expect(link?.textContent).toBe('Trials');
			expect(link?.target).toBe('_blank');
			expect(link?.rel).toContain('noopener');
		});

		it('is omitted entirely when no trial has been completed', () => {
			const profile = baseProfile();
			profile.Results[0].Missions = [];
			renderStatsOverview(profile);

			expect(section('Trials*')).toBeUndefined();
			expect(text()).not.toContain('Trials');
		});
	});

	describe('daily focus', () => {
		const focusLine = () => document.querySelector('#stat-DailyFocus');

		it('shows the focus left today against the cap of 250,000 + 5,000 per mastery rank', () => {
			renderStatsOverview(baseProfile());

			expect(focusLine()?.textContent).toBe(`Focus Left Today: ${(138_416).toLocaleString()} / ${(430_000).toLocaleString()}`);
		});

		it('goes just under the Average Cipher Time line, not in the extra sections', () => {
			renderStatsOverview(baseProfile());

			const cipherLine = document.querySelector('#stat-CipherTimeAvg')!.closest('.d-block')!;
			expect(cipherLine.nextElementSibling).toBe(focusLine());
			expect(text()).not.toContain('Focus Left Today');
		});

		it('is not duplicated when rendered again', () => {
			renderStatsOverview(baseProfile());
			renderStatsOverview(baseProfile());

			expect(document.querySelectorAll('[id="stat-DailyFocus"]')).toHaveLength(1);
		});

		it('explains in its tooltip that it resets daily, at a local time of day', () => {
			renderStatsOverview(baseProfile());

			const tooltip = focusLine()?.querySelector<HTMLElement>('.has-tooltip')?.dataset.bsTitle;
			expect(tooltip).toMatch(/Resets daily at \d{1,2}:\d{2}/u);
			expect(tooltip).not.toContain('00:00');
		});

		it('is hidden, and an earlier one removed, when the profile was not fetched today', () => {
			renderStatsOverview(baseProfile());
			localStorage.setItem(PROFILE_TIMESTAMP_STORAGE_KEY, String(Date.now() - (2 * 24 * 60 * 60 * 1000)));
			renderStatsOverview(baseProfile());

			expect(focusLine()).toBeNull();
		});

		it('is skipped when the page has no Average Cipher Time line to go under', () => {
			document.querySelector('#stat-CipherTimeAvg')!.closest('.d-block')!.remove();
			renderStatsOverview(baseProfile());

			expect(focusLine()).toBeNull();
		});
	});

	it('replaces the previous content when rendered again', () => {
		renderStatsOverview(baseProfile());
		renderStatsOverview(baseProfile());

		expect(document.querySelectorAll('#stats-overview-extra h6')).toHaveLength(4);
	});

	it('does nothing when the container is missing', () => {
		document.body.replaceChildren();

		expect(() => {
			renderStatsOverview(baseProfile());
		}).not.toThrow();
	});
});
