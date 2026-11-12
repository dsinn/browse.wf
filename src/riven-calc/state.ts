import {DEFAULT_RIVEN_CLASS, RIVEN_CLASSES} from './data.js';
import {
	clampRank, MAX_RANK, normalizeLayout, type Layout,
} from './formula.js';
import {type WeaponOption} from './weapons.js';

export type CalcState = {
	rivenClassKey: string;
	/**
	The weapon picked in the weapon picker, if any.
	*/
	weapon?: WeaponOption;
	rank: number;
	layout: Layout;
};

export function createDefaultState(): CalcState {
	return {
		rivenClassKey: DEFAULT_RIVEN_CLASS,
		rank: MAX_RANK,
		layout: normalizeLayout(3, 1),
	};
}

function isRivenClassKey(value: string): boolean {
	return RIVEN_CLASSES.some(rivenClass => rivenClass.key === value);
}

/**
 * Reads the state from a URL hash. The format is the one the original Riven calculator used
 * (`#weapon=<name or class>&lvl=<rank>&buffs=<n>&curses=<n>`), so that old links keep working. Its
 * `<class>:<disposition>` form for `weapon` is accepted too, with the disposition ignored.
 */
export function parseHash(hash: string, weapons: readonly WeaponOption[]): CalcState {
	const state = createDefaultState();
	const parameters = new URLSearchParams(hash.replace(/^#/u, ''));

	const weaponParameter = parameters.get('weapon');
	if (weaponParameter) {
		const [classPart] = weaponParameter.split(':', 1);
		const namedWeapon = weapons.find(weapon => weapon.label === weaponParameter);
		if (namedWeapon) {
			state.weapon = namedWeapon;
			state.rivenClassKey = namedWeapon.rivenClassKey;
		} else if (isRivenClassKey(classPart)) {
			state.rivenClassKey = classPart;
		}
	}

	if (parameters.has('lvl')) {
		state.rank = clampRank(Number.parseInt(parameters.get('lvl')!, 10));
	}

	if (parameters.has('buffs') || parameters.has('curses')) {
		state.layout = normalizeLayout(
			Number.parseInt(parameters.get('buffs') ?? '', 10),
			Number.parseInt(parameters.get('curses') ?? '', 10),
		);
	}

	return state;
}

/**
The inverse of {@link parseHash}, without the leading "#".
*/
export function serializeState(state: CalcState): string {
	const parameters = new URLSearchParams({
		weapon: state.weapon?.label ?? state.rivenClassKey,
		lvl: String(state.rank),
		buffs: String(state.layout.buffs),
		curses: String(state.layout.curses),
	});
	return parameters.toString();
}
