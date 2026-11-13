/**
 Integration tests for src/riven-calc/index.ts: the real riven-calc.php markup (rendered to a fixture),
 real game data from warframe-public-export-plus, and the page's event handlers, in jsdom.

 The maths itself is covered by formula.test.ts; these check that the pieces are wired together. The
 end-to-end behaviour in a real browser is covered by e2e/riven-calc.spec.ts.
 */
import {
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
	vi,
} from 'vitest';
import {loadFixture} from '../../test/helpers/fixture-loader';
import {loadExportJson} from '../../test/helpers/api-mocks';
import {withTranslationFallback} from '../translation-fallback.js';
import {RIFLE, SHOTGUN} from './data.js';
import {getRivenStats} from './stats.js';
import {
	buildStatLabel,
	getStatName,
	initRivenCalc,
	type CalcData,
} from './index.js';

let data: CalcData;

beforeAll(() => {
	data = {
		dict: withTranslationFallback(loadExportJson('dict.en.json')),
		exportWeapons: loadExportJson('ExportWeapons.json'),
		exportUpgrades: loadExportJson('ExportUpgrades.json'),
		exportTextIcons: loadExportJson('ExportTextIcons.json'),
	};
});

beforeEach(() => {
	document.body.innerHTML = loadFixture('riven-calc');
	history.replaceState(null, '', '#');
});

function row(section: 'buffs' | 'spliced' | 'curses', tag: string): HTMLElement | undefined {
	return document.querySelector<HTMLElement>(`[data-riven-section="${section}"] [data-stat-tag="${tag}"]`) ?? undefined;
}

function labelOf(section: 'buffs' | 'spliced' | 'curses', tag: string): string {
	return row(section, tag)?.querySelector('.riven-stat-label')?.textContent?.replaceAll(/\s+/gu, ' ').trim() ?? '';
}

function choose(selector: string, value: string): void {
	const element = document.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
	element.value = value;
	element.dispatchEvent(new Event('change'));
}

function typeGrade(section: 'buffs' | 'spliced' | 'curses', tag: string, value: string): string {
	const input = row(section, tag)!.querySelector<HTMLInputElement>('.riven-grade-input')!;
	input.value = value;
	input.dispatchEvent(new Event('input', {bubbles: true}));
	return row(section, tag)!.querySelector('.riven-grade-result')!.textContent;
}

function sliderOf(section: 'buffs' | 'spliced' | 'curses', tag: string): HTMLInputElement {
	return row(section, tag)!.querySelector<HTMLInputElement>('.riven-grade-slider')!;
}

function boxOf(section: 'buffs' | 'spliced' | 'curses', tag: string): HTMLInputElement {
	return row(section, tag)!.querySelector<HTMLInputElement>('.riven-grade-input')!;
}

function resultOf(section: 'buffs' | 'spliced' | 'curses', tag: string): string {
	return row(section, tag)!.querySelector('.riven-grade-result')!.textContent;
}

function moveSlider(section: 'buffs' | 'spliced' | 'curses', tag: string, value: string): void {
	const slider = sliderOf(section, tag);
	slider.value = value;
	slider.dispatchEvent(new Event('input', {bubbles: true}));
}

describe('buildStatLabel', () => {
	function labelText(template: string, icons: Record<string, any> = {}): string {
		const container = document.createElement('div');
		container.append(buildStatLabel(template, icons));
		return container.textContent;
	}

	test.each([
		['|val|% Critical Chance', 'Critical Chance'],
		['|STAT1|% Critical Chance for Slide Attack', 'Critical Chance for Slide Attack'],
		['|val| Damage to Corpus', 'Damage to Corpus'],
		['|val|s Combo Duration', 'Combo Duration'],
		['|val| % Krit. Chance', 'Krit. Chance'],
		['|val| % de zoom', 'de zoom'],
		['Nothing to see', 'Nothing to see'],
	])('turns %s into %s, leaving the number to the slider', (template, expected) => {
		expect(labelText(template)).toBe(expected);
	});

	test('replaces text icons with images', () => {
		const container = document.createElement('div');
		container.append(buildStatLabel('|val|% <DT_FIRE_COLOR>Heat', {DT_FIRE_COLOR: {DIT_AUTO: '/fire.png'}}));
		const icon = container.querySelector('img')!;
		expect(icon.getAttribute('src')).toBe('https://browse.wf/fire.png');
		expect(icon.alt).toBe('<DT_FIRE_COLOR>');
		expect(container.textContent).toBe('Heat');
	});

	test('declares the size of the icon images, so that labels do not shift as they load', () => {
		const container = document.createElement('div');
		container.append(buildStatLabel('|val|% <DT_FIRE_COLOR>Heat', {DT_FIRE_COLOR: {DIT_AUTO: '/fire.png'}}));
		const icon = container.querySelector('img')!;
		expect([icon.getAttribute('width'), icon.getAttribute('height')]).toEqual(['64', '64']);
	});

	test('keeps the markup of a text icon it cannot resolve', () => {
		expect(labelText('|val|% <DT_UNKNOWN_COLOR>Gas')).toBe('<DT_UNKNOWN_COLOR>Gas');
	});
});

describe('getStatName', () => {
	test.each([
		['|val|% Critical Chance', 'Critical Chance'],
		['|val|% <DT_FIRE_COLOR>Heat', 'Heat'],
		['|val| Damage to Corpus', 'Damage to Corpus'],
		['|val|s Combo Duration', 'Combo Duration'],
		['|val| % Krit. Chance', 'Krit. Chance'],
		['|STAT1|% Critical Chance for Slide Attack', 'Critical Chance for Slide Attack'],
		['Slam Damage', 'Slam Damage'],
	])('%s is named %s', (template, expected) => {
		expect(getStatName(template)).toBe(expected);
	});
});

