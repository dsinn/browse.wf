import {
	describe,
	it,
	expect,
	beforeEach,
	afterEach,
} from 'vitest';
import {mockBootstrapTooltip} from '@test/helpers/dom-helpers';
import {PROFILE_TIMESTAMP_STORAGE_KEY} from './profile-freshness';
import {appendDailyStanding, getDailyAffiliationField} from './daily-standing';

describe('getDailyAffiliationField', () => {
	it('maps the normal bin to the unsuffixed field', () => {
		expect(getDailyAffiliationField('STANDING_LIMIT_BIN_NORMAL')).toBe('DailyAffiliation');
	});

	it.each([
		['STANDING_LIMIT_BIN_PVP', 'DailyAffiliationPvp'],
		['STANDING_LIMIT_BIN_VENTKIDS', 'DailyAffiliationVentkids'],
		['STANDING_LIMIT_BIN_CAVIA', 'DailyAffiliationCavia'],
		['STANDING_LIMIT_BIN_ZARIMAN', 'DailyAffiliationZariman'],
	])('maps %s to %s', (bin, field) => {
		expect(getDailyAffiliationField(bin)).toBe(field);
	});

	it('returns undefined for syndicates without a daily limit', () => {
		expect(getDailyAffiliationField('STANDING_LIMIT_BIN_NONE')).toBeUndefined();
		expect(getDailyAffiliationField(undefined)).toBeUndefined();
	});
});

describe('appendDailyStanding', () => {
	let body: HTMLElement;

	beforeEach(() => {
		mockBootstrapTooltip();
		localStorage.clear();
		localStorage.setItem(PROFILE_TIMESTAMP_STORAGE_KEY, Date.now().toString());
		body = document.createElement('div');
		(window as any).ExportSyndicates = {
			ZarimanSyndicate: {dailyLimitBin: 'STANDING_LIMIT_BIN_ZARIMAN'},
			EntratiLabSyndicate: {dailyLimitBin: 'STANDING_LIMIT_BIN_CAVIA'},
			PerrinSyndicate: {dailyLimitBin: 'STANDING_LIMIT_BIN_NORMAL'},
			EventSyndicate: {dailyLimitBin: 'STANDING_LIMIT_BIN_NONE'},
		};
		window.profile = {
			Results: [{
				PlayerLevel: 36,
				DailyAffiliation: 6355,
				DailyAffiliationZariman: 0,
				DailyAffiliationCavia: 34_000,
			}],
		};
	});

	afterEach(() => {
		delete (window as any).ExportSyndicates;
		delete window.profile;
	});

	it('shows the standing left against the cap of 16,000 + 500 per mastery rank', () => {
		appendDailyStanding(body, 'EntratiLabSyndicate');

		expect(body.textContent).toBe(`Daily standing left: ${(34_000).toLocaleString()} / ${(34_000).toLocaleString()}`);
	});

	it('shows 0 left when the allowance is used up', () => {
		appendDailyStanding(body, 'ZarimanSyndicate');

		expect(body.textContent).toContain(`left: 0 / ${(34_000).toLocaleString()}`);
	});

	it('says when it resets, as a local time of day rather than 00:00 UTC', () => {
		appendDailyStanding(body, 'EntratiLabSyndicate');

		const tooltip = body.querySelector<HTMLElement>('p')?.dataset.bsTitle;
		expect(tooltip).toMatch(/Resets daily at \d{1,2}:\d{2}/u);
		expect(tooltip).not.toContain('00:00');
	});

	it('mentions the shared pool for the relay syndicates', () => {
		appendDailyStanding(body, 'PerrinSyndicate');

		expect(body.querySelector<HTMLElement>('p')?.dataset.bsTitle).toContain('six relay syndicates');
	});

	it('adds nothing for a syndicate without a daily limit', () => {
		appendDailyStanding(body, 'EventSyndicate');

		expect(body.children).toHaveLength(0);
	});

	it('adds nothing when the profile field is missing', () => {
		delete window.profile.Results[0].DailyAffiliationCavia;
		appendDailyStanding(body, 'EntratiLabSyndicate');

		expect(body.children).toHaveLength(0);
	});

	it('adds nothing when the profile was not fetched today', () => {
		localStorage.setItem(PROFILE_TIMESTAMP_STORAGE_KEY, String(Date.now() - (2 * 24 * 60 * 60 * 1000)));
		appendDailyStanding(body, 'EntratiLabSyndicate');

		expect(body.children).toHaveLength(0);
	});
});
