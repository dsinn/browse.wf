import { DEFAULT_RIVEN_CLASS, RIVEN_CLASSES } from './data.js';
import { clampRank, MAX_RANK, normalizeLayout, } from './formula.js';
export function createDefaultState() {
    return {
        rivenClassKey: DEFAULT_RIVEN_CLASS,
        rank: MAX_RANK,
        layout: normalizeLayout(3, 1),
    };
}
/**
 A missing or empty parameter is NaN, which the clamping functions default, where Number() would give 0
 */
function numberParameter(parameters, name) {
    const value = parameters.get(name);
    return value === null || value === '' ? NaN : Number(value);
}
function isRivenClassKey(value) {
    return RIVEN_CLASSES.some(rivenClass => rivenClass.key === value);
}
/**
 Reads the state from a URL hash. The format is the one the original Riven calculator used
 (`#weapon=<name or class>&lvl=<rank>&buffs=<n>&curses=<n>`), so that old links keep working. Its
 `<class>:<disposition>` form for `weapon` is accepted too, with the disposition ignored.
 */
export function parseHash(hash, weapons) {
    const state = createDefaultState();
    const parameters = new URLSearchParams(hash.replace(/^#/u, ''));
    const weaponParameter = parameters.get('weapon');
    if (weaponParameter) {
        const [classPart] = weaponParameter.split(':', 1);
        const namedWeapon = weapons.find(weapon => weapon.label === weaponParameter);
        if (namedWeapon) {
            state.weapon = namedWeapon;
            state.rivenClassKey = namedWeapon.rivenClassKey;
        }
        else if (isRivenClassKey(classPart)) {
            state.rivenClassKey = classPart;
        }
    }
    if (parameters.has('lvl')) {
        state.rank = clampRank(numberParameter(parameters, 'lvl'));
    }
    if (parameters.has('buffs') || parameters.has('curses')) {
        state.layout = normalizeLayout(numberParameter(parameters, 'buffs'), numberParameter(parameters, 'curses'));
    }
    return state;
}
/**
The inverse of {@link parseHash}, without the leading "#".
*/
export function serializeState(state) {
    const parameters = new URLSearchParams({
        weapon: state.weapon?.label ?? state.rivenClassKey,
        lvl: String(state.rank),
        buffs: String(state.layout.buffs),
        curses: String(state.layout.curses),
    });
    return parameters.toString();
}
//# sourceMappingURL=state.js.map