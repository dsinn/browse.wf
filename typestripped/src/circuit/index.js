/**
 * Circuit forecast table for the /weekly-forecast page.
 *
 * The Circuit's frame/weapon rotation is a fixed, predictable cycle (week index
 * modulo the choice list length), so unlike the rest of the page's worldState-driven
 * sections, it can be forecast without live data. worldState's EndlessXpSchedule
 * (used by src/live/circuit.ts on /live) only ever reports the current week, so it
 * can't answer "what's coming next" — the rotation tables below are that source of truth.
 */
const CIRCUIT_EPOCH_MS = 1_734_307_200_000;
const MS_PER_WEEK = 604_800_000;
const FRAME_CHOICES = [
    [
        '/Lotus/Language/Suits/InfestationName',
        '/Lotus/Language/Suits/BardName',
        '/Lotus/Language/Suits/PriestName',
    ],
    [
        '/Lotus/Language/Suits/GlassName',
        '/Lotus/Language/Suits/KhoraName',
        '/Lotus/Language/Suits/RevenantName',
    ],
    [
        '/Lotus/Language/Suits/GarudaName',
        '/Lotus/Language/Suits/PacifistName',
        '/Lotus/Language/Suits/IronFrameName',
    ],
    [
        '/Lotus/Language/Suits/ExcaliburName',
        '/Lotus/Language/Suits/TrinityName',
        '/Lotus/Language/Suits/EmberName',
    ],
    [
        '/Lotus/Language/Suits/LokiName',
        '/Lotus/Language/Suits/MagName',
        '/Lotus/Language/Suits/RhinoName',
    ],
    [
        '/Lotus/Language/Suits/AshName',
        '/Lotus/Language/Suits/FrostName',
        '/Lotus/Language/Suits/NyxName',
    ],
    [
        '/Lotus/Language/Suits/SarynName',
        '/Lotus/Language/Suits/VaubanName',
        '/Lotus/Language/Suits/NovaName',
    ],
    [
        '/Lotus/Language/Suits/NekrosName',
        '/Lotus/Language/Suits/ValkyrName',
        '/Lotus/Language/Suits/OberonName',
    ],
    [
        '/Lotus/Language/Suits/HydroidName',
        '/Lotus/Language/Suits/MirageName',
        '/Lotus/Language/Suits/LimboName',
    ],
    [
        '/Lotus/Language/Suits/MesaName',
        '/Lotus/Language/Suits/ChromaName',
        '/Lotus/Language/Suits/AtlasName',
    ],
    [
        '/Lotus/Language/Suits/IvaraName',
        '/Lotus/Language/Suits/InarosName',
        '/Lotus/Language/Suits/TitaniaName',
    ],
];
const WEAPON_CHOICES = [
    [
        '/Lotus/Language/Items/AutoShotgunName',
        '/Lotus/Language/Items/ReconnasorName',
        '/Lotus/Language/Items/CorpusHandRocketLauncherName',
        '/Lotus/Language/Items/HeavyRifleName',
        '/Lotus/Language/Items/ParisScytheName',
    ],
    [
        '/Lotus/Language/Items/StaffName',
        '/Lotus/Language/Items/SemiAutoRifleName',
        '/Lotus/Language/Items/AutoPistolName',
        '/Lotus/Language/Items/FistName',
        '/Lotus/Language/Items/ShotgunName',
    ],
    [
        '/Lotus/Language/Locations/Lex',
        '/Lotus/Language/Items/PaladinMaceName',
        '/Lotus/Language/Items/BoltoRifleName',
        '/Lotus/Language/Items/HandCannonName',
        '/Lotus/Language/Items/CeramicDaggerName',
    ],
    [
        '/Lotus/Language/ClanTech/Torid',
        '/Lotus/Language/Items/InfestedLexName',
        '/Lotus/Language/Weapons/InfestedDualAxeName',
        '/Lotus/Language/Items/GrineerSawbladeGunName',
        '/Lotus/Language/Items/GrnHeatGunName',
    ],
    [
        '/Lotus/Language/Items/RegorAxeShieldName',
        '/Lotus/Language/Items/TennoAssaultRifleName',
        '/Lotus/Language/Items/TennoRevolverName',
        '/Lotus/Language/Items/NamiSoloName',
        '/Lotus/Language/Items/BurstRifleName',
    ],
    [
        '/Lotus/Language/Weapons/SybarisPistolName',
        '/Lotus/Language/Items/IceHammerName',
        '/Lotus/Language/Items/StalkerBowName',
        '/Lotus/Language/Items/StalkerKunaiName',
        '/Lotus/Language/Items/StalkerScytheName',
    ],
    [
        '/Lotus/Language/Items/EnergyRifleName',
        '/Lotus/Language/Items/TennoLeverActionRifleName',
        '/Lotus/Language/Items/CorpusMinigunName',
        '/Lotus/Language/Items/BurstPistolName',
        '/Lotus/Language/Items/TennoSaiName',
    ],
    [
        '/Lotus/Language/Items/TennoSniperRifleName',
        '/Lotus/Language/Items/GrineerGooGunName',
        '/Lotus/Language/Items/AutoCrossBowName',
        '/Lotus/Language/Items/TnoRapierName',
        '/Lotus/Language/Items/CorpusPunchKickWeaponName',
    ],
    [
        '/Lotus/Language/Items/RifleName',
        '/Lotus/Language/Items/PistolName',
        '/Lotus/Language/Items/LongSwordName',
        '/Lotus/Language/Items/HuntingBowName',
        '/Lotus/Language/Items/KunaiName',
    ],
];
function formatWeekDate(ms) {
    return new Date(ms).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}
function choicesToDisplay(choices, dict) {
    return choices.map(key => dict[key] ?? key).join(' · ');
}
export function getForecastWeekCount() {
    return Math.max(FRAME_CHOICES.length, WEAPON_CHOICES.length);
}
export function renderCircuitForecastTable(tbody, dict) {
    const currentWeek = Math.trunc((Date.now() - CIRCUIT_EPOCH_MS) / MS_PER_WEEK);
    const weekCount = getForecastWeekCount();
    tbody.innerHTML = '';
    for (let i = 0; i < weekCount; i++) {
        const week = currentWeek + i;
        const weekStartMs = CIRCUIT_EPOCH_MS + (week * MS_PER_WEEK);
        const tr = document.createElement('tr');
        const dateTd = document.createElement('td');
        dateTd.textContent = formatWeekDate(weekStartMs);
        tr.append(dateTd);
        const normalTd = document.createElement('td');
        normalTd.textContent = choicesToDisplay(FRAME_CHOICES[week % FRAME_CHOICES.length], dict);
        tr.append(normalTd);
        const steelPathTd = document.createElement('td');
        steelPathTd.textContent = choicesToDisplay(WEAPON_CHOICES[week % WEAPON_CHOICES.length], dict);
        tr.append(steelPathTd);
        tbody.append(tr);
    }
}
//# sourceMappingURL=index.js.map