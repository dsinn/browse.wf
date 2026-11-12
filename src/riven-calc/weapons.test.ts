/**
 Unit tests for src/riven-calc/weapons.ts, using the real ExportWeapons/ExportUpgrades/dict.
 */
import {
	beforeAll,
	describe,
	expect,
	test,
} from 'vitest';
import {loadExportJson} from '../../test/helpers/api-mocks';
import {
	ARCHGUN,
	KITGUN,
	MELEE,
	PISTOL,
	RIFLE,
	SHOTGUN,
	ZAW,
} from './data.js';
import {
	buildWeaponOptions,
	canWeaponRollStat,
	getCompatibleRivenClass,
	weaponCanRollDamageType,
	type WeaponOption,
} from './weapons.js';

const exportWeapons = loadExportJson('ExportWeapons.json');
const exportUpgrades = loadExportJson('ExportUpgrades.json');
const dict = loadExportJson('dict.en.json');

let options: WeaponOption[];

beforeAll(() => {
	options = buildWeaponOptions(exportWeapons, exportUpgrades, dict);
});

function weaponNamed(label: string): WeaponOption {
	const option = options.find(candidate => candidate.label === label);
	if (!option) {
		throw new Error(`No weapon option named ${label}`);
	}

	return option;
}

describe('buildWeaponOptions', () => {
	test.each([
		['Braton', RIFLE],
		['Aeolak', RIFLE],
		['Lex', PISTOL],
		['Skana', MELEE],
		['Corvas', ARCHGUN],
	])('%s takes a %s Riven', (label, expectedClass) => {
		expect(weaponNamed(label).rivenClassKey).toBe(expectedClass);
	});

	test('the Convectrix takes a Shotgun Riven despite being a rifle-like weapon', () => {
		expect(weaponNamed('Convectrix').rivenClassKey).toBe(SHOTGUN);
	});

	test('kitgun chambers take a Kitgun Riven, and appear once rather than once per disposition', () => {
		expect(options.filter(option => option.label === 'Catchmoon')).toEqual([{
			label: 'Catchmoon',
			uniqueName: '/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Barrel/SUModularSecondaryBarrelAPart',
			rivenClassKey: KITGUN,
			isVariant: false,
		}]);
	});

	test('zaw strikes take a Zaw Riven, but their PvP variants are not offered', () => {
		const kripaths = options.filter(option => option.label === 'Plague Kripath');
		expect(kripaths).toHaveLength(1);
		expect(kripaths[0].rivenClassKey).toBe(ZAW);
		expect(kripaths[0].uniqueName).not.toContain('PvP');
	});

	test.each([
		'Braton Prime',
		'Braton Vandal',
		'Prisma Gorgon',
		'Dex Sybaris',
		'Tenet Detron',
	])('%s is a variant, but is still an option', label => {
		expect(weaponNamed(label).isVariant).toBe(true);
	});

	test.each(['Braton', 'Soma', 'Kuva Bramma', 'Catchmoon', 'Plague Kripath'])('%s is not a variant', label => {
		expect(weaponNamed(label).isVariant).toBe(false);
	});

	test('every option has a Riven class that exists', () => {
		const validClasses = new Set([ARCHGUN, KITGUN, MELEE, PISTOL, RIFLE, SHOTGUN, ZAW]);
		for (const option of options) {
			expect(validClasses.has(option.rivenClassKey), option.label).toBe(true);
		}
	});

	test('uses the translated name when the dictionary has one', () => {
		const translated = buildWeaponOptions(exportWeapons, exportUpgrades, {...dict, [exportWeapons['/Lotus/Weapons/Tenno/Rifle/Rifle'].name]: 'Bratón'});
		expect(translated.some(option => option.label === 'Bratón')).toBe(true);
	});
});

describe('getCompatibleRivenClass', () => {
	test('follows the parent chain for weapons the Riven lists do not name directly', () => {
		const weapons = {
			'/Child': {parentName: '/Parent'},
			'/Parent': {},
		};
		const upgrades = {
			'/Lotus/Upgrades/Mods/Randomized/LotusRifleRandomModRare': {compatibleItems: ['/Parent']},
		};
		expect(getCompatibleRivenClass('/Child', weapons, upgrades)).toBe(RIFLE);
	});

	test('returns undefined for a weapon that takes no Riven', () => {
		expect(getCompatibleRivenClass('/Nothing', {}, {})).toBeUndefined();
	});
});

