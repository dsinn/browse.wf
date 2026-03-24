import {isFilterEnabled} from '../card-filters.js';
import {fetchExport} from '../public-export-fetcher.js';
import {canonicalizeMissionType} from '../helpers/mission-helpers.js';

export async function updateIncursionsLocalised() {
	const [[dict, osdict], ExportRegions, ExportFactions] = await Promise.all([
		Promise.all([(globalThis as any).getDictPromise(), (globalThis as any).getOSDictPromise()]),
		fetchExport('ExportRegions'),
		fetchExport('ExportFactions'),
	]);

	(globalThis as any).setDatum('incursions-header', (globalThis as any).toTitleCase(osdict['/Lotus/Language/Labels/SteelPathDailies']), (globalThis as any).incursions_expiry);

	const elms = document.querySelectorAll('#incursions-body span.d-block');
	let visibleCount = 0;
	for (let i = 0; i !== elms.length; ++i) {
		const node = ExportRegions[(globalThis as any).incursions_today[i]];

		// Check if this mission type should be displayed (filter check)
		const isVisible = isFilterEnabled('incursions', canonicalizeMissionType(node.missionType));

		if (isVisible) {
			(elms[i] as HTMLElement).classList.remove('d-none');
			elms[i].innerHTML = '';
			const b = document.createElement('b');
			b.textContent = (globalThis as any).toTitleCase(dict[node.missionName]);
			if (node.systemIndex !== 21) {
				b.textContent += ` - ${(globalThis as any).toTitleCase(dict[ExportFactions[node.faction].name]) as string}`;
			}

			elms[i].append(b);
			elms[i].append(document.createTextNode(` (${100 + (node.minEnemyLevel as number)}-${100 + (node.maxEnemyLevel as number)}) @ `));
			const locationAbbr = document.createElement('abbr');
			locationAbbr.textContent = `${dict[node.name]}, ${dict[node.systemName]}`;
			const incursionTileset = (globalThis as any).getTileset(node);
			const formattedIncursionTileset = (globalThis as any).formatTileset(incursionTileset);
			if (formattedIncursionTileset) {
				(globalThis as any).addTooltip(locationAbbr, formattedIncursionTileset);
			}

			elms[i].append(locationAbbr);
			visibleCount++;
		} else {
			(elms[i] as HTMLElement).classList.add('d-none');
		}
	}

	// Show/hide empty message based on whether any items are visible
	const emptyMessage = document.querySelector('#incursions-empty-message');
	if (emptyMessage) {
		emptyMessage.classList.toggle('d-none', !(visibleCount === 0));
	}
}

(globalThis as any).updateIncursionsLocalised = updateIncursionsLocalised;
