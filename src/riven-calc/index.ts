/**
 Riven calculator page logic: shows the range of values that each trait of a Riven can roll, and grades
 the values of a Riven you own. The maths lives in ./formula.ts; this file is the DOM glue.
 */
import {RIVEN_CLASSES} from './data.js';
import {
	clampRank,
	computeValue,
	getDisplayRange,
	getDisplayStep,
	getRollFromDisplayValue,
	gradeDisplayValue,
	normalizeLayout,
	toDisplayValue,
	type TraitContext,
	type TraitKind,
} from './formula.js';
import {groupStats} from './groups.js';
import {
	createDefaultState,
	parseHash,
	serializeState,
	type CalcState,
} from './state.js';
import {getRivenStats, type StatDef} from './stats.js';
import {buildWeaponOptions, canWeaponRollStat, type WeaponOption} from './weapons.js';

export type CalcData = {
	dict: Record<string, string>;
	exportWeapons: Record<string, any>;
	exportUpgrades: Record<string, any>;
	exportTextIcons: Record<string, any>;
};

const VALUE_PLACEHOLDER = /\|(?:val|STAT1)\|/gu;
// The placeholder along with its unit and the space after it. The `\s*` before the % is for languages that put a
// space there ("|val| % Hitzeschaden" in German, "|val| % de zoom" in Spanish); without it, the % would stay behind
// in the label, since the number it belonged to is shown by the slider instead.
const VALUE_WITH_UNIT = /\|(?:val|STAT1)\|(?:\s*%|s\b)?\s*/gu;
const TEXT_ICON = /<(?<name>[^<>]+)>/gu;

/**
 Turns a display template such as "|val|% <DT_FIRE_COLOR>Heat" into DOM that names the stat ("Heat"), dropping the
 number, which the slider shows, and replacing the text icons with images.
 */
export function buildStatLabel(template: string, exportTextIcons: Record<string, any>): DocumentFragment {
	const fragment = document.createDocumentFragment();
	const text = template.replaceAll(VALUE_WITH_UNIT, '').trim();
	let lastIndex = 0;
	for (const match of text.matchAll(TEXT_ICON)) {
		fragment.append(text.slice(lastIndex, match.index));
		const iconUrl: string | undefined = exportTextIcons[match.groups!.name]?.DIT_AUTO;
		if (iconUrl) {
			const icon = document.createElement('img');
			icon.className = 'riven-text-icon';
			icon.alt = match[0];
			// The icons are 64x64 pixels. Declaring that lets the browser keep a square box for the icon (at the height
			// the CSS sets) before the image arrives, so the label does not shift when it loads.
			icon.width = 64;
			icon.height = 64;
			icon.src = 'https://browse.wf' + iconUrl;
			fragment.append(icon);
		} else {
			fragment.append(match[0]);
		}

		lastIndex = match.index + match[0].length;
	}

	fragment.append(text.slice(lastIndex));
	return fragment;
}

/**
The stat's name without its number, e.g. "Critical Chance" for "|val|% Critical Chance".
*/
export function getStatName(template: string): string {
	return template
		.replaceAll(TEXT_ICON, '')
		.replaceAll(VALUE_PLACEHOLDER, '')
		.replace(/^\s*(?:%|s\b)?\s*/u, '')
		.trim();
}

export type RowContext = {
	stat: StatDef;
	kind: TraitKind;
	state: CalcState;
	data: CalcData;
	/**
	Where each graded trait sits in its range (0 to 1), by trait, so that it can be kept when the range changes.
	*/
	rolls: Map<string, number>;
};

