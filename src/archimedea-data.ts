/**
 * Data transformation layer for Deep Archimedea (CT_LAB) and Temporal Archimedea (CT_HEX).
 * Usable in both browser and Node.js environments.
 *
 * Consumed by:
 *   - src/archimedea.ts                (planned: browser DOM rendering, via globals)
 *   - scripts/post-weekly-forecast.js  (Node.js, via compiled archimedea-data.js)
 */

import {fetchExport} from './public-export-fetcher.js';
import {toTitleCase} from './string-helpers.js';

const CONQUEST_RISK_REMAP: Record<string, string> = {EMPBlackHole: 'MagneticHounds'};
const CONQUEST_VARIABLE_REMAP: Record<string, string> = {DullBlades: 'ComboCountChance', Undersupplied: 'MaxAmmo'};
const FRAME_VARIABLE_VALUE_MAP: Record<string, string> = {ShieldDelay: '500', TimeDilation: '50'};

export type IResolvedConquestMission = {
	type: string; // Display-ready mission type, e.g. "Dual Defense"
	variant: string; // Display-ready variant name
	variantDesc: string | undefined; // Variant tooltip description, HTML stripped
	conditions: Array<{name: string; desc: string | undefined}>; // Up to 2 conditions
};

export type IResolvedFrameVariable = {
	name: string;
	desc: string | undefined;
};

export type IResolvedConquest = {
	missions: IResolvedConquestMission[];
	frameVariables: IResolvedFrameVariable[];
};

function stripHtml(s: string): string {
	return s.replaceAll(/<[^>]+>/gu, '').trim();
}

function camelToWords(s: string): string {
	return s.replaceAll(/(?<=.)(?=[A-Z])/gu, ' ');
}

function findHardDifficulty(mission: any): any {
	const hard = mission.difficulties?.find((d: any) => d.type === 'CD_HARD');
	if (hard) {
		return hard;
	}

	if (!mission.difficulties || mission.difficulties.length === 0) {
		return null;
	}

	let best = mission.difficulties[0];
	for (const d of mission.difficulties.slice(1)) {
		if (d.risks.length > best.risks.length) {
			best = d;
		}
	}

	return best;
}

/**
 * Resolves a raw Conquest object into display-ready data.
 * Returns resolved mission rows and frame variable rows, with all text lookups applied.
 */
export async function resolveConquest(
	conquest: any,
	conquestType: string,
	variantKeyPrefix: string,
	osdict: Record<string, string>,
	dict: Record<string, string>,
): Promise<IResolvedConquest> {
	const exportMissionTypes: Record<string, {name: string}> = await fetchExport('ExportMissionTypes');
	const missions: IResolvedConquestMission[] = [];

	for (const mission of conquest.Missions) {
		const hardDiff = findHardDifficulty(mission);
		if (!hardDiff) {
			continue;
		}

		let type = exportMissionTypes[mission.missionType]?.name?.split('MissionName_')[1] ?? mission.missionType;
		if (conquestType === 'CT_LAB' && type === 'Defense') {
			type = 'DualDefense';
		}

		const rawTypeName = toTitleCase(dict['/Lotus/Language/Missions/MissionName_' + String(type)] ?? camelToWords(String(type)));

		const variantKey = variantKeyPrefix + String(hardDiff.deviation);
		const variantName = osdict[variantKey] ?? hardDiff.deviation;
		const variantDescRaw = osdict[variantKey + '_Desc'];

		const conditions = hardDiff.risks.slice(0, 2).map((r: string) => {
			const canonical = CONQUEST_RISK_REMAP[r] ?? r;
			const condKey = '/Lotus/Language/Conquest/Condition_' + canonical;
			return {
				name: osdict[condKey] ?? r,
				desc: osdict[condKey + '_Desc'] ? stripHtml(osdict[condKey + '_Desc']) : undefined,
			};
		});

		missions.push({
			type: rawTypeName,
			variant: variantName,
			variantDesc: variantDescRaw ? stripHtml(variantDescRaw) : undefined,
			conditions,
		});
	}

	const frameVariables: IResolvedFrameVariable[] = (conquest.Variables ?? []).map((fv: string) => {
		const canonical = CONQUEST_VARIABLE_REMAP[fv] ?? fv;
		const key = '/Lotus/Language/Conquest/PersonalMod_' + canonical;
		const name = osdict[key] ?? fv;
		const descRaw = osdict[key + '_Desc'];
		let desc: string | undefined;
		if (descRaw) {
			const value = FRAME_VARIABLE_VALUE_MAP[fv];
			desc = stripHtml(descRaw).replaceAll('|val|', value ?? '');
		}

		return {name, desc};
	});

	return {missions, frameVariables};
}

// Expose globals for browser classic scripts; guard allows this file to run in Node.js too
if (globalThis.window !== undefined) {
	(globalThis as any).resolveConquest = resolveConquest;
}
