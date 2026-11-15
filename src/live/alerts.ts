/**
 Alerts card helpers (fork-specific)
 */
import {makeArchwingIcon} from '../archwing-icon.js';
import {fetchExport} from '../public-export-fetcher.js';
import {addTooltip} from '../tooltip.js';

/**
 Joins an alert's reward names into one comma-delimited line.
 Credits always come last, regardless of how many other rewards there are.

 @param rewardNames - Display names of the non-credit rewards, in display order
 @param credits - The credit reward
 */
export function formatAlertRewards(rewardNames: string[], credits: number): string {
	return [...rewardNames, `${credits.toLocaleString()} Credits`].join(', ');
}

async function makeQuestLockIcon(questRequest: string): Promise<HTMLElement> {
	const title = `Requires quest: ${await window.getItemNamePromise!(questRequest)}`;
	const lock = document.createElement('span');
	lock.className = 'alert-quest-lock';
	lock.role = 'img';
	lock.ariaLabel = title;
	// U+FE0E (invisible) after the lock requests its monochrome text presentation
	lock.textContent = '🔒︎';
	addTooltip(lock, title);
	return lock;
}

/**
 Creates the icons shown after an alert's location for its mission requirements,
 each preceded by a space so they can be appended directly.

 @param missionInfo - The alert's mission details from worldState
 */
export async function makeAlertMissionIcons(missionInfo: any): Promise<Array<string | Node>> {
	const isArchwing = Boolean(missionInfo.archwingRequired || missionInfo.isSharkwingMission);
	if (isArchwing) {
		// The Archwing icon's image source is looked up in ExportImages
		window.ExportImages = await fetchExport('ExportImages');
	}

	const icons = [
		...(isArchwing ? [makeArchwingIcon('alert-archwing-icon')] : []),
		...(missionInfo.questReq ? [await makeQuestLockIcon(missionInfo.questReq)] : []),
	];
	return icons.flatMap(icon => [' ', icon]);
}

(window as any).formatAlertRewards = formatAlertRewards;
window.makeAlertMissionIcons = makeAlertMissionIcons;
