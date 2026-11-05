import { addTooltip } from '../tooltip.js';
/** Creates a warning icon with a tooltip, for data that may be inaccurate. */
export function createDataWarning(id, message) {
    const span = document.createElement('span');
    span.id = id;
    span.className = 'data-warning ms-2 text-warning';
    span.innerHTML = '<i class="bi bi-exclamation-triangle-fill"></i>';
    addTooltip(span, message);
    return span;
}
//# sourceMappingURL=data-warning.js.map