describe('initRivenCalc', () => {
	test('starts as a rank 8 rifle Riven with 3 positive and 1 negative trait', () => {
		const calculator = initRivenCalc(data);
		expect(calculator.getState()).toMatchObject({rivenClassKey: RIFLE, rank: 8, layout: {buffs: 3, curses: 1}});
		expect(document.querySelector<HTMLSelectElement>('#riven-class')!.value).toBe(RIFLE);
		expect(document.querySelector<HTMLInputElement>('#rank')!.value).toBe('8');
	});

	test('lists the seven Riven types and every weapon that takes one', () => {
		initRivenCalc(data);
		expect([...document.querySelectorAll('#riven-class option')].map(option => option.textContent)).toEqual([
			'Archgun', 'Kitgun', 'Melee', 'Pistol', 'Rifle', 'Shotgun', 'Zaw',
		]);
		const weaponNames = [...document.querySelectorAll<HTMLOptionElement>('#weapons-datalist option')].map(option => option.value);
		expect(weaponNames).toContain('Braton');
		expect(weaponNames).toContain('Catchmoon');
	});

	test('suggests base weapons but not their variants, which can still be picked by name', () => {
		const calculator = initRivenCalc(data);
		const weaponNames = [...document.querySelectorAll<HTMLOptionElement>('#weapons-datalist option')].map(option => option.value);
		expect(weaponNames).not.toContain('Braton Prime');

		const weaponInput = document.querySelector<HTMLInputElement>('#weapon-name')!;
		weaponInput.value = 'Braton Prime';
		weaponInput.dispatchEvent(new Event('change'));
		expect(calculator.getState().weapon?.label).toBe('Braton Prime');
	});

	test('choosing a suggestion applies at once, but typing waits for the box to lose focus', () => {
		const calculator = initRivenCalc(data);
		const weaponInput = document.querySelector<HTMLInputElement>('#weapon-name')!;

		weaponInput.value = 'Skana';
		weaponInput.dispatchEvent(new InputEvent('input', {bubbles: true, inputType: 'insertText'}));
		expect(calculator.getState().weapon).toBeUndefined();

		weaponInput.dispatchEvent(new Event('change'));
		expect(calculator.getState().weapon?.label).toBe('Skana');

		weaponInput.value = 'Braton';
		weaponInput.dispatchEvent(new InputEvent('input', {bubbles: true, inputType: 'insertReplacementText'}));
		expect(calculator.getState().weapon?.label).toBe('Braton');
		expect(document.querySelector<HTMLSelectElement>('#riven-class')!.value).toBe(RIFLE);
	});

	test('keeps the graded values when the box loses focus after a suggestion was chosen', () => {
		initRivenCalc(data);
		const weaponInput = document.querySelector<HTMLInputElement>('#weapon-name')!;
		weaponInput.value = 'Braton';
		weaponInput.dispatchEvent(new InputEvent('input', {bubbles: true, inputType: 'insertReplacementText'}));
		typeGrade('buffs', 'WeaponDamageAmountMod', '190');

		weaponInput.dispatchEvent(new Event('change'));
		expect(boxOf('buffs', 'WeaponDamageAmountMod').value).toBe('190');
	});

	describe('the - and + buttons', () => {
		const stepButton = (inputId: string, direction: '-1' | '1') => document.querySelector<HTMLButtonElement>(`#${inputId}`)!.parentElement!
			.querySelector<HTMLButtonElement>(`[data-riven-step="${direction}"]`)!;

		test('step the rank, and apply it at once', () => {
			const calculator = initRivenCalc(data);
			stepButton('rank', '-1').click();
			expect(calculator.getState().rank).toBe(7);
			expect(document.querySelector<HTMLInputElement>('#rank')!.value).toBe('7');
			stepButton('rank', '1').click();
			expect(calculator.getState().rank).toBe(8);
		});

		test('stop at the ends of the range', () => {
			const calculator = initRivenCalc(data);
			stepButton('rank', '1').click();
			expect(calculator.getState().rank).toBe(8);
			stepButton('positive-traits', '1').click();
			expect(calculator.getState().layout.buffs).toBe(3);
			stepButton('negative-traits', '1').click();
			expect(calculator.getState().layout.curses).toBe(1);
		});

		test('are greyed out at the end of the range they would step towards', () => {
			initRivenCalc(data);
			expect(stepButton('rank', '1').disabled).toBe(true);
			expect(stepButton('rank', '-1').disabled).toBe(false);
			expect(stepButton('positive-traits', '1').disabled).toBe(true);
			expect(stepButton('negative-traits', '1').disabled).toBe(true);

			stepButton('negative-traits', '-1').click();
			expect(stepButton('negative-traits', '-1').disabled).toBe(true);
			expect(stepButton('negative-traits', '1').disabled).toBe(false);

			choose('#rank', '0');
			expect(stepButton('rank', '-1').disabled).toBe(true);
			expect(stepButton('rank', '1').disabled).toBe(false);
		});

		test('follow a number typed or changed with the arrow keys', () => {
			initRivenCalc(data);
			const rank = document.querySelector<HTMLInputElement>('#rank')!;
			rank.value = '3';
			rank.dispatchEvent(new Event('input', {bubbles: true}));
			expect(stepButton('rank', '1').disabled).toBe(false);

			rank.value = '8';
			rank.dispatchEvent(new Event('input', {bubbles: true}));
			expect(stepButton('rank', '1').disabled).toBe(true);
		});

		test('change the number of buffs and curses', () => {
			const calculator = initRivenCalc(data);
			stepButton('positive-traits', '-1').click();
			stepButton('negative-traits', '-1').click();
			expect(calculator.getState().layout).toEqual({buffs: 2, curses: 0});
			expect(document.querySelector('[data-riven-card="curses"]')!.classList.contains('d-none')).toBe(true);
		});

		test('an emptied box keeps its previous value when it loses focus', () => {
			const calculator = initRivenCalc(data);
			choose('#rank', '5');
			choose('#rank', '');
			expect(calculator.getState().rank).toBe(5);
			expect(document.querySelector<HTMLInputElement>('#rank')!.value).toBe('5');

			stepButton('positive-traits', '-1').click();
			choose('#positive-traits', '');
			choose('#negative-traits', '');
			expect(calculator.getState().layout).toEqual({buffs: 2, curses: 1});
			expect(document.querySelector<HTMLInputElement>('#positive-traits')!.value).toBe('2');
			expect(document.querySelector<HTMLInputElement>('#negative-traits')!.value).toBe('1');
		});

		test('have names for screen readers', () => {
			initRivenCalc(data);
			expect(stepButton('positive-traits', '-1').getAttribute('aria-label')).toBe('Decrease Buffs');
			expect(stepButton('negative-traits', '1').getAttribute('aria-label')).toBe('Increase Curses');
		});
	});

	test('names each positive trait, leaving its range to the slider', () => {
		initRivenCalc(data);
		expect(labelOf('buffs', 'WeaponDamageAmountMod')).toBe('Damage');
		expect(labelOf('buffs', 'WeaponCritChanceMod')).toBe('Critical Chance');
	});

	test('names each negative trait, leaving its range to the slider', () => {
		initRivenCalc(data);
		expect(labelOf('curses', 'WeaponCritChanceMod')).toBe('Critical Chance');
	});

	describe('grouping and order', () => {
		const tagsIn = (section: 'buffs' | 'curses'): string[] => [...document.querySelectorAll<HTMLElement>(`[data-riven-section="${section}"] .riven-stat`)]
			.map(element => element.dataset.statTag!);
		const groupsIn = (section: 'buffs' | 'curses') => [...document.querySelectorAll<HTMLElement>(`[data-riven-section="${section}"] .riven-group`)];

		test('sets related traits apart in labelled groups, in order of importance', () => {
			initRivenCalc(data);
			expect(groupsIn('buffs').map(group => group.dataset.rivenGroup)).toEqual([
				'offence', 'status', 'elemental', 'physical', 'faction', 'ammo', 'handling',
			]);
			for (const group of groupsIn('buffs')) {
				expect(group.getAttribute('role')).toBe('group');
				expect(group.getAttribute('aria-label')).toBeTruthy();
			}
		});

		test('lists the offence traits first, with the two crits together', () => {
			initRivenCalc(data);
			expect(tagsIn('buffs').slice(0, 5)).toEqual([
				'WeaponDamageAmountMod',
				'WeaponCritChanceMod',
				'WeaponCritDamageMod',
				'WeaponFireIterationsMod',
				'WeaponFireRateMod',
			]);
		});

		test('lists the elements as Heat, Cold, Electricity, Toxin and the physical types as Impact, Puncture, Slash', () => {
			initRivenCalc(data);
			const tags = tagsIn('buffs');
			const sliceOf = (first: string, count: number) => tags.slice(tags.indexOf(first), tags.indexOf(first) + count);
			expect(sliceOf('WeaponFireDamageMod', 4)).toEqual([
				'WeaponFireDamageMod', 'WeaponFreezeDamageMod', 'WeaponElectricityDamageMod', 'WeaponToxinDamageMod',
			]);
			expect(sliceOf('WeaponImpactDamageMod', 3)).toEqual(['WeaponImpactDamageMod', 'WeaponArmorPiercingDamageMod', 'WeaponSlashDamageMod']);
		});

		test('puts the melee-only group second on a melee weapon', () => {
			initRivenCalc(data);
			choose('#riven-class', 'PlayerMeleeWeaponRandomModRare');
			expect(groupsIn('buffs').slice(0, 3).map(group => group.dataset.rivenGroup)).toEqual(['offence', 'melee', 'status']);
		});

		test('lists the same groups and traits, in the same order, on the positive and negative sides', () => {
			initRivenCalc(data);
			expect(groupsIn('curses').map(group => group.dataset.rivenGroup)).toEqual(groupsIn('buffs').map(group => group.dataset.rivenGroup));
			expect(tagsIn('curses')).toEqual(tagsIn('buffs'));
		});

		test('keeps the same lists on a melee weapon, whose negative-only trait is then in the positive list', () => {
			initRivenCalc(data);
			choose('#riven-class', 'PlayerMeleeWeaponRandomModRare');
			expect(tagsIn('curses')).toEqual(tagsIn('buffs'));
			expect(tagsIn('buffs')).toContain('WeaponMeleeComboPointsOnHitMod');
		});

		test('greys out, in place, the traits that cannot be negative, and gives them no controls', () => {
			initRivenCalc(data);
			for (const tag of ['WeaponFireDamageMod', 'WeaponFreezeDamageMod', 'WeaponElectricityDamageMod', 'WeaponToxinDamageMod', 'WeaponPunctureDepthMod']) {
				const element = row('curses', tag)!;
				expect(element.classList.contains('riven-stat-unavailable'), tag).toBe(true);
				expect(element.querySelector('.riven-stat-unavailable-note')!.textContent).toBe('Positive only');
				expect(element.querySelector('input, button'), tag).toBeNull();
			}

			expect(labelOf('curses', 'WeaponToxinDamageMod')).toBe('Toxin');
		});

		test('greys out the traits that cannot be positive in the positive list', () => {
			initRivenCalc(data);
			choose('#riven-class', 'PlayerMeleeWeaponRandomModRare');
			const element = row('buffs', 'WeaponMeleeComboPointsOnHitMod')!;
			expect(element.classList.contains('riven-stat-unavailable')).toBe(true);
			expect(element.querySelector('.riven-stat-unavailable-note')!.textContent).toBe('Negative only');
		});

		test('does not grey out traits that can take either sign', () => {
			initRivenCalc(data);
			for (const section of ['buffs', 'curses'] as const) {
				expect(row(section, 'WeaponCritChanceMod')!.classList.contains('riven-stat-unavailable')).toBe(false);
				expect(row(section, 'WeaponCritChanceMod')!.querySelector('.riven-grade-slider')).not.toBeNull();
			}
		});

		test('groups the spliced traits the same way, in a card of their own, by the traits they are made from', () => {
			initRivenCalc(data);
			const splicedTags = (): string[] => [...document.querySelectorAll<HTMLElement>('[data-riven-section="spliced"] .riven-stat')].map(element => element.dataset.statTag!);
			const splicedGroups = (): string[] => [...document.querySelectorAll<HTMLElement>('[data-riven-section="spliced"] .riven-group')].map(group => group.dataset.rivenGroup!);

			// Weak Point Damage needs Damage, so it takes the place before it, at the top of Offence
			expect(splicedGroups()).toEqual(['offence', 'elemental', 'faction', 'ammo']);
			expect(splicedTags().slice(0, 3)).toEqual(['SplicedWeakpointDamage', 'SplicedStatusDamage', 'SplicedWeakpointCriticalChance']);
			expect(splicedTags()).toContain('SplicedGasDamage');

			choose('#riven-class', 'PlayerMeleeWeaponRandomModRare');
			expect(splicedGroups()).toEqual(['offence', 'melee', 'elemental', 'faction']);
			expect(splicedTags().slice(0, 3)).toEqual(['SplicedSlamDamage', 'SplicedStatusDamage', 'SplicedParryAngle']);
		});
	});

	test('puts exactly the stats the class can roll in each section', () => {
		initRivenCalc(data);
		const stats = getRivenStats(RIFLE, data.exportUpgrades);
		expect(document.querySelectorAll('[data-riven-section="buffs"] .riven-stat:not(.riven-stat-unavailable)'))
			.toHaveLength(stats.filter(stat => stat.canBeBuff && !stat.spliced).length);
		expect(document.querySelectorAll('[data-riven-section="spliced"] .riven-stat'))
			.toHaveLength(stats.filter(stat => stat.spliced).length);
		expect(document.querySelectorAll('[data-riven-section="curses"] .riven-stat:not(.riven-stat-unavailable)'))
			.toHaveLength(stats.filter(stat => stat.canBeCurse).length);
	});

	test('names the spliced traits through the translation fallback', () => {
		initRivenCalc(data);
		expect(labelOf('spliced', 'SplicedWeakpointDamage')).toBe('Weak Point Damage');
		expect(labelOf('spliced', 'SplicedAmmoEfficiency')).toBe('Ammo Efficiency');
	});

	test('shows spliced Ammo Efficiency as a positive range, though its base value is negative', () => {
		choose('#positive-traits', '3');
		initRivenCalc(data);
		choose('#negative-traits', '0');
		expect(labelOf('spliced', 'SplicedAmmoEfficiency')).toBe('Ammo Efficiency');
	});

	test('changing the Riven type changes which traits are listed', () => {
		initRivenCalc(data);
		expect(row('spliced', 'SplicedWeakpointDamage')).toBeDefined();
		expect(row('spliced', 'SplicedSlamDamage')).toBeUndefined();

		choose('#riven-class', 'PlayerMeleeWeaponRandomModRare');

		expect(row('spliced', 'SplicedWeakpointDamage')).toBeUndefined();
		expect(row('spliced', 'SplicedSlamDamage')).toBeDefined();
		expect(row('buffs', 'WeaponMeleeDamageMod')).toBeDefined();
	});

	test('shotguns can roll Zoom', () => {
		initRivenCalc(data);
		expect(row('buffs', 'WeaponZoomFovMod')).toBeDefined();
		choose('#riven-class', SHOTGUN);
		expect(labelOf('buffs', 'WeaponZoomFovMod')).toBe('Zoom');
	});

	test('with no negative trait, the negative traits card is hidden and positive values use the 3+0 multiplier', () => {
		initRivenCalc(data);
		choose('#negative-traits', '0');
		expect(document.querySelector('[data-riven-card="curses"]')!.classList.contains('d-none')).toBe(true);
		expect(document.querySelectorAll('[data-riven-section="curses"] .riven-stat')).toHaveLength(0);
		expect(labelOf('buffs', 'WeaponCritChanceMod')).toBe('Critical Chance');
	});

	test('with two positive traits, positive values use the 2+1 multiplier', () => {
		initRivenCalc(data);
		choose('#positive-traits', '2');
		expect(labelOf('buffs', 'WeaponCritChanceMod')).toBe('Critical Chance');
	});

	test('a lower rank scales values down, and out-of-range ranks are clamped', () => {
		const calculator = initRivenCalc(data);
		choose('#rank', '0');
		expect(labelOf('buffs', 'WeaponCritChanceMod')).toBe('Critical Chance');

		choose('#rank', '42');
		expect(calculator.getState().rank).toBe(8);
		expect(document.querySelector<HTMLInputElement>('#rank')!.value).toBe('8');
	});

	test('picking a weapon selects its Riven type', () => {
		const calculator = initRivenCalc(data);
		choose('#weapon-name', 'Skana');
		expect(calculator.getState().rivenClassKey).toBe('PlayerMeleeWeaponRandomModRare');
		expect(document.querySelector<HTMLSelectElement>('#riven-class')!.value).toBe('PlayerMeleeWeaponRandomModRare');
		expect(row('buffs', 'WeaponMeleeDamageMod')).toBeDefined();
	});

	test('typing something that is not a weapon changes nothing', () => {
		const calculator = initRivenCalc(data);
		choose('#weapon-name', 'Not a weapon');
		expect(calculator.getState().weapon).toBeUndefined();
		expect(calculator.getState().rivenClassKey).toBe(RIFLE);
	});

	test('changing the Riven type clears the picked weapon', () => {
		const calculator = initRivenCalc(data);
		choose('#weapon-name', 'Lex');
		choose('#riven-class', RIFLE);
		expect(calculator.getState().weapon).toBeUndefined();
		expect(document.querySelector<HTMLInputElement>('#weapon-name')!.value).toBe('');
	});

	test('greys out traits the picked weapon cannot roll, with a note', () => {
		initRivenCalc(data);
		choose('#weapon-name', 'Lex');
		// The Lex is almost all Puncture damage
		const slash = row('buffs', 'WeaponSlashDamageMod')!;
		expect(slash.classList.contains('riven-stat-unavailable')).toBe(true);
		expect(slash.querySelector('.riven-stat-unavailable-note')!.textContent).toBe('Unrollable for Lex');
		expect(slash.querySelector('input')).toBeNull();
		expect(row('buffs', 'WeaponArmorPiercingDamageMod')!.classList.contains('riven-stat-unavailable')).toBe(false);
	});

	test('greys out nothing for a weapon when none is picked', () => {
		initRivenCalc(data);
		const notes = [...document.querySelectorAll('.riven-stat-unavailable-note')].map(note => note.textContent);
		expect(notes.filter(note => note.startsWith('Unrollable'))).toEqual([]);
	});

	describe('grading', () => {
		test('grades a positive trait from the value on the Riven', () => {
			initRivenCalc(data);
			expect(typeGrade('buffs', 'WeaponDamageAmountMod', '204.2')).toBe('1.10x = S');
			expect(typeGrade('buffs', 'WeaponDamageAmountMod', '167.1')).toBe('0.90x = F');
		});

		test('grades a negative trait by how weak it is', () => {
			initRivenCalc(data);
			expect(typeGrade('curses', 'WeaponCritChanceMod', '-121.5')).toBe('0.90x = S');
			expect(typeGrade('curses', 'WeaponCritChanceMod', '-148.5')).toBe('1.10x = F');
		});

		test('grades a spliced trait', () => {
			initRivenCalc(data);
			// Weak Point Damage at 3+1 ranges from 227.8% to 278.5%
			expect(typeGrade('spliced', 'SplicedWeakpointDamage', '278.5')).toBe('1.10x = S');
		});

		test('clearing the box clears the grade', () => {
			initRivenCalc(data);
			typeGrade('buffs', 'WeaponDamageAmountMod', '190');
			expect(typeGrade('buffs', 'WeaponDamageAmountMod', '')).toBe('');
		});

		test('grades against the current layout', () => {
			initRivenCalc(data);
			choose('#positive-traits', '2');
			choose('#negative-traits', '0');
			// 2+0 Damage tops out at 215.6%
			expect(typeGrade('buffs', 'WeaponDamageAmountMod', '215.6')).toBe('1.10x = S');
		});

		test('puts a slider spanning the values the trait can roll before the number box', () => {
			initRivenCalc(data);
			const slider = sliderOf('buffs', 'WeaponDamageAmountMod');
			expect(slider.type).toBe('range');
			expect([slider.min, slider.max, slider.step]).toEqual(['167.1', '204.2', '0.1']);
			expect(slider.closest('.riven-grade-slider-group')!.nextElementSibling).toBe(boxOf('buffs', 'WeaponDamageAmountMod'));
		});

		test('shows the lowest and highest numbers the trait can roll above the ends of the slider', () => {
			initRivenCalc(data);
			const bounds = (section: 'buffs' | 'curses', tag: string) => [...row(section, tag)!.querySelectorAll(':scope .riven-grade-bounds span')]
				.map(bound => bound.textContent);
			expect(bounds('buffs', 'WeaponDamageAmountMod')).toEqual(['167.1', '204.2']);
			expect(bounds('curses', 'WeaponCritChanceMod')).toEqual(['-148.5', '-121.5']);

			choose('#positive-traits', '2');
			choose('#negative-traits', '0');
			expect(bounds('buffs', 'WeaponDamageAmountMod')).toEqual(['176.4', '215.6']);
		});

		test('starts the slider in the middle of the range', () => {
			initRivenCalc(data);
			// Browsers snap the middle to the step, jsdom does not
			expect(sliderOf('buffs', 'WeaponDamageAmountMod').valueAsNumber).toBeCloseTo(185.65, 1);
		});

		test('a negative trait\'s slider still runs from its lowest number to its highest', () => {
			initRivenCalc(data);
			const slider = sliderOf('curses', 'WeaponCritChanceMod');
			expect([slider.min, slider.max]).toEqual(['-148.5', '-121.5']);
		});

		test('multiplier traits span the totals shown in game, x1.xx for a buff and x0.xx for a curse', () => {
			initRivenCalc(data);
			const buff = sliderOf('buffs', 'WeaponFactionDamageGrineer');
			const curse = sliderOf('curses', 'WeaponFactionDamageGrineer');
			expect([buff.min, buff.max]).toEqual(['1.46', '1.56']);
			expect([curse.min, curse.max]).toEqual(['0.55', '0.64']);
		});

		test('multiplier traits step by 0.01', () => {
			initRivenCalc(data);
			expect(sliderOf('buffs', 'WeaponFactionDamageGrineer').step).toBe('0.01');
		});

		test('the slider re-spans the range when the layout changes', () => {
			initRivenCalc(data);
			choose('#positive-traits', '2');
			choose('#negative-traits', '0');
			const slider = sliderOf('buffs', 'WeaponDamageAmountMod');
			expect([slider.min, slider.max]).toEqual(['176.4', '215.6']);
		});

		test('shows no grade, though the box starts at the middle, until the slider or the box is used', () => {
			initRivenCalc(data);
			expect(resultOf('buffs', 'WeaponDamageAmountMod')).toBe('');
			expect(boxOf('buffs', 'WeaponDamageAmountMod').value).toBe(sliderOf('buffs', 'WeaponDamageAmountMod').value);
		});

		test('moving the slider fills in the box and grades the value', () => {
			initRivenCalc(data);
			moveSlider('buffs', 'WeaponDamageAmountMod', '204.2');
			expect(boxOf('buffs', 'WeaponDamageAmountMod').value).toBe('204.2');
			expect(resultOf('buffs', 'WeaponDamageAmountMod')).toBe('1.10x = S');

			moveSlider('buffs', 'WeaponDamageAmountMod', '167.1');
			expect(boxOf('buffs', 'WeaponDamageAmountMod').value).toBe('167.1');
			expect(resultOf('buffs', 'WeaponDamageAmountMod')).toBe('0.90x = F');
		});

		test('shows the grade letter in its own element, tagged with the grade for colouring', () => {
			initRivenCalc(data);
			typeGrade('buffs', 'WeaponDamageAmountMod', '204.2');
			const letter = row('buffs', 'WeaponDamageAmountMod')!.querySelector<HTMLElement>(':scope .riven-grade-result .riven-grade-letter')!;
			expect(letter.textContent).toBe('S');
			expect(letter.dataset.grade).toBe('S');

			typeGrade('buffs', 'WeaponDamageAmountMod', '167.1');
			const updated = row('buffs', 'WeaponDamageAmountMod')!.querySelectorAll('.riven-grade-letter');
			expect(updated).toHaveLength(1);
			expect((updated[0] as HTMLElement).dataset.grade).toBe('F');
		});

		test('leaves the grade element completely empty when there is no grade, so that it takes no space', () => {
			initRivenCalc(data);
			typeGrade('buffs', 'WeaponDamageAmountMod', '190');
			typeGrade('buffs', 'WeaponDamageAmountMod', '');
			expect(row('buffs', 'WeaponDamageAmountMod')!.querySelector('.riven-grade-result')!.childNodes).toHaveLength(0);
		});

		test('typing in the box moves the slider', () => {
			initRivenCalc(data);
			typeGrade('buffs', 'WeaponDamageAmountMod', '190.5');
			expect(sliderOf('buffs', 'WeaponDamageAmountMod').value).toBe('190.5');
		});

		test('a typed value beyond what the trait can roll pins the slider to its end, and is graded X', () => {
			initRivenCalc(data);
			expect(typeGrade('buffs', 'WeaponDamageAmountMod', '400')).toBe('2.15x = X');
			expect(sliderOf('buffs', 'WeaponDamageAmountMod').value).toBe('204.2');
			expect(boxOf('buffs', 'WeaponDamageAmountMod').value).toBe('400');
		});

		test('clearing the box clears the grade but leaves the slider where it was', () => {
			initRivenCalc(data);
			typeGrade('buffs', 'WeaponDamageAmountMod', '190.5');
			expect(typeGrade('buffs', 'WeaponDamageAmountMod', '')).toBe('');
			expect(sliderOf('buffs', 'WeaponDamageAmountMod').value).toBe('190.5');
		});

		test('the slider of a negative trait is graded by how weak the trait is', () => {
			initRivenCalc(data);
			moveSlider('curses', 'WeaponCritChanceMod', '-121.5');
			expect(resultOf('curses', 'WeaponCritChanceMod')).toBe('0.90x = S');
			expect(boxOf('curses', 'WeaponCritChanceMod').value).toBe('-121.5');
		});

		describe('reset button', () => {
			const resetOf = (section: 'buffs' | 'curses', tag: string) => row(section, tag)!.querySelector<HTMLButtonElement>('.riven-grade-reset')!;

			test('has an icon and a name for screen readers', () => {
				initRivenCalc(data);
				const button = resetOf('buffs', 'WeaponCritChanceMod');
				expect(button.type).toBe('button');
				expect(button.querySelector('i.bi-arrow-counterclockwise')).not.toBeNull();
				expect(button.getAttribute('aria-label')).toBe('Reset Critical Chance');
			});

			test('starts greyed out, as there is nothing to reset', () => {
				initRivenCalc(data);
				expect(resetOf('buffs', 'WeaponDamageAmountMod').disabled).toBe(true);
				expect(resetOf('curses', 'WeaponCritChanceMod').disabled).toBe(true);
			});

			test('is enabled by moving the slider, and greyed out again by resetting', () => {
				initRivenCalc(data);
				const button = resetOf('buffs', 'WeaponDamageAmountMod');
				moveSlider('buffs', 'WeaponDamageAmountMod', '190');
				expect(button.disabled).toBe(false);

				button.click();
				expect(button.disabled).toBe(true);
			});

			test('is enabled by entering a number, but not by clearing the box', () => {
				initRivenCalc(data);
				const button = resetOf('buffs', 'WeaponDamageAmountMod');
				typeGrade('buffs', 'WeaponDamageAmountMod', '');
				expect(button.disabled).toBe(true);

				typeGrade('buffs', 'WeaponDamageAmountMod', '190');
				expect(button.disabled).toBe(false);
			});

			test('only enables the button of the trait that was changed', () => {
				initRivenCalc(data);
				moveSlider('buffs', 'WeaponDamageAmountMod', '190');
				expect(resetOf('buffs', 'WeaponCritChanceMod').disabled).toBe(true);
			});

			test('puts the slider and the box back in the middle, and removes the grade', () => {
				initRivenCalc(data);
				const middle = sliderOf('buffs', 'WeaponDamageAmountMod').value;
				moveSlider('buffs', 'WeaponDamageAmountMod', '204.2');
				resetOf('buffs', 'WeaponDamageAmountMod').click();

				expect(sliderOf('buffs', 'WeaponDamageAmountMod').value).toBe(middle);
				expect(boxOf('buffs', 'WeaponDamageAmountMod').value).toBe(middle);
				expect(row('buffs', 'WeaponDamageAmountMod')!.querySelector('.riven-grade-result')!.childNodes).toHaveLength(0);
			});

			test('resets a value typed beyond the range', () => {
				initRivenCalc(data);
				const middle = boxOf('buffs', 'WeaponDamageAmountMod').value;
				typeGrade('buffs', 'WeaponDamageAmountMod', '400');
				resetOf('buffs', 'WeaponDamageAmountMod').click();

				expect(boxOf('buffs', 'WeaponDamageAmountMod').value).toBe(middle);
				expect(resultOf('buffs', 'WeaponDamageAmountMod')).toBe('');
			});

			test('only resets its own trait', () => {
				initRivenCalc(data);
				typeGrade('buffs', 'WeaponDamageAmountMod', '190');
				typeGrade('buffs', 'WeaponCritChanceMod', '150');
				resetOf('buffs', 'WeaponDamageAmountMod').click();

				expect(boxOf('buffs', 'WeaponCritChanceMod').value).toBe('150');
				expect(resultOf('buffs', 'WeaponCritChanceMod')).not.toBe('');
			});
		});

		describe('reset all button', () => {
			const resetAllOf = (card: 'buffs' | 'curses' | 'spliced') => document.querySelector<HTMLButtonElement>(`[data-riven-card="${card}"] [data-riven-reset-all]`)!;

			test('is in each card heading, greyed out while there is nothing to reset', () => {
				initRivenCalc(data);
				for (const card of ['buffs', 'curses', 'spliced'] as const) {
					expect(resetAllOf(card).querySelector('i.bi-arrow-counterclockwise')).not.toBeNull();
					expect(resetAllOf(card).getAttribute('aria-label')).toBe('Reset all');
					expect(resetAllOf(card).disabled).toBe(true);
				}
			});

			test('is enabled by a value in its own card only', () => {
				initRivenCalc(data);
				moveSlider('buffs', 'WeaponDamageAmountMod', '190');
				expect(resetAllOf('buffs').disabled).toBe(false);
				expect(resetAllOf('curses').disabled).toBe(true);
			});

			test('resets every trait in its card, and no other card', () => {
				initRivenCalc(data);
				moveSlider('buffs', 'WeaponDamageAmountMod', '190');
				typeGrade('buffs', 'WeaponCritChanceMod', '150');
				typeGrade('curses', 'WeaponCritChanceMod', '-120');
				resetAllOf('buffs').click();

				expect(resultOf('buffs', 'WeaponDamageAmountMod')).toBe('');
				expect(resultOf('buffs', 'WeaponCritChanceMod')).toBe('');
				expect(boxOf('buffs', 'WeaponCritChanceMod').value).toBe(sliderOf('buffs', 'WeaponCritChanceMod').value);
				expect(resultOf('curses', 'WeaponCritChanceMod')).not.toBe('');
			});

			test('is greyed out again afterwards, and by resetting the last trait one by one', () => {
				initRivenCalc(data);
				moveSlider('buffs', 'WeaponDamageAmountMod', '190');
				resetAllOf('buffs').click();
				expect(resetAllOf('buffs').disabled).toBe(true);

				moveSlider('buffs', 'WeaponDamageAmountMod', '190');
				row('buffs', 'WeaponDamageAmountMod')!.querySelector<HTMLButtonElement>('.riven-grade-reset')!.click();
				expect(resetAllOf('buffs').disabled).toBe(true);
			});

			test('stays enabled when a value outlasts a change of rank', () => {
				initRivenCalc(data);
				typeGrade('buffs', 'WeaponDamageAmountMod', '190');
				const rank = document.querySelector<HTMLInputElement>('#rank')!;
				rank.value = '5';
				rank.dispatchEvent(new Event('change'));
				expect(resetAllOf('buffs').disabled).toBe(false);
			});
		});

		test('starts the number box at the middle of the range, where the slider starts', () => {
			initRivenCalc(data);
			const box = boxOf('buffs', 'WeaponDamageAmountMod');
			expect(box.value).toBe(sliderOf('buffs', 'WeaponDamageAmountMod').value);
			expect(Number(box.value)).toBeCloseTo(185.65, 1);
		});

		test('steps the spinner from the middle, grading the new value', () => {
			initRivenCalc(data);
			const box = boxOf('buffs', 'WeaponDamageAmountMod');
			const middle = box.valueAsNumber;
			box.stepUp();
			box.dispatchEvent(new Event('input', {bubbles: true}));

			// One step (0.1) up from the middle, as opposed to the lowest value or a whole number
			expect(box.valueAsNumber).toBeGreaterThan(middle);
			expect(box.valueAsNumber).toBeLessThan(middle + 0.2);
			expect(sliderOf('buffs', 'WeaponDamageAmountMod').valueAsNumber).toBe(box.valueAsNumber);
			expect(resultOf('buffs', 'WeaponDamageAmountMod')).not.toBe('');
			expect(box.closest('.riven-stat')!.querySelector<HTMLButtonElement>('.riven-grade-reset')!.disabled).toBe(false);
		});

		test('selects the number in the box when it is focused, so typing replaces it', () => {
			initRivenCalc(data);
			const box = boxOf('buffs', 'WeaponDamageAmountMod');
			const select = vi.spyOn(box, 'select');
			box.dispatchEvent(new FocusEvent('focus'));

			expect(select).toHaveBeenCalledOnce();
		});

		test('shows the middle as a placeholder if the box is emptied', () => {
			initRivenCalc(data);
			const box = boxOf('buffs', 'WeaponDamageAmountMod');
			expect(box.placeholder).toBe(box.value);
		});

		test('gives the number box the same limits and step as the slider, so its spinner stays in range', () => {
			initRivenCalc(data);
			const box = boxOf('buffs', 'WeaponDamageAmountMod');
			const slider = sliderOf('buffs', 'WeaponDamageAmountMod');

			expect(box.min).toBe(slider.min);
			expect(box.max).toBe(slider.max);
			expect(box.step).toBe(slider.step);
			expect(Number(box.min)).toBeLessThan(Number(box.max));
		});

		test('keeps the placeholder after the trait is reset', () => {
			initRivenCalc(data);
			const box = boxOf('buffs', 'WeaponDamageAmountMod');
			const {placeholder} = box;
			box.value = '190';
			box.dispatchEvent(new Event('input', {bubbles: true}));
			box.closest('.riven-stat')!.querySelector<HTMLButtonElement>('.riven-grade-reset')!.click();

			expect(box.value).toBe(placeholder);
			expect(box.placeholder).toBe(placeholder);
		});

		describe('when the range changes', () => {
			// Where a slider sits in its range, from 0 (left) to 1 (right)
			const position = (section: 'buffs' | 'curses', tag: string): number => {
				const slider = sliderOf(section, tag);
				return (slider.valueAsNumber - Number(slider.min)) / (Number(slider.max) - Number(slider.min));
			};

			test('a graded value keeps its place on the slider, and its grade, when the rank changes', () => {
				initRivenCalc(data);
				moveSlider('buffs', 'WeaponDamageAmountMod', '204.2');
				const [before, boxBefore] = [position('buffs', 'WeaponDamageAmountMod'), boxOf('buffs', 'WeaponDamageAmountMod').value];

				choose('#rank', '4');

				expect(boxOf('buffs', 'WeaponDamageAmountMod').value).not.toBe(boxBefore);
				expect(position('buffs', 'WeaponDamageAmountMod')).toBeCloseTo(before, 1);
				expect(resultOf('buffs', 'WeaponDamageAmountMod')).toBe('1.10x = S');
				expect(row('buffs', 'WeaponDamageAmountMod')!.querySelector<HTMLButtonElement>('.riven-grade-reset')!.disabled).toBe(false);
			});

			test('keeps the place of a value typed in the middle of the range, and of a negative trait, when the layout changes', () => {
				initRivenCalc(data);
				typeGrade('buffs', 'WeaponCritChanceMod', '150');
				typeGrade('curses', 'WeaponCritChanceMod', '-130');
				const before = [position('buffs', 'WeaponCritChanceMod'), position('curses', 'WeaponCritChanceMod')];
				const grades = [resultOf('buffs', 'WeaponCritChanceMod'), resultOf('curses', 'WeaponCritChanceMod')];

				choose('#positive-traits', '2');
				choose('#negative-traits', '1');

				expect(position('buffs', 'WeaponCritChanceMod')).toBeCloseTo(before[0], 1);
				expect(position('curses', 'WeaponCritChanceMod')).toBeCloseTo(before[1], 1);
				expect([resultOf('buffs', 'WeaponCritChanceMod'), resultOf('curses', 'WeaponCritChanceMod')]).toEqual(grades);
			});

			test('a trait that was not graded stays untouched', () => {
				initRivenCalc(data);
				choose('#rank', '4');

				expect(resultOf('buffs', 'WeaponDamageAmountMod')).toBe('');
				expect(row('buffs', 'WeaponDamageAmountMod')!.querySelector<HTMLButtonElement>('.riven-grade-reset')!.disabled).toBe(true);
				expect(boxOf('buffs', 'WeaponDamageAmountMod').value).toBe(sliderOf('buffs', 'WeaponDamageAmountMod').value);
			});

			test('a reset trait is not brought back', () => {
				initRivenCalc(data);
				typeGrade('buffs', 'WeaponDamageAmountMod', '190');
				row('buffs', 'WeaponDamageAmountMod')!.querySelector<HTMLButtonElement>('.riven-grade-reset')!.click();
				choose('#rank', '4');

				expect(resultOf('buffs', 'WeaponDamageAmountMod')).toBe('');
			});

			test('values are cleared when the Riven class changes, since it is a different Riven', () => {
				initRivenCalc(data);
				typeGrade('buffs', 'WeaponCritChanceMod', '150');
				choose('#riven-class', 'PlayerMeleeWeaponRandomModRare');

				expect(resultOf('buffs', 'WeaponCritChanceMod')).toBe('');
			});

			test('values are cleared when another weapon is picked', () => {
				initRivenCalc(data);
				typeGrade('buffs', 'WeaponCritChanceMod', '150');
				choose('#weapon-name', 'Skana');

				expect(resultOf('buffs', 'WeaponCritChanceMod')).toBe('');
			});
		});

		test('labels the slider and the box for screen readers', () => {
			initRivenCalc(data);
			expect(boxOf('buffs', 'WeaponCritChanceMod').getAttribute('aria-label')).toBe('Your Riven\'s Critical Chance value');
			expect(sliderOf('buffs', 'WeaponCritChanceMod').getAttribute('aria-label'))
				.toBe('Your Riven\'s Critical Chance value (slider)');
		});
	});

	describe('URL hash', () => {
		test('is updated as the state changes', () => {
			initRivenCalc(data);
			choose('#weapon-name', 'Skana');
			choose('#rank', '5');
			choose('#positive-traits', '2');
			choose('#negative-traits', '0');
			expect(location.hash).toBe('#weapon=Skana&lvl=5&buffs=2&curses=0');
		});

		test('restores the state on load', () => {
			history.replaceState(null, '', '#weapon=Skana&lvl=5&buffs=2&curses=0');
			const calculator = initRivenCalc(data);
			expect(calculator.getState()).toMatchObject({
				rivenClassKey: 'PlayerMeleeWeaponRandomModRare',
				rank: 5,
				layout: {buffs: 2, curses: 0},
			});
			expect(document.querySelector<HTMLInputElement>('#weapon-name')!.value).toBe('Skana');
			expect(document.querySelector<HTMLInputElement>('#rank')!.value).toBe('5');
			expect(document.querySelector<HTMLInputElement>('#positive-traits')!.value).toBe('2');
			expect(document.querySelector<HTMLInputElement>('#negative-traits')!.value).toBe('0');
		});

		test('accepts links from the original calculator, which ended in a disposition', () => {
			history.replaceState(null, '', '#weapon=LotusShotgunRandomModRare%3A0.65&lvl=8&buffs=3&curses=1');
			const calculator = initRivenCalc(data);
			expect(calculator.getState().rivenClassKey).toBe(SHOTGUN);
			expect(document.querySelector<HTMLSelectElement>('#riven-class')!.value).toBe(SHOTGUN);
		});
	});

	describe('changing language', () => {
		test('redraws the traits and the weapon in the new dictionary', () => {
			const calculator = initRivenCalc(data);
			choose('#weapon-name', 'Braton');
			const translated = {
				...data.dict,
				[data.exportWeapons['/Lotus/Weapons/Tenno/Rifle/Rifle'].name]: 'Bratón',
				'/Lotus/Language/Upgrades/WeaponCritChance': '|val|% Probabilité critique',
			};

			calculator.setDict(translated);

			expect(labelOf('buffs', 'WeaponCritChanceMod')).toBe('Probabilité critique');
			expect(document.querySelector<HTMLInputElement>('#weapon-name')!.value).toBe('Bratón');
			expect(calculator.getState().weapon?.label).toBe('Bratón');
		});

		test('shows the range under the stat tag for a trait the dictionary does not name', () => {
			const calculator = initRivenCalc(data);
			calculator.setDict({});
			expect(labelOf('buffs', 'WeaponCritChanceMod')).toBe('WeaponCritChanceMod');
			expect(labelOf('spliced', 'SplicedWeakpointDamage')).toBe('SplicedWeakpointDamage');
		});
	});

	test('fails loudly when the page markup is missing a piece', () => {
		document.body.replaceChildren();
		expect(() => initRivenCalc(data)).toThrow('#weapon-name');
	});
});
