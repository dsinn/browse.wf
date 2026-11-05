/**
 * Data transformation layer for Deep Archimedea (CT_LAB) and Temporal Archimedea (CT_HEX).
 * Usable in both browser and Node.js environments.
 *
 * Consumed by:
 *   - src/archimedea/helpers.ts             (browser DOM rendering, via globals)
 *   - scripts/post-weekly-forecast.js       (Node.js, via compiled archimedea/data.js)
 */
import { fetchExport } from '../public-export-fetcher.js';
import { toTitleCase } from '../helpers/string-helpers.js';
const CONQUEST_RISK_REMAP = { EMPBlackHole: 'MagneticHounds' };
const CONQUEST_VARIABLE_REMAP = { DullBlades: 'ComboCountChance', Undersupplied: 'MaxAmmo' };
const FRAME_VARIABLE_VALUE_MAP = { ShieldDelay: '500', TimeDilation: '50' };
function stripHtml(s) {
    return s.replaceAll(/<[^>]+>/gu, '').trim();
}
function camelToWords(s) {
    return s.replaceAll(/(?<=.)(?=[A-Z])/gu, ' ');
}
function findHardDifficulty(mission) {
    const hard = mission.difficulties?.find((d) => d.type === 'CD_HARD');
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
 * Resolves a raw Archimedea object into display-ready data.
 * Returns resolved mission rows and frame variable rows, with all text lookups applied.
 */
export async function resolveArchimedea(archimedea, archimedeaType, variantKeyPrefix, osdict, dict) {
    const exportMissionTypes = await fetchExport('ExportMissionTypes');
    const missions = [];
    for (const mission of archimedea.Missions) {
        const hardDiff = findHardDifficulty(mission);
        if (!hardDiff) {
            continue;
        }
        let type = exportMissionTypes[mission.missionType]?.name?.split('MissionName_')[1] ?? mission.missionType;
        if (archimedeaType === 'CT_LAB' && type === 'Defense') {
            type = 'DualDefense';
        }
        const rawTypeName = toTitleCase(dict['/Lotus/Language/Missions/MissionName_' + String(type)] ?? camelToWords(String(type)));
        const variantKey = variantKeyPrefix + String(hardDiff.deviation);
        const variantName = osdict[variantKey] ?? hardDiff.deviation;
        const variantDescRaw = osdict[variantKey + '_Desc'];
        const conditions = hardDiff.risks.slice(0, 2).map((r) => {
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
    const frameVariables = (archimedea.Variables ?? []).map((fv) => {
        const canonical = CONQUEST_VARIABLE_REMAP[fv] ?? fv;
        const key = '/Lotus/Language/Conquest/PersonalMod_' + canonical;
        const name = osdict[key] ?? fv;
        const descRaw = osdict[key + '_Desc'];
        let desc;
        if (descRaw) {
            const value = FRAME_VARIABLE_VALUE_MAP[fv];
            desc = stripHtml(descRaw).replaceAll('|val|', value ?? '');
        }
        return { name, desc };
    });
    return { missions, frameVariables };
}
// Expose globals for browser classic scripts; guard allows this file to run in Node.js too
if (globalThis.window !== undefined) {
    window.resolveArchimedea = resolveArchimedea;
}
//# sourceMappingURL=data.js.map