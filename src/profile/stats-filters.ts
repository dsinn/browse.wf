/**
 * Equipment and enemy category filter definitions for the profile Stats tab.
 *
 * Icon paths are resolved via ExportImages (warframe-public-export-plus) using
 * the same CDN lookup as setImageSource() in common.js.
 */

import {addTooltip} from '../tooltip.js';

/** Maps productCategory values (from ExportWeapons/ExportWarframes/ExportSentinels) to display metadata. */
export const EQUIPMENT_CATEGORIES: Record<string, {tooltip: string; icon: string; displayText?: string}> = {
	Suits: {tooltip: 'Warframes', icon: '/Lotus/Interface/Icons/StoreIcons/Warframes/Excalibur.png'},
	LongGuns: {tooltip: 'Primary', icon: '/Lotus/Interface/Icons/StoreIcons/Weapons/PrimaryWeapons/Weapons/Braton.png'},
	Pistols: {tooltip: 'Secondary', icon: '/Lotus/Interface/Icons/StoreIcons/Weapons/SecondaryWeapons/Weapons/LexPrime.png'},
	Melee: {tooltip: 'Melee', icon: '/Lotus/Interface/Icons/StoreIcons/Weapons/MeleeWeapons/Weapons/Hate.png'},
	SpaceSuits: {tooltip: 'Archwing', icon: '/Lotus/Interface/Icons/StoreIcons/Archwing/Archwings/Amesha.png'},
	MechSuits: {tooltip: 'Mech', icon: '/Lotus/Interface/Icons/StoreIcons/Mech/NechroMech.png'},
	Sentinels: {tooltip: 'Sentinel', icon: '/Lotus/Interface/Icons/StoreIcons/Companions/Sentinels/Types/Dethcube.png'},
	KubrowPets: {tooltip: 'Companion', icon: '/Lotus/Interface/Icons/StoreIcons/Companions/Pets/Kubrow/Breed/KubrowBreedRaksa.png'},
	MoaPets: {tooltip: 'MOA Companion', icon: '/Lotus/Interface/Icons/StoreIcons/Companions/Moas/MoaHeadB.png'},
	SpaceGuns: {tooltip: 'Arch-Gun', icon: '/Lotus/Interface/Icons/StoreIcons/Weapons/HeavyWeapons/ShieldFrameArchGun.png'},
	SpaceMelee: {tooltip: 'Arch-Melee', icon: '/Lotus/Interface/Icons/StoreIcons/Archwing/Weapons/Rathbone.png'},
	SentinelWeapons: {tooltip: 'Sentinel Weapon', icon: '/Lotus/Interface/Icons/StoreIcons/Weapons/SentinelWeapons/LaserRifle.png'},
	DrifterMelee: {tooltip: 'Drifter Melee', icon: '/Lotus/Interface/Icons/StoreIcons/Weapons/MeleeWeapons/Weapons/DaxDuviriMaceShieldWeapon.png'},
	OperatorAmps: {tooltip: 'Drifter Amp', icon: '/Lotus/Interface/Icons/StoreIcons/Weapons/SecondaryWeapons/Weapons/DrifterPistol.png'},
	SpecialItems: {tooltip: 'Special', icon: '', displayText: '🤷‍♀️'},
};

/**
 * Maps faction strings (from ExportEnemies.avatars[x].faction) to display metadata.
 * Multiple source faction strings may map to the same display bucket.
 */
export const ENEMY_FACTIONS: Array<{tooltip: string; icon: string; factions: string[]}> = [
	{tooltip: 'Grineer', icon: '/Lotus/Interface/Icons/Player/FactionGrineer.png', factions: ['Grineer']},
	{tooltip: 'Corpus', icon: '/Lotus/Interface/Icons/Player/FactionCorpus.png', factions: ['Corpus']},
	{tooltip: 'Infested', icon: '/Lotus/Interface/Icons/Player/FactionInfested.png', factions: ['Infestation', 'Infested']},
	{tooltip: 'Orokin', icon: '/Lotus/Interface/Icons/Player/FactionOrokin.png', factions: ['Orokin', 'Orokin Empire', 'OrokinEmpire']},
	{tooltip: 'Sentient', icon: '/Lotus/Interface/Icons/SentientFactionIcon.png', factions: ['Sentient']},
	{tooltip: 'Narmer', icon: '/Lotus/Interface/Icons/Player/NarmerEyeGlyph.png', factions: ['Narmer', 'NarmerVeil']},
	{tooltip: 'Murmur', icon: '/Lotus/Interface/Icons/Player/FactionMurmur.png', factions: ['MITW']},
	{tooltip: 'Scaldra', icon: '/Lotus/Interface/Icons/Player/FactionScaldra.png', factions: ['Scaldra']},
	{tooltip: 'Techrot', icon: '/Lotus/Interface/Icons/Player/FactionTechrot.png', factions: ['Techrot']},
	{tooltip: 'Duviri', icon: '/Lotus/Interface/Graphics/StartingZoneChoice/DuviriStartingZoneIconParadox.png', factions: ['Duviri']},
	{tooltip: 'Stalker', icon: '/Lotus/Interface/Icons/MarkedForDeathStalker.png', factions: ['Stalker']},
];

