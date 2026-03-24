import {isFilterEnabled} from '../card-filters.js';

const STALE_DATA_RETRY_MS = 5000;

let weeklyExpiry = 0;

export function updateWeekly(): void {
	if (!(globalThis as any).worldState?.Conquests) {
		console.error('worldState.Conquests not available for updateWeekly');
		setTimeout(updateWeekly, STALE_DATA_RETRY_MS);
		return;
	}

	Promise.all([(globalThis as any).dicts_promise, (globalThis as any).ExportMissionTypes_promise]).then(async () => {
		const labConquest = (globalThis as any).worldState.Conquests.find((c: any) => c.Type === 'CT_LAB');
		const hexConquest = (globalThis as any).worldState.Conquests.find((c: any) => c.Type === 'CT_HEX');

		let newWeeklyExpiry: number;
		if (labConquest) {
			newWeeklyExpiry = Number.parseInt(labConquest.Expiry.$date.$numberLong, 10);
		} else if (hexConquest) {
			newWeeklyExpiry = Number.parseInt(hexConquest.Expiry.$date.$numberLong, 10);
		} else {
			const EPOCH = 1_736_121_600 * 1000;
			const week = Math.trunc((Date.now() - EPOCH) / 604_800_000);
			newWeeklyExpiry = EPOCH + ((week + 1) * 604_800_000);
		}

		if (newWeeklyExpiry <= Date.now()) {
			setTimeout(updateWeekly, STALE_DATA_RETRY_MS);
			return;
		}

		if (weeklyExpiry) {
			const subscribed = [];
			if (localStorage.getItem('live.notif.litesortie')) {
				subscribed.push('Archon Hunt');
			}

			if (localStorage.getItem('live.notif.teshin')) {
				subscribed.push('Vendors');
			}

			if (localStorage.getItem('live.notif.circuit')) {
				subscribed.push('Weekly Missions');
			}

			if (localStorage.getItem('live.notif.labconquest')) {
				subscribed.push('Deep Archimedea');
			}

			if (localStorage.getItem('live.notif.hexconquest')) {
				subscribed.push('Temporal Archimedea');
			}

			if (subscribed.length > 0) {
				(globalThis as any).sendNotification('It\'s a new week. ' + subscribed.join(', ') + ' refreshed.');
			}
		}

		weeklyExpiry = newWeeklyExpiry;

		const osdict = await (globalThis as any).getOSDictPromise() as Record<string, string>;

		if (labConquest) {
			(globalThis as any).setDatum('labConquest-header', osdict['/Lotus/Language/Conquest/SolarMapLabConquestNode'], weeklyExpiry);
			document.querySelector('#labConquest-header')!.innerHTML += ' ';
			document.querySelector('#labConquest-header')!.append((globalThis as any).createCompletionToggle('labconquest-' + weeklyExpiry));
			await (globalThis as any).renderArchimedeaTable(
				document.querySelector('#labConquest-body'),
				labConquest,
				'CT_LAB',
				'/Lotus/Language/Conquest/MissionVariant_LabConquest_',
			);
		}

		if (hexConquest) {
			(globalThis as any).setDatum('hexConquest-header', osdict['/Lotus/Language/1999Echoes/1999HexConquestNode'], weeklyExpiry);
			document.querySelector('#hexConquest-header')!.innerHTML += ' ';
			document.querySelector('#hexConquest-header')!.append((globalThis as any).createCompletionToggle('hexconquest-' + weeklyExpiry));
			await (globalThis as any).renderArchimedeaTable(
				document.querySelector('#hexConquest-body'),
				hexConquest,
				'CT_HEX',
				'/Lotus/Language/Conquest/MissionVariant_HexConquest_',
			);
		}

		setTimeout(updateWeekly, newWeeklyExpiry - Date.now());
	}).catch((error: unknown) => {
		console.error(error);
		setTimeout(updateWeekly, STALE_DATA_RETRY_MS);
	});
}

export function filterWeeklyMissions() {
	const weeklyMissionsCard = document.querySelector('[data-collapse-toggle="weekly-missions"]')?.closest('.card');
	if (weeklyMissionsCard) {
		const entries = weeklyMissionsCard.querySelectorAll('[data-mission]');
		let visibleCount = 0;

		for (const entry of entries) {
			const {mission} = (entry as HTMLElement).dataset;
			const isVisible = isFilterEnabled('weekly-missions', mission ?? '');
			(entry as HTMLElement).style.display = isVisible ? '' : 'none';
			if (isVisible) {
				visibleCount++;
			}
		}

		const emptyMessage = document.querySelector('#weekly-missions-empty-state');
		if (emptyMessage) {
			emptyMessage.classList.toggle('d-none', visibleCount > 0);
		}
	}
}

(globalThis as any).updateWeekly = updateWeekly;
(globalThis as any).filterWeeklyMissions = filterWeeklyMissions;
