import { isFilterEnabled } from '../card-filters.js';
import { fetchExport } from '../public-export-fetcher.js';
export async function updateIncursionsLocalised() {
    const [[dict, osdict], ExportRegions, ExportFactions] = await Promise.all([
        Promise.all([window.getDictPromise(), window.getOSDictPromise()]),
        fetchExport('ExportRegions'),
        fetchExport('ExportFactions'),
    ]);
    window.setDatum('incursions-header', window.toTitleCase(osdict['/Lotus/Language/Labels/SteelPathDailies']), window.incursions_expiry);
    const elms = document.querySelectorAll('#incursions-body span.d-block');
    let visibleCount = 0;
    for (let i = 0; i !== elms.length; ++i) {
        const node = ExportRegions[window.incursions_today[i]];
        // Check if this mission type should be displayed (filter check)
        const filterKey = node.missionName.replace('/Lotus/Language/Missions/MissionName_', '');
        const isVisible = isFilterEnabled('incursions', filterKey);
        if (isVisible) {
            elms[i].classList.remove('d-none');
            elms[i].innerHTML = '';
            const b = document.createElement('b');
            b.textContent = window.toTitleCase(dict[node.missionName]);
            if (node.systemIndex !== 21) {
                b.textContent += ` - ${window.toTitleCase(dict[ExportFactions[node.faction].name])}`;
            }
            elms[i].append(b);
            elms[i].append(document.createTextNode(` (${100 + node.minEnemyLevel}-${100 + node.maxEnemyLevel}) @ `));
            const locationAbbr = document.createElement('abbr');
            locationAbbr.textContent = `${dict[node.name]}, ${dict[node.systemName]}`;
            const incursionTileset = window.getTileset(node);
            const formattedIncursionTileset = window.formatTileset(incursionTileset);
            if (formattedIncursionTileset) {
                window.addTooltip(locationAbbr, formattedIncursionTileset);
            }
            elms[i].append(locationAbbr);
            visibleCount++;
        }
        else {
            elms[i].classList.add('d-none');
        }
    }
    // Show/hide empty message based on whether any items are visible
    const emptyMessage = document.querySelector('#incursions-empty-message');
    if (emptyMessage) {
        emptyMessage.classList.toggle('d-none', !(visibleCount === 0));
    }
}
window.updateIncursionsLocalised = updateIncursionsLocalised;
//# sourceMappingURL=incursions.js.map