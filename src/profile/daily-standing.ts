/**
 Shows the remaining daily standing allowance on each Syndicates card.

 The profile stores the standing left today in `DailyAffiliation*` fields, one per "limit bin"; a syndicate's bin is
 given by `dailyLimitBin` in ExportSyndicates. The six relay syndicates share one bin. The daily cap is
 16,000 + 500 per mastery rank, and resets at 00:00 UTC (shown in local time), so the values are only shown for a profile fetched today.

 Called via (window as any).appendDailyStanding() from the syndicate card rendering in profile.ts.
 */

import {addTooltip} from '../tooltip.js';
import {describeDailyReset, isProfileFromToday} from './profile-freshness.js';

const BIN_PREFIX = 'STANDING_LIMIT_BIN_';
const BASE_DAILY_STANDING = 16_000;
const DAILY_STANDING_PER_RANK = 500;

/**
 Maps a limit bin to its profile field, e.g. STANDING_LIMIT_BIN_PVP -> DailyAffiliationPvp.
 The normal bin has no suffix. Returns undefined for syndicates without a daily limit.
 */
export function getDailyAffiliationField(bin: string | undefined): string | undefined {
	if (!bin?.startsWith(BIN_PREFIX) || bin === `${BIN_PREFIX}NONE`) {
		return undefined;
	}

	const suffix = bin.slice(BIN_PREFIX.length);
	return suffix === 'NORMAL' ? 'DailyAffiliation' : `DailyAffiliation${suffix.charAt(0)}${suffix.slice(1).toLowerCase()}`;
}

export function appendDailyStanding(body: HTMLElement, tag: string): void {
	if (!isProfileFromToday()) {
		return;
	}

	const result = window.profile?.Results?.[0];
	const bin = (window as any).ExportSyndicates?.[tag]?.dailyLimitBin;
	const field = getDailyAffiliationField(bin);
	const remaining = field ? result?.[field] : undefined;
	if (typeof remaining !== 'number') {
		return;
	}

	const cap = BASE_DAILY_STANDING + ((result.PlayerLevel ?? 0) * DAILY_STANDING_PER_RANK);
	const text = document.createElement('p');
	text.className = 'card-text small text-body-secondary mb-0';
	text.textContent = `Daily standing left: ${remaining.toLocaleString()} / ${cap.toLocaleString()}`;
	const sharedNote = bin === `${BIN_PREFIX}NORMAL` ? ' Shared by the six relay syndicates.' : '';
	addTooltip(text, `As of when the profile was fetched. ${describeDailyReset()}${sharedNote}`);
	body.append(text);
}

window.appendDailyStanding = appendDailyStanding;
