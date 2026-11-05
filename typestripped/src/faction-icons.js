/** Maps TFaction keys to their Warframe asset icon paths. */
export const FACTION_ICON_PATHS = {
    FC_CORPUS: '/Lotus/Interface/Icons/Player/FactionCorpus.png',
    FC_DUVIRI: '/Lotus/Interface/Graphics/StartingZoneChoice/DuviriStartingZoneIconParadox.png',
    FC_GRINEER: '/Lotus/Interface/Icons/Player/FactionGrineer.png',
    FC_INFESTATION: '/Lotus/Interface/Icons/Player/FactionInfested.png',
    FC_MITW: '/Lotus/Interface/Icons/Player/FactionMurmur.png',
    FC_NARMER: '/Lotus/Interface/Icons/Player/NarmerEyeGlyph.png',
    FC_OROKIN: '/Lotus/Interface/Icons/Player/FactionOrokin.png',
    FC_RED_VEIL: '/Lotus/Interface/Icons/StoreIcons/ShipDecos/Decorations/OrnamentRedVeil.png', // No proper faction icon exists; included for completeness
    FC_SCALDRA: '/Lotus/Interface/Icons/Player/FactionScaldra.png',
    FC_SENTIENT: '/Lotus/Interface/Icons/SentientFactionIcon.png',
    FC_TECHROT: '/Lotus/Interface/Icons/Player/FactionTechrot.png',
    FC_TENNO: '/Lotus/Interface/Icons/Player/LotusSymbol.png',
};
/**
 * Maps ExportEnemies avatar faction strings to their TFaction key.
 * Multiple aliases may map to the same faction.
 */
export const ENEMY_FACTION_TO_TFACTION = {
    Corpus: 'FC_CORPUS',
    Duviri: 'FC_DUVIRI',
    Grineer: 'FC_GRINEER',
    Infested: 'FC_INFESTATION',
    Infestation: 'FC_INFESTATION',
    MITW: 'FC_MITW',
    Narmer: 'FC_NARMER',
    NarmerVeil: 'FC_NARMER',
    Orokin: 'FC_OROKIN',
    'Orokin Empire': 'FC_OROKIN',
    OrokinEmpire: 'FC_OROKIN',
    Scaldra: 'FC_SCALDRA',
    Sentient: 'FC_SENTIENT',
    Techrot: 'FC_TECHROT',
};
/** Returns the icon path for an ExportEnemies avatar faction string, or undefined if unrecognised. */
export function getFactionIconPath(faction) {
    const tfaction = ENEMY_FACTION_TO_TFACTION[faction];
    return tfaction ? FACTION_ICON_PATHS[tfaction] : undefined;
}
//# sourceMappingURL=faction-icons.js.map