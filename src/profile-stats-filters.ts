/**
 * Equipment and enemy category filter definitions for the profile Stats tab.
 *
 * Icon paths are resolved via ExportImages (warframe-public-export-plus) using
 * the same CDN lookup as setImageSource() in common.js.
 */

import {addTooltip} from './tooltip.js';

/** Maps productCategory values (from ExportWeapons/ExportWarframes/ExportSentinels) to display metadata. */
export const EQUIPMENT_CATEGORIES: Record<string, {label: string; icon: string}> = {
	Suits: {label: 'Warframes', icon: '/Lotus/Interface/Icons/StoreIcons/Warframes/Excalibur.png'},
	LongGuns: {label: 'Primary', icon: '/Lotus/Interface/Icons/StoreIcons/Weapons/PrimaryWeapons/Weapons/Braton.png'},
	Pistols: {label: 'Secondary', icon: '/Lotus/Interface/Icons/StoreIcons/Weapons/SecondaryWeapons/Weapons/LexPrime.png'},
	Melee: {label: 'Melee', icon: '/Lotus/Interface/Icons/StoreIcons/Weapons/MeleeWeapons/Weapons/Hate.png'},
	SpaceSuits: {label: 'Archwing', icon: '/Lotus/Interface/Icons/StoreIcons/Archwing/Archwings/Amesha.png'},
	MechSuits: {label: 'Mech', icon: '/Lotus/Interface/Icons/StoreIcons/Mech/NechroMech.png'},
	Sentinels: {label: 'Sentinel', icon: '/Lotus/Interface/Icons/StoreIcons/Companions/Sentinels/Types/Dethcube.png'},
	KubrowPets: {label: 'Companion', icon: '/Lotus/Interface/Icons/StoreIcons/Companions/Pets/Kubrow/Breed/KubrowBreedRaksa.png'},
	MoaPets: {label: 'MOA Companion', icon: '/Lotus/Interface/Icons/StoreIcons/Companions/Moas/MoaHeadB.png'},
	SpaceGuns: {label: 'Arch-Gun', icon: '/Lotus/Interface/Icons/StoreIcons/Weapons/HeavyWeapons/ShieldFrameArchGun.png'},
	SpaceMelee: {label: 'Arch-Melee', icon: '/Lotus/Interface/Icons/StoreIcons/Archwing/Weapons/Rathbone.png'},
	SentinelWeapons: {label: 'Sentinel Weapon', icon: '/Lotus/Interface/Icons/StoreIcons/Weapons/SentinelWeapons/LaserRifle.png'},
	DrifterMelee: {label: 'Drifter Melee', icon: '/Lotus/Interface/Icons/StoreIcons/Weapons/MeleeWeapons/Weapons/DaxDuviriMaceShieldWeapon.png'},
	OperatorAmps: {label: 'Drifter Amp', icon: '/Lotus/Interface/Icons/StoreIcons/Weapons/SecondaryWeapons/Weapons/DrifterPistol.png'},
	SpecialItems: {label: '🤷‍♀️', icon: ''},
};

/**
 * Maps faction strings (from ExportEnemies.avatars[x].faction) to display metadata.
 * Multiple source faction strings may map to the same display bucket.
 */
export const ENEMY_FACTIONS: Array<{label: string; icon: string; factions: string[]}> = [
	{label: 'Grineer', icon: '/Lotus/Interface/Icons/Player/FactionGrineer.png', factions: ['Grineer']},
	{label: 'Corpus', icon: '/Lotus/Interface/Icons/Player/FactionCorpus.png', factions: ['Corpus']},
	{label: 'Infested', icon: '/Lotus/Interface/Icons/Player/FactionInfested.png', factions: ['Infestation', 'Infested']},
	{label: 'Orokin', icon: '/Lotus/Interface/Icons/Player/FactionOrokin.png', factions: ['Orokin', 'Orokin Empire', 'OrokinEmpire']},
	{label: 'Sentient', icon: '/Lotus/Interface/Icons/SentientFactionIcon.png', factions: ['Sentient']},
	{label: 'Narmer', icon: '/Lotus/Interface/Icons/Player/NarmerEyeGlyph.png', factions: ['Narmer', 'NarmerVeil']},
	{label: 'Murmur', icon: '/Lotus/Interface/Icons/Player/FactionMurmur.png', factions: ['MITW']},
	{label: 'Scaldra', icon: '/Lotus/Interface/Icons/Player/FactionScaldra.png', factions: ['Scaldra']},
	{label: 'Techrot', icon: '/Lotus/Interface/Icons/Player/FactionTechrot.png', factions: ['Techrot']},
	{label: 'Duviri', icon: '/Lotus/Interface/Graphics/StartingZoneChoice/DuviriStartingZoneIconParadox.png', factions: ['Duviri']},
	{label: 'Stalker', icon: '/Lotus/Interface/Icons/MarkedForDeathStalker.png', factions: ['Stalker']},
];

/** Returns the display label for a productCategory, or null if unrecognised. */
export function getEquipmentCategoryLabel(productCategory: string): string | undefined {
	return EQUIPMENT_CATEGORIES[productCategory]?.label;
}

/** Returns the faction bucket label for an avatar faction string, or null if unrecognised. */
export function getEnemyFactionLabel(faction: string): string | undefined {
	for (const bucket of ENEMY_FACTIONS) {
		if (bucket.factions.includes(faction)) {
			return bucket.label;
		}
	}

	return undefined;
}

/**
 * Renders a filter bar and wires up filtering for a stats table.
 *
 * @param filterBar  - The <div> that will receive the filter buttons.
 * @param tbody      - The <tbody> whose rows carry data-category attributes.
 * @param entries    - Ordered list of { key, label, icon } to show as buttons.
 *                     key must match the data-category values on the rows.
 *                     icon is a Warframe asset path resolved via setImageSource;
 *                     pass an empty string to fall back to a text label.
 * @param presentKeys - Set of category keys that actually appear in the tbody,
 *                      used to skip buttons for absent categories.
 * @param onFilter    - Optional callback invoked after each filter change,
 *                      including when "All" is selected.
 */
export function initStatsFilterBar(
	filterBar: HTMLElement,
	tbody: HTMLElement,
	entries: Array<{key: string; label: string; icon: string}>,
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
	emoji.textContent = '♾️';
	allBtn.append(emoji);
	allBtn.addEventListener('click', () => {
		applyFilter('');
	});
	filterBar.append(allBtn);
	addTooltip(allBtn, 'All');

	for (const {key, label, icon} of entries) {
		if (!presentKeys.has(key)) {
			continue;
		}

		const btn = document.createElement('button');
		btn.className = 'stats-filter-btn';
		btn.dataset.filter = key;
		if (icon) {
			const img = document.createElement('img');
			img.alt = label;
			(globalThis as any).setImageSource(img, icon);
			btn.append(img);
		} else {
			const span = document.createElement('span');
			span.className = 'filter-emoji';
			span.textContent = label;
			btn.append(span);
		}

		btn.addEventListener('click', () => {
			applyFilter(tbody.dataset.filter === key ? '' : key);
		});
		filterBar.append(btn);
		addTooltip(btn, label);
	}
}

(globalThis as any).EQUIPMENT_CATEGORIES = EQUIPMENT_CATEGORIES;
(globalThis as any).ENEMY_FACTIONS = ENEMY_FACTIONS;
(globalThis as any).getEquipmentCategoryLabel = getEquipmentCategoryLabel;
(globalThis as any).getEnemyFactionLabel = getEnemyFactionLabel;
(globalThis as any).initStatsFilterBar = initStatsFilterBar;
