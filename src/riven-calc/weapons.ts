import {KITGUN, RIVEN_CLASSES, ZAW} from './data.js';

export type WeaponOption = {
	/**
	Name shown in the weapon picker.
	*/
	label: string;
	uniqueName: string;
	/**
	Key of the Riven class (see ./data.ts) that the weapon takes.
	*/
	rivenClassKey: string;
	/**
	 Whether the weapon is a variant (Prime, Vandal, Wraith, Prisma, ...) of another weapon in the list. Variants
	 take the same Riven as their base weapon, so the picker suggests only the base, but a variant's name is
	 still understood (e.g. in links).
	 */
	isVariant: boolean;
};

const UPGRADES_PREFIX = '/Lotus/Upgrades/Mods/Randomized/';

/**
 Finds which Riven class a weapon takes, following `parentName` up the weapon's inheritance chain so that
 variants (e.g. Prisma, Wraith, and shotgun-like weapons such as the Convectrix) resolve like their parent.
 */
export function getCompatibleRivenClass(
	weaponType: string,
	exportWeapons: Record<string, any>,
	exportUpgrades: Record<string, any>,
): string | undefined {
	let currentType: string | undefined = weaponType;
	while (currentType) {
		for (const rivenClass of RIVEN_CLASSES) {
			const compatibleItems: string[] | undefined = exportUpgrades[UPGRADES_PREFIX + rivenClass.key]?.compatibleItems;
			if (compatibleItems?.includes(currentType)) {
				return rivenClass.key;
			}
		}

		currentType = exportWeapons[currentType]?.parentName;
	}

	return undefined;
}

/**
 Every weapon the picker understands. Riven dispositions are retired, so the only thing a weapon decides is its
 class (and which damage types it can roll), and kitgun chambers and zaw strikes need no per-variant entries.
 */
export function buildWeaponOptions(
	exportWeapons: Record<string, any>,
	exportUpgrades: Record<string, any>,
	dict: Record<string, string>,
): WeaponOption[] {
	const options: WeaponOption[] = [];
	for (const [uniqueName, weapon] of Object.entries(exportWeapons)) {
		let rivenClassKey: string | undefined;
		if ('primeOmegaAttenuation' in weapon) {
			// Kitgun chamber
			rivenClassKey = KITGUN;
		} else if (weapon.totalDamage === 0) {
			// Zaw strike, but not its PvP variants
			if (weapon.omegaAttenuation !== 1 && !weapon.excludeFromCodex) {
				rivenClassKey = ZAW;
			}
		} else {
			rivenClassKey = getCompatibleRivenClass(uniqueName, exportWeapons, exportUpgrades);
		}

		if (rivenClassKey) {
			options.push({
				label: dict[weapon.name] ?? weapon.name, uniqueName, rivenClassKey, isVariant: false,
			});
		}
	}

	const uniqueNames = new Set(options.map(option => option.uniqueName));
	for (const option of options) {
		option.isVariant = uniqueNames.has(exportWeapons[option.uniqueName].parentName);
	}

	return options;
}

const DAMAGE_TYPE_BY_STAT_TAG: Record<string, string> = {
	WeaponImpactDamageMod: 'DT_IMPACT',
	WeaponArmorPiercingDamageMod: 'DT_PUNCTURE',
	WeaponSlashDamageMod: 'DT_SLASH',
	WeaponElectricityDamageMod: 'DT_ELECTRICITY',
	WeaponFireDamageMod: 'DT_FIRE',
	WeaponFreezeDamageMod: 'DT_FREEZE',
	WeaponToxinDamageMod: 'DT_POISON',
};

const PHYSICAL_DAMAGE_TYPES = new Set(['DT_IMPACT', 'DT_PUNCTURE', 'DT_SLASH']);

/**
 A damage type can only be rolled if it makes up more than a fifth of the weapon's damage.

 Only the first attack mode counts.

 This appears to be a bug in the upstream calculator: it read `weapon.behaviors`, but ExportWeapons spells the key
 "behaviours", so it never found any damage data. It treated every weapon as able to roll every damage type, and
 only its Projectile Speed warning ever appeared, even though its own test vectors (kept in weapons.test.ts) expect
 the damage types to be limited. This follows those vectors.
 */
export function weaponCanRollDamageType(weapon: Record<string, any>, damageType: string): boolean {
	const behaviour = weapon.behaviours?.[0];
	const damageTable: Record<string, number> | undefined = behaviour?.projectile?.attack ?? behaviour?.impact;
	if (!damageTable) {
		return true;
	}

	if (damageType in damageTable) {
		// The table also holds non-damage fields such as procChance
		const totalDamage = Object.entries(damageTable)
			.filter(([key]) => key.startsWith('DT_'))
			.reduce((sum, [, damage]) => sum + damage, 0);
		return (damageTable[damageType] / totalDamage) > 0.2;
	}

	return false;
}

/**
 Whether the weapon can currently roll the stat as a buff (or, if `isBuff` is false, as a curse).
 Unknown weapons can roll anything.
 */
export function canWeaponRollStat(weapon: Record<string, any> | undefined, tag: string, isBuff: boolean): boolean {
	if (!weapon) {
		return true;
	}

	if (tag === 'WeaponProjectileSpeedMod' && weapon.compatibilityTags && !weapon.compatibilityTags.includes('PROJECTILE')) {
		return false;
	}

	const damageType = DAMAGE_TYPE_BY_STAT_TAG[tag];
	if (damageType && !weaponCanRollDamageType(weapon, damageType)) {
		// Elemental damage can be rolled as a buff on any weapon; everything else needs the damage type
		return isBuff && !PHYSICAL_DAMAGE_TYPES.has(damageType);
	}

	return true;
}
