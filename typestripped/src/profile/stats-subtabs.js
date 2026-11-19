/**
 Sub-navigation for the profile Stats tab (Overview, Equipment, Enemies, Abilities, Races).

 Panels carry the `stats-panel` class and an id of `stats-<name>`; the nav links carry `data-subtab="<name>"`.
 The selected sub-tab is mirrored to the URL hash as `sub=<name>` (alongside `tab=stats`) for deep links.
 */
export const STATS_SUBTABS = ['overview', 'equipment', 'enemies', 'abilities', 'races'];
const DEFAULT_SUBTAB = 'overview';
export function activateStatsSubtab(id) {
    const target = STATS_SUBTABS.includes(id) ? id : DEFAULT_SUBTAB;
    for (const link of document.querySelectorAll('[data-subtab]')) {
        link.classList.toggle('active', link.dataset.subtab === target);
    }
    for (const panel of document.querySelectorAll('.stats-panel')) {
        panel.classList.toggle('d-none', panel.id !== `stats-${target}`);
    }
}
/**
 Binds the sub-nav click handler (once) and applies the sub-tab requested by the URL, if any.
 */
export function initStatsSubtabs(parameters) {
    const nav = document.querySelector('#stats-subnav');
    if (!nav || nav.dataset.bound) {
        return;
    }
    nav.dataset.bound = 'true';
    nav.addEventListener('click', event => {
        const link = event.target.closest('[data-subtab]');
        if (!link) {
            return;
        }
        event.preventDefault();
        activateStatsSubtab(link.dataset.subtab);
        if (!('profile' in window)) {
            return;
        }
        const hashParameters = new URLSearchParams(location.hash.replace('#', ''));
        hashParameters.set('tab', 'stats');
        hashParameters.set('sub', link.dataset.subtab);
        location.hash = hashParameters.toString();
    });
    activateStatsSubtab(parameters?.get('sub') ?? DEFAULT_SUBTAB);
}
//# sourceMappingURL=stats-subtabs.js.map