function createStatRow({
	stat, kind, state, data, rolls,
}: RowContext): HTMLElement {
	// A stat the dictionary does not name still shows its range, under its tag
	const template = data.dict[stat.labelKey] ?? `|val| ${stat.tag}`;
	const trait: TraitContext = {rank: state.rank, layout: state.layout, kind};
	const range = getDisplayRange(stat, trait);

	const row = document.createElement('div');
	row.className = 'riven-stat';
	row.dataset.statTag = stat.tag;
	row.dataset.statKind = kind;

	const label = document.createElement('span');
	label.className = 'riven-stat-label';
	label.append(buildStatLabel(template, data.exportTextIcons));
	row.append(label);

	// A trait that cannot be rolled (such as Heat as a negative trait, or Slash on a weapon that deals no Slash damage)
	// stays in place, greyed out, so that the positive and negative lists line up
	const weaponData = state.weapon ? data.exportWeapons[state.weapon.uniqueName] : undefined;
	let unavailableNote: string | undefined;
	if (!(kind === 'buff' ? stat.canBeBuff : stat.canBeCurse)) {
		unavailableNote = kind === 'buff' ? 'Negative only' : 'Positive only';
	} else if (!canWeaponRollStat(weaponData, stat.tag, kind === 'buff')) {
		// Only a picked weapon can make a trait unrollable
		unavailableNote = `Unrollable for ${state.weapon!.label}`;
	}

	if (unavailableNote) {
		row.classList.add('riven-stat-unavailable');
		const note = document.createElement('span');
		note.className = 'riven-stat-unavailable-note';
		note.textContent = unavailableNote;
		row.append(note);
		return row;
	}

	const statName = getStatName(template);

	// The slider spans the values the trait can roll, with its lowest and highest numbers just above its ends. The box
	// beside it takes any value you read off your Riven.
	const sliderMin = Math.min(range.min, range.max);
	const sliderMax = Math.max(range.min, range.max);

	const sliderGroup = document.createElement('div');
	sliderGroup.className = 'riven-grade-slider-group';

	const bounds = document.createElement('div');
	bounds.className = 'riven-grade-bounds';
	bounds.setAttribute('aria-hidden', 'true');
	for (const bound of [sliderMin, sliderMax]) {
		const boundElement = document.createElement('span');
		boundElement.textContent = String(bound);
		bounds.append(boundElement);
	}

	const slider = document.createElement('input');
	slider.type = 'range';
	slider.className = 'form-range riven-grade-slider';
	slider.min = String(sliderMin);
	slider.max = String(sliderMax);
	slider.step = String(getDisplayStep(stat));
	slider.value = String((range.min + range.max) / 2);
	// The browser snaps the middle to the slider's step, so remember where it landed
	const sliderMiddle = slider.value;
	slider.setAttribute('aria-label', `Your Riven's ${statName} value (slider)`);
	sliderGroup.append(bounds, slider);
	row.append(sliderGroup);

	const input = document.createElement('input');
	input.type = 'number';
	// The same limits and step as the slider. The box starts at the slider's middle, so the spinner arrows step from
	// there; it is not graded until something is entered (see the listeners below).
	input.min = slider.min;
	input.max = slider.max;
	input.step = slider.step;
	input.value = sliderMiddle;
	input.className = 'form-control form-control-sm riven-grade-input';
	// Shows the middle again if the box is emptied
	input.placeholder = sliderMiddle;
	input.setAttribute('aria-label', `Your Riven's ${statName} value`);
	row.append(input);

	const reset = document.createElement('button');
	reset.type = 'button';
	// Nothing to reset until the slider is moved or a value is entered
	reset.disabled = true;
	reset.className = 'btn btn-sm btn-outline-secondary riven-grade-reset';
	reset.title = 'Reset this trait';
	reset.setAttribute('aria-label', `Reset ${statName}`);
	const resetIcon = document.createElement('i');
	resetIcon.className = 'bi bi-arrow-counterclockwise';
	reset.append(resetIcon);
	row.append(reset);

	const result = document.createElement('span');
	result.className = 'riven-grade-result';
	result.setAttribute('aria-live', 'polite');
	row.append(result);

	const showGrade = (value: number): void => {
		if (Number.isNaN(value)) {
			result.replaceChildren();
			return;
		}

		const {factor, grade} = gradeDisplayValue(stat, trait, value);
		// The letter's colour comes from its data-grade (see riven-calc.css)
		const letter = document.createElement('span');
		letter.className = 'riven-grade-letter';
		letter.dataset.grade = grade;
		letter.textContent = grade;
		result.replaceChildren(`${factor.toFixed(2)}x = `, letter);
	};

	// Remembers where the value sits in the range, so that a change of rank or layout can move it along with the range
	const rollKey = `${kind}:${stat.tag}`;
	const enter = (value: number): void => {
		if (Number.isNaN(value)) {
			rolls.delete(rollKey);
		} else {
			rolls.set(rollKey, getRollFromDisplayValue(stat, trait, value));
		}

		showGrade(value);
	};

	slider.addEventListener('input', () => {
		reset.disabled = false;
		input.value = slider.value;
		enter(slider.valueAsNumber);
	});

	reset.addEventListener('click', () => {
		slider.value = sliderMiddle;
		input.value = sliderMiddle;
		enter(NaN);
		reset.disabled = true;
	});

	// Typing replaces the middle value instead of being appended to it
	input.addEventListener('focus', () => {
		input.select();
	});

	input.addEventListener('input', () => {
		// A value outside what the trait can roll pins the slider to its end; the grade still reflects the typed value
		if (!Number.isNaN(input.valueAsNumber)) {
			reset.disabled = false;
			slider.value = input.value;
		}

		enter(input.valueAsNumber);
	});

	// A value entered before the range changed keeps its place on the slider, and so its grade
	const remembered = rolls.get(rollKey);
	if (remembered !== undefined) {
		const value = toDisplayValue(stat, computeValue(stat, trait, remembered));
		slider.value = String(value);
		input.value = String(value);
		reset.disabled = false;
		showGrade(value);
	}

	return row;
}

