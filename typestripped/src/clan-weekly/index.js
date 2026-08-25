import { fetchExport } from '../public-export-fetcher.js';
import { getNextWeeklyResetMs } from '../helpers/time-helpers.js';
import { findClanWeeklyEntry, resolveBonusRegion, resolveClanWeeklyRewards } from './data.js';
function makeIcon(iconPath) {
    const img = document.createElement('img');
    img.style.height = '24px';
    img.style.width = '24px';
    img.style.objectFit = 'contain';
    img.alt = '';
    setImageSource(img, iconPath);
    return img;
}
export async function renderClanWeeklyPane(entry) {
    const dict = await getDictPromise();
    const container = document.createElement('div');
    const table = document.createElement('table');
    table.className = 'table table-sm table-borderless table-hover mb-0';
    const tbody = document.createElement('tbody');
    const rewards = await resolveClanWeeklyRewards(entry, dict);
    for (const reward of rewards) {
        const tr = document.createElement('tr');
        const pctTd = document.createElement('td');
        pctTd.className = 'text-muted';
        pctTd.style.width = '4rem';
        pctTd.textContent = `${reward.pct}%`;
        tr.append(pctTd);
        const rewardTd = document.createElement('td');
        const rewardSpan = document.createElement('span');
        rewardSpan.className = 'd-flex align-items-center gap-2';
        if (reward.iconPath) {
            rewardSpan.append(makeIcon(reward.iconPath));
        }
        const nameSpan = document.createElement('span');
        nameSpan.textContent = reward.display;
        rewardSpan.append(nameSpan);
        rewardTd.append(rewardSpan);
        tr.append(rewardTd);
        tbody.append(tr);
    }
    table.append(tbody);
    container.append(table);
    const regionName = resolveBonusRegion(entry.BonusRegion, dict);
    const regionP = document.createElement('p');
    regionP.className = 'mt-2 mb-0 text-muted small';
    regionP.append('Bonus region: ');
    const regionStrong = document.createElement('strong');
    regionStrong.textContent = regionName;
    regionP.append(regionStrong);
    container.append(regionP);
    return container;
}
export async function updateClanWeekly() {
    const entries = window.worldState?.WeeklyVaultBonusRewards ?? [];
    const entry = findClanWeeklyEntry(entries);
    if (!entry) {
        setTimeout(() => {
            void updateClanWeekly();
        }, 5000);
        return;
    }
    const expiryMs = getNextWeeklyResetMs();
    setTimeout(() => {
        void updateClanWeekly();
    }, expiryMs - Date.now());
    const expirySpan = document.querySelector('#clan-weekly-expiry');
    if (expirySpan) {
        expirySpan.innerHTML = '';
        expirySpan.append(createExpiryBadge(expiryMs));
    }
    const checksSpan = document.querySelector('#clan-weekly-checks');
    if (checksSpan) {
        checksSpan.innerHTML = '';
        checksSpan.append(createCompletionToggle(`clanweekly-${String(entry.WeekCount)}`));
    }
    window.ExportImages = await fetchExport('ExportImages');
    const body = document.querySelector('#clan-weekly-body');
    if (body) {
        body.innerHTML = '';
        body.append(await renderClanWeeklyPane(entry));
    }
}
window.updateClanWeekly = updateClanWeekly;
//# sourceMappingURL=index.js.map