/** Returns the display tooltip for a productCategory, or undefined if unrecognised. */
export function getEquipmentCategoryLabel(productCategory: string): string | undefined {
	return EQUIPMENT_CATEGORIES[productCategory]?.tooltip;
}

/** Returns the faction bucket tooltip for an avatar faction string, or undefined if unrecognised. */
export function getEnemyFactionLabel(faction: string): string | undefined {
	for (const bucket of ENEMY_FACTIONS) {
		if (bucket.factions.includes(faction)) {
			return bucket.tooltip;
		}
	}

	return undefined;
}

/**
 * Renders a filter bar and wires up filtering for a stats table.
 *
 * @param filterBar  - The <div> that will receive the filter buttons.
 * @param tbody      - The <tbody> whose rows carry data-category attributes.
 * @param entries    - Ordered list of { key, tooltip, icon } to show as buttons.
 *                     key must match the data-category values on the rows.
 *                     icon is a Warframe asset path resolved via setImageSource;
 *                     pass an empty string to fall back to displayText.
 * @param presentKeys - Set of category keys that actually appear in the tbody,
 *                      used to skip buttons for absent categories.
 * @param onFilter    - Optional callback invoked after each filter change,
 *                      including when "All" is selected.
 */
export function initStatsFilterBar(
	filterBar: HTMLElement,
	tbody: HTMLElement,
	entries: Array<{key: string; tooltip: string; icon: string; displayText?: string}>,
	presentKeys: Set<string>,
	onFilter?: () => void,
): void {
	filterBar.innerHTML = '';
	delete tbody.dataset.filter;

	const applyFilter = (filter: string) => {
		if (filter) {
			tbody.dataset.filter = filter;
		} else {
			delete tbody.dataset.filter;
		}

		for (const btn of filterBar.querySelectorAll<HTMLButtonElement>('.stats-filter-btn')) {
			btn.classList.toggle('active', btn.dataset.filter === filter);
		}

		onFilter?.();
	};

	// "All" button
	const allBtn = document.createElement('button');
	allBtn.className = 'stats-filter-btn active';
	allBtn.dataset.filter = '';
	const emoji = document.createElement('span');
	emoji.className = 'filter-emoji';
	emoji.textContent = '∞';
	allBtn.append(emoji);
	allBtn.addEventListener('click', () => {
		applyFilter('');
	});
	filterBar.append(allBtn);
	addTooltip(allBtn, 'All');

	for (const {key, tooltip, icon, displayText} of entries) {
		if (!presentKeys.has(key)) {
			continue;
		}

		const btn = document.createElement('button');
		btn.className = 'stats-filter-btn';
		btn.dataset.filter = key;
		if (icon) {
			const img = document.createElement('img');
			img.alt = tooltip;
			(globalThis as any).setImageSource(img, icon);
			btn.append(img);
		} else {
			const span = document.createElement('span');
			span.className = 'filter-emoji';
			span.textContent = displayText ?? tooltip;
			btn.append(span);
		}

		btn.addEventListener('click', () => {
			applyFilter(tbody.dataset.filter === key ? '' : key);
		});
		filterBar.append(btn);
		addTooltip(btn, tooltip);
	}
}

(globalThis as any).EQUIPMENT_CATEGORIES = EQUIPMENT_CATEGORIES;
(globalThis as any).ENEMY_FACTIONS = ENEMY_FACTIONS;
(globalThis as any).getEquipmentCategoryLabel = getEquipmentCategoryLabel;
(globalThis as any).getEnemyFactionLabel = getEnemyFactionLabel;
(globalThis as any).initStatsFilterBar = initStatsFilterBar;