function getElement<T extends HTMLElement>(root: ParentNode, selector: string): T {
	const element = root.querySelector<T>(selector);
	if (!element) {
		throw new Error(`Riven calculator markup is missing ${selector}`);
	}

	return element;
}

export type RivenCalc = {
	getState: () => CalcState;
	/**
	Re-reads the dictionary (after a language change) and redraws.
	*/
	setDict: (dict: Record<string, string>) => void;
};

export function initRivenCalc(data: CalcData, root: ParentNode = document): RivenCalc {
	const weaponInput = getElement<HTMLInputElement>(root, '#weapon-name');
	const weaponList = getElement<HTMLDataListElement>(root, '#weapons-datalist');
	const classSelect = getElement<HTMLSelectElement>(root, '#riven-class');
	const rankInput = getElement<HTMLInputElement>(root, '#rank');
	const buffsInput = getElement<HTMLInputElement>(root, '#positive-traits');
	const cursesInput = getElement<HTMLInputElement>(root, '#negative-traits');
	const buffsBody = getElement(root, '[data-riven-section="buffs"]');
	const splicedBody = getElement(root, '[data-riven-section="spliced"]');
	const cursesBody = getElement(root, '[data-riven-section="curses"]');
	const splicedCard = getElement(root, '[data-riven-card="spliced"]');
	const cursesCard = getElement(root, '[data-riven-card="curses"]');

	let weapons: WeaponOption[] = [];
	let state = createDefaultState();
	// The graded values, for the traits of the Riven being looked at (see createStatRow)
	const rolls = new Map<string, number>();

	const fillWeaponList = (): void => {
		weapons = buildWeaponOptions(data.exportWeapons, data.exportUpgrades, data.dict);
		// Variants are left out of the suggestions: they take the same Riven as their base weapon
		weaponList.replaceChildren(...weapons.filter(weapon => !weapon.isVariant).map(weapon => {
			const option = document.createElement('option');
			option.value = weapon.label;
			return option;
		}));
	};

	// The - and + buttons beside the number boxes, which step them
	const stepButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-riven-step]')].map(button => ({
		button,
		input: getElement<HTMLInputElement>(button.parentElement!, 'input'),
		step: button.dataset.rivenStep === '1' ? 1 : -1,
	}));

	// A button has nothing to do once its box is at the end of its range
	const syncStepButtons = (): void => {
		for (const {button, input, step} of stepButtons) {
			button.disabled = step > 0 ? input.valueAsNumber >= Number(input.max) : input.valueAsNumber <= Number(input.min);
		}
	};

	const syncControls = (): void => {
		weaponInput.value = state.weapon?.label ?? '';
		classSelect.value = state.rivenClassKey;
		rankInput.value = String(state.rank);
		buffsInput.value = String(state.layout.buffs);
		cursesInput.value = String(state.layout.curses);
		syncStepButtons();
	};

	const render = (): void => {
		const stats = getRivenStats(state.rivenClassKey, data.exportUpgrades);

		// One block of rows per group, so that related traits sit together and the groups are set apart
		const buildGroups = (kind: TraitKind, isSpliced: boolean): HTMLElement[] => groupStats(stats.filter(stat => stat.spliced === isSpliced)).map(group => {
			const element = document.createElement('div');
			element.className = 'riven-group';
			element.dataset.rivenGroup = group.id;
			element.setAttribute('role', 'group');
			element.setAttribute('aria-label', group.label);
			element.append(...group.stats.map(stat => createStatRow({
				stat, kind, state, data, rolls,
			})));
			return element;
		});

		const splicedGroups = buildGroups('buff', true);

		buffsBody.replaceChildren(...buildGroups('buff', false));
		splicedBody.replaceChildren(...splicedGroups);
		cursesBody.replaceChildren(...(state.layout.curses > 0 ? buildGroups('curse', false) : []));

		buffsBody.removeAttribute('aria-busy');
		cursesBody.removeAttribute('aria-busy');

		splicedCard.classList.toggle('d-none', splicedGroups.length === 0);
		cursesCard.classList.toggle('d-none', state.layout.curses === 0);
		syncResetAll();
	};

	// "Reset all" in a card heading is available while any trait in that card has a value to reset
	const resetAllButtons = root.querySelectorAll<HTMLButtonElement>('[data-riven-reset-all]');
	const syncResetAll = (): void => {
		for (const button of resetAllButtons) {
			button.disabled = !button.closest('[data-riven-card]')!.querySelector('.riven-grade-reset:not(:disabled)');
		}
	};

	const saveHash = (): void => {
		history.replaceState(null, '', '#' + serializeState(state));
	};

	const update = (): void => {
		render();
		saveHash();
	};

	for (const rivenClass of RIVEN_CLASSES) {
		const option = document.createElement('option');
		option.value = rivenClass.key;
		option.textContent = rivenClass.label;
		classSelect.append(option);
	}

	fillWeaponList();
	state = parseHash(location.hash, weapons);
	syncControls();
	render();

	for (const button of resetAllButtons) {
		const card = button.closest('[data-riven-card]')!;
		button.addEventListener('click', () => {
			for (const reset of card.querySelectorAll<HTMLButtonElement>('.riven-grade-reset:not(:disabled)')) {
				reset.click();
			}
		});
		// Events from the rows (and from the button itself) reach the card after they have been handled
		card.addEventListener('input', syncResetAll);
		card.addEventListener('click', syncResetAll);
	}

	const pickWeapon = (): void => {
		const weapon = weapons.find(candidate => candidate.label === weaponInput.value);
		// The change event that follows once the box loses focus finds the weapon already picked
		if (!weapon || weapon.uniqueName === state.weapon?.uniqueName) {
			return;
		}

		state.weapon = weapon;
		state.rivenClassKey = weapon.rivenClassKey;
		// A different weapon is a different Riven
		rolls.clear();
		syncControls();
		update();
	};

	weaponInput.addEventListener('change', pickWeapon);

	// Choosing a suggestion from the dropdown applies at once, rather than when the box loses focus. Typing does not
	// (the name of one weapon can be the start of another's), but the box still applies when it loses focus.
	weaponInput.addEventListener('input', event => {
		if (!(event instanceof InputEvent) || event.inputType === 'insertReplacementText') {
			pickWeapon();
		}
	});

	classSelect.addEventListener('change', () => {
		state.rivenClassKey = classSelect.value;
		// The picked weapon no longer matches the class
		delete state.weapon;
		rolls.clear();
		syncControls();
		update();
	});

	rankInput.addEventListener('change', () => {
		// An emptied box keeps the previous rank
		const rank = rankInput.valueAsNumber;
		if (!Number.isNaN(rank)) {
			state.rank = clampRank(rank);
		}

		syncControls();
		update();
	});

	// The buttons step the box, and apply the new value as a typed one would be
	for (const {button, input, step} of stepButtons) {
		button.addEventListener('click', () => {
			if (step > 0) {
				input.stepUp();
			} else {
				input.stepDown();
			}

			input.dispatchEvent(new Event('change', {bubbles: true}));
		});
		// Typing or the arrow keys can reach an end of the range too
		input.addEventListener('input', syncStepButtons);
	}

	const onLayoutChange = (): void => {
		// An emptied box keeps the previous count
		const buffs = buffsInput.valueAsNumber;
		const curses = cursesInput.valueAsNumber;
		state.layout = normalizeLayout(Number.isNaN(buffs) ? state.layout.buffs : buffs, Number.isNaN(curses) ? state.layout.curses : curses);
		syncControls();
		update();
	};

	buffsInput.addEventListener('change', onLayoutChange);
	cursesInput.addEventListener('change', onLayoutChange);

	return {
		getState: () => state,
		setDict(dict) {
			data.dict = dict;
			fillWeaponList();
			// Keep the picked weapon, but under its new (translated) name
			state.weapon &&= weapons.find(candidate => candidate.uniqueName === state.weapon!.uniqueName) ?? state.weapon;

			syncControls();
			render();
		},
	};
}
