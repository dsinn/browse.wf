/**
 * Shared helper functions for Deep Archimedea (CT_LAB) and Temporal Archimedea (CT_HEX) rendering.
 *
 * These are used by both weekly-forecast.ts (via globals) to avoid duplicating logic.
 */

export function conquestRiskTagToLoc(tag: string): string {
	if (tag === 'EMPBlackHole') {
		return 'MagneticHounds';
	}

	return tag;
}

export function conquestVariableTagToLoc(tag: string): string {
	if (tag === 'DullBlades') {
		return 'ComboCountChance';
	}

	if (tag === 'Undersupplied') {
		return 'MaxAmmo';
	}

	return tag;
}

export function transformFrameVariable(desc: string, rawValue: string): string {
	desc = desc.replaceAll(/<[^>]+>/gu, '');
	if (rawValue === 'ShieldDelay') {
		return desc.split('|val|').join('500');
	}

	if (rawValue === 'TimeDilation') {
		return desc.split('|val|').join('50');
	}

	return desc;
}

/**
 * Creates a tooltip <abbr> element (or plain text node) for an osdict key.
 * @param keyPrefix  e.g. "/Lotus/Language/Conquest/MissionVariant_LabConquest_"
 * @param rawValue   e.g. "DA_UnityOfPurpose"
 * @param osdict     The OS dictionary (key → text)
 * @param descTransform  Optional transform for the tooltip description
 */
export function createArchimedeaTooltipElement(
	keyPrefix: string,
	rawValue: string,
	osdict: Record<string, string>,
	descTransform?: (desc: string, rawValue: string) => string,
): HTMLElement | Text {
	const key = keyPrefix + rawValue;
	const text = osdict[key];
	const desc = osdict[key + '_Desc'];
	if (text && desc) {
		const abbr = document.createElement('abbr');
		abbr.textContent = text;
		const finalDesc = descTransform ? descTransform(desc, rawValue) : desc;
		abbr.dataset.bsToggle = 'tooltip';
		abbr.dataset.bsTitle = finalDesc;
		void new globalThis.bootstrap.Tooltip(abbr);
		return abbr;
	}

	if (text) {
		if (!desc) {
			console.warn('Missing osdict key:', key + '_Desc');
		}

		return document.createTextNode(text);
	}

	console.warn('Missing osdict key:', key);
	return document.createTextNode(rawValue);
}

/**
 * Transforms a raw Conquest object's Missions array into IConquestMission[].
 * Equivalent to the inline transformMissions() in live.ts's updateWeekly().
 *
 * @param conquest         The raw conquest object from worldState.Conquests[]
 * @param conquestType     "CT_LAB" or "CT_HEX"
 * @param ExportMissionTypes  The ExportMissionTypes lookup table
 */
export function transformConquestMissions(
	conquest: any,
	conquestType: string,
	exportMissionTypes: Record<string, {name: string}>,
): IConquestMission[] {
	const missions: IConquestMission[] = [];
	for (const mission of conquest.Missions) {
		let hardDiff = mission.difficulties.find((d: any) => d.type === 'CD_HARD');
		if (!hardDiff) {
			for (const d of mission.difficulties) {
				if (!hardDiff || d.risks.length > hardDiff.risks.length) {
					hardDiff = d;
				}
			}
		}

		let type = exportMissionTypes[mission.missionType].name.split('MissionName_')[1];
		if (conquestType === 'CT_LAB' && type === 'Defense') {
			type = 'DualDefense';
		}

		missions.push({
			type,
			variant: hardDiff.deviation,
			conditions: hardDiff.risks,
		});
	}

	return missions;
}

/**
 * Renders a missions tbody for a conquest section.
 * @param missions     IConquestMission[] from transformConquestMissions()
 * @param variantKeyPrefix  e.g. "/Lotus/Language/Conquest/MissionVariant_LabConquest_"
 * @param osdict       The OS dictionary
 * @param dict         The main dictionary (for mission type names)
 */
export function renderConquestMissions(
	missions: IConquestMission[],
	variantKeyPrefix: string,
	osdict: Record<string, string>,
	dict: Record<string, string>,
): HTMLTableSectionElement {
	const tbody = document.createElement('tbody');
	for (const mission of missions) {
		const tr = document.createElement('tr');
		{
			const th = document.createElement('th');
			th.textContent = toTitleCase(dict['/Lotus/Language/Missions/MissionName_' + mission.type] ?? mission.type);
			tr.append(th);
		}

		{
			const td = document.createElement('td');
			td.append(createArchimedeaTooltipElement(variantKeyPrefix, mission.variant, osdict));
			tr.append(td);
		}

		for (let i = 0; i !== 2; ++i) {
			const td = document.createElement('td');
			const canonicalCondition = conquestRiskTagToLoc(mission.conditions[i]);
			td.append(createArchimedeaTooltipElement('/Lotus/Language/Conquest/Condition_', canonicalCondition, osdict));
			tr.append(td);
		}

		tbody.append(tr);
	}

	return tbody;
}

/**
 * Renders a frame variables row (a tr containing tds) for a conquest section.
 * @param frameVariables  string[] of variable tags (e.g. "ShieldDelay")
 * @param osdict          The OS dictionary
 */
export function renderConquestFrameVariables(
	frameVariables: string[],
	osdict: Record<string, string>,
): HTMLTableRowElement {
	const tr = document.createElement('tr');
	for (const fv of frameVariables) {
		const td = document.createElement('td');
		const canonicalPersonalMod = conquestVariableTagToLoc(fv);
		td.append(createArchimedeaTooltipElement(
			'/Lotus/Language/Conquest/PersonalMod_',
			canonicalPersonalMod,
			osdict,
			transformFrameVariable,
		));
		tr.append(td);
	}

	return tr;
}

// Expose globally for use by weekly-forecast.ts and other non-module scripts
(globalThis as any).conquestRiskTagToLoc = conquestRiskTagToLoc;
(globalThis as any).conquestVariableTagToLoc = conquestVariableTagToLoc;
(globalThis as any).transformFrameVariable = transformFrameVariable;
(globalThis as any).createArchimedeaTooltipElement = createArchimedeaTooltipElement;
(globalThis as any).transformConquestMissions = transformConquestMissions;
(globalThis as any).renderConquestMissions = renderConquestMissions;
(globalThis as any).renderConquestFrameVariables = renderConquestFrameVariables;