describe('which damage types a weapon can roll', () => {
	// Test vectors from the original Riven calculator: physical damage types must be > 20% of the weapon's damage
	function canRoll(label: string, damageType: string): boolean {
		return weaponCanRollDamageType(exportWeapons[weaponNamed(label).uniqueName], damageType);
	}

	test.each([
		// Weapons with a projectile
		['Aeolak', ['DT_IMPACT', 'DT_PUNCTURE', 'DT_SLASH']],
		['Afentis', ['DT_PUNCTURE']],
		['Acceltra', ['DT_IMPACT']],
		['Hystrix', ['DT_PUNCTURE']],
		// Weapons without one
		['Braton', ['DT_IMPACT', 'DT_PUNCTURE', 'DT_SLASH']],
		['Bronco', ['DT_IMPACT']],
		['Lex', ['DT_PUNCTURE']],
	])('%s can roll exactly %j of the physical damage types', (label, expected) => {
		const rollable = ['DT_IMPACT', 'DT_PUNCTURE', 'DT_SLASH'].filter(damageType => canRoll(label, damageType));
		expect(rollable).toEqual(expected);
	});

	test('a weapon with no damage data can roll anything', () => {
		expect(weaponCanRollDamageType({}, 'DT_SLASH')).toBe(true);
		expect(weaponCanRollDamageType({behaviours: [{}]}, 'DT_SLASH')).toBe(true);
	});

	test('the weapon uses its projectile damage rather than its impact damage when it has a projectile', () => {
		const weapon = {behaviours: [{projectile: {attack: {DT_PUNCTURE: 100}}, impact: {DT_SLASH: 100}}]};
		expect(weaponCanRollDamageType(weapon, 'DT_PUNCTURE')).toBe(true);
		expect(weaponCanRollDamageType(weapon, 'DT_SLASH')).toBe(false);
	});

	test('a damage type needs more than 20% of the total, ignoring non-damage fields such as procChance', () => {
		const damage = (slash: number) => ({behaviours: [{impact: {DT_IMPACT: 80, DT_SLASH: slash, procChance: 1000}}]});
		expect(weaponCanRollDamageType(damage(21), 'DT_SLASH')).toBe(true);
		expect(weaponCanRollDamageType(damage(19), 'DT_SLASH')).toBe(false);
	});
});

describe('canWeaponRollStat', () => {
	function weaponData(label: string) {
		return exportWeapons[weaponNamed(label).uniqueName];
	}

	test('an unknown weapon can roll anything', () => {
		expect(canWeaponRollStat(undefined, 'WeaponSlashDamageMod', true)).toBe(true);
		expect(canWeaponRollStat(undefined, 'WeaponProjectileSpeedMod', false)).toBe(true);
	});

	test('a physical damage type the weapon lacks cannot roll as a buff or a curse', () => {
		expect(canWeaponRollStat(weaponData('Lex'), 'WeaponSlashDamageMod', true)).toBe(false);
		expect(canWeaponRollStat(weaponData('Lex'), 'WeaponSlashDamageMod', false)).toBe(false);
		expect(canWeaponRollStat(weaponData('Lex'), 'WeaponArmorPiercingDamageMod', true)).toBe(true);
	});

	test('an element the weapon lacks can roll as a buff but not as a curse', () => {
		const elementless = {behaviours: [{impact: {DT_IMPACT: 100}}]};
		expect(canWeaponRollStat(elementless, 'WeaponFireDamageMod', true)).toBe(true);
		expect(canWeaponRollStat(elementless, 'WeaponFireDamageMod', false)).toBe(false);
	});

	test('Projectile Speed needs a projectile weapon', () => {
		expect(canWeaponRollStat({compatibilityTags: ['HITSCAN']}, 'WeaponProjectileSpeedMod', true)).toBe(false);
		expect(canWeaponRollStat({compatibilityTags: ['PROJECTILE']}, 'WeaponProjectileSpeedMod', true)).toBe(true);
		expect(canWeaponRollStat({}, 'WeaponProjectileSpeedMod', true)).toBe(true);
	});

	test('traits unrelated to damage types are always rollable', () => {
		expect(canWeaponRollStat(weaponData('Lex'), 'WeaponCritChanceMod', true)).toBe(true);
		expect(canWeaponRollStat(weaponData('Lex'), 'SplicedWeakpointDamage', true)).toBe(true);
	});
});
