export const ARCHGUN = 'LotusArchgunRandomModRare';
export const KITGUN = 'LotusModularPistolRandomModRare';
export const MELEE = 'PlayerMeleeWeaponRandomModRare';
export const PISTOL = 'LotusPistolRandomModRare';
export const RIFLE = 'LotusRifleRandomModRare';
export const SHOTGUN = 'LotusShotgunRandomModRare';
export const ZAW = 'LotusModularMeleeRandomModRare';
/**
In the order they are listed in the class selector, which is also the order compatibility is checked in.
*/
export const RIVEN_CLASSES = [
    { key: ARCHGUN, label: 'Archgun' },
    { key: KITGUN, label: 'Kitgun' },
    { key: MELEE, label: 'Melee' },
    { key: PISTOL, label: 'Pistol' },
    { key: RIFLE, label: 'Rifle' },
    { key: SHOTGUN, label: 'Shotgun' },
    { key: ZAW, label: 'Zaw' },
];
export const DEFAULT_RIVEN_CLASS = RIFLE;
const ALL_CLASSES = RIVEN_CLASSES.map(rivenClass => rivenClass.key);
const RANGED = [ARCHGUN, KITGUN, PISTOL, RIFLE, SHOTGUN];
const RANGED_WITH_HOLSTER = [KITGUN, PISTOL, RIFLE, SHOTGUN];
const MELEE_CLASSES = [MELEE, ZAW];
function splicedStat(name, baseValue, classes, options = {}) {
    return {
        tag: `Spliced${name}`,
        baseValue,
        // Resolved through src/translation-fallback-data.json
        labelKey: `/Lotus/Language/Upgrades/Spliced/${name}Desc`,
        displayKind: options.displayKind ?? 'percent',
        reverseDisplay: options.reverseDisplay ?? false,
        canBeBuff: true,
        canBeCurse: false,
        spliced: true,
        classes,
    };
}
export const SPLICED_STATS = [
    splicedStat('AmmoEfficiency', -0.005, RANGED, { reverseDisplay: true }),
    splicedStat('BlastDamage', 0.01, ALL_CLASSES),
    splicedStat('CorrosiveDamage', 0.01, ALL_CLASSES),
    splicedStat('GasDamage', 0.01, ALL_CLASSES),
    splicedStat('MagneticDamage', 0.01, ALL_CLASSES),
    splicedStat('RadiationDamage', 0.01, ALL_CLASSES),
    splicedStat('ViralDamage', 0.01, ALL_CLASSES),
    splicedStat('StatusDamage', 0.01, ALL_CLASSES),
    splicedStat('OrokinDamage', 0.005, ALL_CLASSES, { displayKind: 'multiplier' }),
    splicedStat('ScaldraDamage', 0.005, ALL_CLASSES, { displayKind: 'multiplier' }),
    splicedStat('TechrotDamage', 0.005, ALL_CLASSES, { displayKind: 'multiplier' }),
    splicedStat('ReloadWhileHolstered', 0.01, RANGED_WITH_HOLSTER),
    splicedStat('WeakpointDamage', 0.025, RANGED),
    splicedStat('WeakpointCriticalChance', 0.0275, RANGED),
    splicedStat('HeavyAttackDamage', 0.0133, MELEE_CLASSES),
    splicedStat('HeavyAttackWindupSpeed', 0.0133, MELEE_CLASSES),
    splicedStat('SlamDamage', 0.0133, MELEE_CLASSES),
    splicedStat('ParryAngle', 0.009, MELEE_CLASSES),
];
/**
Shotguns gained Zoom in Hotfix 44.0.2 so that they can be spliced into Weak Point traits.
*/
export const SHOTGUN_ZOOM = {
    tag: 'WeaponZoomFovMod',
    baseValue: 0.004666,
    labelKey: '/Lotus/Language/Upgrades/WeaponZoomModDesc',
    displayKind: 'percent',
    reverseDisplay: false,
    canBeBuff: true,
    canBeCurse: true,
    spliced: false,
    classes: [SHOTGUN],
};
export const EXTRA_STATS = [...SPLICED_STATS, SHOTGUN_ZOOM];
//# sourceMappingURL=data.js.map