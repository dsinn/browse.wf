/**
 * DOM rendering helpers for Deep Archimedea (CT_LAB) and Temporal Archimedea (CT_HEX).
 *
 * Data resolution (text lookups, tag remapping, difficulty selection) is handled by
 * archimedea-data.ts. This module is responsible only for turning resolved data into DOM.
 */

import {resolveConquest, type IResolvedConquestMission, type IResolvedFrameVariable} from './archimedea-data.js';

declare function getDictPromise(): Promise<Record<string, string>>;
declare function getOSDictPromise(): Promise<Record<string, string>>;

function tooltipElement(name: string, desc: string | undefined): HTMLElement | Text {
	if (desc) {
		const abbr = document.createElement('abbr');
		abbr.textContent = name;
		abbr.dataset.bsToggle = 'tooltip';
		abbr.dataset.bsTitle = desc;
		void new globalThis.bootstrap.Tooltip(abbr);
		return abbr;
	}

	return document.createTextNode(name);
}

/**
 * Renders a missions tbody from pre-resolved mission data.
 */
export function renderConquestMissions(missions: IResolvedConquestMission[]): HTMLTableSectionElement {
	const tbody = document.createElement('tbody');
	for (const mission of missions) {
		const tr = document.createElement('tr');

		const th = document.createElement('th');
		th.textContent = mission.type;
		tr.append(th);

		const variantTd = document.createElement('td');
		variantTd.append(tooltipElement(mission.variant, mission.variantDesc));
		tr.append(variantTd);

		for (const cond of mission.conditions) {
			const td = document.createElement('td');
			td.append(tooltipElement(cond.name, cond.desc));
			tr.append(td);
		}

		tbody.append(tr);
	}

	return tbody;
}

/**
 * Renders a frame variables row from pre-resolved frame variable data.
 */
export function renderConquestFrameVariables(frameVariables: IResolvedFrameVariable[]): HTMLTableRowElement {
	const tr = document.createElement('tr');
	for (const fv of frameVariables) {
		const td = document.createElement('td');
		td.append(tooltipElement(fv.name, fv.desc));
		tr.append(td);
	}

	return tr;
}

/**
 * Renders conquest missions and frame variables as two tables into a container.
 * Clears the container first, disposing any existing Bootstrap tooltips.
 *
 * @param container        Element to render into
 * @param conquest         The raw conquest object from worldState.Conquests[]
 * @param conquestType     "CT_LAB" or "CT_HEX"
 * @param variantKeyPrefix e.g. "/Lotus/Language/Conquest/MissionVariant_LabConquest_"
 */
export async function renderConquestTable(
	container: HTMLElement,
	conquest: any,
	conquestType: string,
	variantKeyPrefix: string,
): Promise<void> {
	const [dict, osdict] = await Promise.all([getDictPromise(), getOSDictPromise()]);
	const {missions, frameVariables} = await resolveConquest(conquest, conquestType, variantKeyPrefix, osdict, dict);

	for (const x of container.querySelectorAll('[data-bs-toggle=tooltip]')) {
		globalThis.bootstrap.Tooltip.getInstance(x)?.dispose();
	}

	container.innerHTML = '';

	const missionsTable = document.createElement('table');
	missionsTable.className = 'table table-sm table-borderless table-hover mb-2';
	missionsTable.append(renderConquestMissions(missions));
	container.append(missionsTable);

	const fvTable = document.createElement('table');
	fvTable.className = 'table table-sm table-borderless mb-0';
	fvTable.append(renderConquestFrameVariables(frameVariables));
	container.append(fvTable);
}

// Expose globally for use by live.ts and other non-module scripts
(globalThis as any).renderConquestTable = renderConquestTable;
(globalThis as any).renderConquestMissions = renderConquestMissions;
(globalThis as any).renderConquestFrameVariables = renderConquestFrameVariables;
