/**
 * DOM rendering helpers for Deep Archimedea (CT_LAB) and Temporal Archimedea (CT_HEX).
 *
 * Data resolution (text lookups, tag remapping, difficulty selection) is handled by
 * archimedea/data.ts. This module is responsible only for turning resolved data into DOM.
 */
import { resolveArchimedea } from './data.js';
function tooltipElement(name, desc) {
    if (desc) {
        const abbr = document.createElement('abbr');
        abbr.textContent = name;
        abbr.dataset.bsToggle = 'tooltip';
        abbr.dataset.bsTitle = desc;
        void new window.bootstrap.Tooltip(abbr);
        return abbr;
    }
    return document.createTextNode(name);
}
/**
 * Renders a missions tbody from pre-resolved mission data.
 */
export function renderArchimedeaMissions(missions) {
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
export function renderArchimedeaFrameVariables(frameVariables) {
    const tr = document.createElement('tr');
    for (const fv of frameVariables) {
        const td = document.createElement('td');
        td.append(tooltipElement(fv.name, fv.desc));
        tr.append(td);
    }
    return tr;
}
/**
 * Renders Archimedea missions and frame variables as two tables into a container.
 * Clears the container first, disposing any existing Bootstrap tooltips.
 *
 * @param container        Element to render into
 * @param archimedea       The raw Archimedea object from worldState.Conquests[]
 * @param archimedeaType   "CT_LAB" or "CT_HEX"
 * @param variantKeyPrefix e.g. "/Lotus/Language/Conquest/MissionVariant_LabConquest_"
 */
export async function renderArchimedeaTable(container, archimedea, archimedeaType, variantKeyPrefix) {
    const [dict, osdict] = await Promise.all([getDictPromise(), getOSDictPromise()]);
    const { missions, frameVariables } = await resolveArchimedea(archimedea, archimedeaType, variantKeyPrefix, osdict, dict);
    for (const x of container.querySelectorAll('[data-bs-toggle=tooltip]')) {
        window.bootstrap.Tooltip.getInstance(x)?.dispose();
    }
    container.innerHTML = '';
    const missionsTable = document.createElement('table');
    missionsTable.className = 'table table-sm table-borderless table-hover mb-2';
    missionsTable.append(renderArchimedeaMissions(missions));
    container.append(missionsTable);
    const fvTable = document.createElement('table');
    fvTable.className = 'table table-sm table-borderless mb-0';
    fvTable.append(renderArchimedeaFrameVariables(frameVariables));
    container.append(fvTable);
}
window.renderArchimedeaTable = renderArchimedeaTable;
window.renderArchimedeaMissions = renderArchimedeaMissions;
window.renderArchimedeaFrameVariables = renderArchimedeaFrameVariables;
//# sourceMappingURL=helpers.js.map