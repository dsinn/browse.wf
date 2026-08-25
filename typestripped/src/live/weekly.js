import { getNextWeeklyResetMs } from '../helpers/time-helpers.js';
import { isFilterEnabled } from '../card-filters.js';
const STALE_DATA_RETRY_MS = 5000;
let weeklyExpiry = 0;
export function updateWeekly() {
    if (!window.worldState?.Conquests) {
        console.error('worldState.Conquests not available for updateWeekly');
        setTimeout(updateWeekly, STALE_DATA_RETRY_MS);
        return;
    }
    Promise.all([window.dicts_promise, window.ExportMissionTypes_promise]).then(async () => {
        const labConquest = window.worldState.Conquests.find((c) => c.Type === 'CT_LAB');
        const hexConquest = window.worldState.Conquests.find((c) => c.Type === 'CT_HEX');
        let newWeeklyExpiry;
        if (labConquest) {
            newWeeklyExpiry = Number.parseInt(labConquest.Expiry.$date.$numberLong, 10);
        }
        else if (hexConquest) {
            newWeeklyExpiry = Number.parseInt(hexConquest.Expiry.$date.$numberLong, 10);
        }
        else {
            newWeeklyExpiry = getNextWeeklyResetMs();
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
                window.sendNotification('It\'s a new week. ' + subscribed.join(', ') + ' refreshed.');
            }
        }
        weeklyExpiry = newWeeklyExpiry;
        const osdict = await window.getOSDictPromise();
        if (labConquest) {
            window.setDatum('labConquest-header', osdict['/Lotus/Language/Conquest/SolarMapLabConquestNode'], weeklyExpiry);
            document.querySelector('#labConquest-header').innerHTML += ' ';
            document.querySelector('#labConquest-header').append(window.createCompletionToggle('labconquest-' + weeklyExpiry));
            await window.renderArchimedeaTable(document.querySelector('#labConquest-body'), labConquest, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_');
        }
        if (hexConquest) {
            window.setDatum('hexConquest-header', osdict['/Lotus/Language/1999Echoes/1999HexConquestNode'], weeklyExpiry);
            document.querySelector('#hexConquest-header').innerHTML += ' ';
            document.querySelector('#hexConquest-header').append(window.createCompletionToggle('hexconquest-' + weeklyExpiry));
            await window.renderArchimedeaTable(document.querySelector('#hexConquest-body'), hexConquest, 'CT_HEX', '/Lotus/Language/Conquest/MissionVariant_HexConquest_');
        }
        setTimeout(updateWeekly, newWeeklyExpiry - Date.now());
    }).catch((error) => {
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
            const { mission } = entry.dataset;
            const isVisible = isFilterEnabled('weekly-missions', mission ?? '');
            entry.style.display = isVisible ? '' : 'none';
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
window.updateWeekly = updateWeekly;
window.filterWeeklyMissions = filterWeeklyMissions;
//# sourceMappingURL=weekly.js.map