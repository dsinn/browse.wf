import {
	describe,
	it,
	expect,
	beforeEach,
} from 'vitest';
import {mockBootstrapTooltip, loadCommonJsFunctions} from '@test/helpers/dom-helpers';
import {loadExportJson} from '@test/helpers/api-mocks';
import {exportCache} from '../public-export-fetcher';
import {
	buildAbilityInfoMap,
	classifyAbilityPath,
	getAbilitySortKey,
	renderAbilityStats,
} from './ability-stats';

const ExportImages = loadExportJson('ExportImages.json');

const translations: Record<string, string> = {
	'/Lotus/Language/Frames/Mirage': 'Mirage',
	'/Lotus/Language/Frames/MiragePrime': 'Mirage Prime',
	'/Lotus/Language/Frames/Odonata': '<ARCHWING> Odonata',
	'/Lotus/Language/Abilities/HallOfMirrors': 'Hall of Mirrors',
	'/Lotus/Language/Abilities/SleightOfHand': 'Sleight of Hand',
	'/Lotus/Language/Abilities/Eclipse': 'Eclipse',
	'/Lotus/Language/Abilities/Prism': 'Prism',
	'/Lotus/Language/Abilities/Transference': 'Transference',
	'/Lotus/Language/Abilities/Blink': 'Blink',
};

const miragePaths = [
	'/Lotus/Powersuits/Harlequin/Abilities/IllusionAbility',
	'/Lotus/Powersuits/Harlequin/Abilities/SleightAbility',
	'/Lotus/Powersuits/Harlequin/Abilities/LightAbility',
	'/Lotus/Powersuits/Harlequin/Abilities/PrismAbility',
];
const mirageAbilities = [
	{uniqueName: miragePaths[0], name: '/Lotus/Language/Abilities/HallOfMirrors'},
	{uniqueName: miragePaths[1], name: '/Lotus/Language/Abilities/SleightOfHand'},
	{uniqueName: miragePaths[2], name: '/Lotus/Language/Abilities/Eclipse'},
	{uniqueName: miragePaths[3], name: '/Lotus/Language/Abilities/Prism'},
];

const mockExportWarframes: Record<string, any> = {
	// Listed with the Prime variant first on purpose: the base name should still win
	'/Lotus/Powersuits/Harlequin/HarlequinPrime': {name: '/Lotus/Language/Frames/MiragePrime', productCategory: 'Suits', abilities: mirageAbilities},
	'/Lotus/Powersuits/Harlequin/Harlequin': {name: '/Lotus/Language/Frames/Mirage', productCategory: 'Suits', abilities: mirageAbilities},
	'/Lotus/Powersuits/Archwing/Odonata': {
		name: '/Lotus/Language/Frames/Odonata',
		productCategory: 'SpaceSuits',
		abilities: [{uniqueName: '/Lotus/Powersuits/Archwing/ArchwingAbilities/FireShieldAbility'}],
	},
	'/Lotus/Powersuits/Excalibur/Excalibur': {name: '/Lotus/Language/Frames/Excalibur', productCategory: 'Suits'},
};

const mockExportAbilities: Record<string, any> = {
	'/Lotus/Powersuits/PowersuitAbilities/OperatorTransferenceAbility': {name: '/Lotus/Language/Abilities/Transference'},
	'/Lotus/Powersuits/PowersuitAbilities/HelminthEfficiencyAbility': {name: '/Lotus/Language/Abilities/Efficiency'},
};

function translate(key: string | undefined) {
	return key ? translations[key] : undefined;
}

describe('classifyAbilityPath', () => {
	it.each([
		['/Lotus/Powersuits/Archwing/ArchwingAbilities/BlinkAbility', 'Archwing'],
		['/Lotus/Powersuits/PowersuitAbilities/OperatorDefenseAbility', 'Operator'],
		['/Lotus/Powersuits/PowersuitAbilities/HelminthStunAbility', 'Helminth'],
		['/Lotus/Powersuits/PowersuitAbilities/DuviriDrifterHealAbility', 'Drifter'],
		['/Lotus/Types/Game/CrewShip/Ships/Abilities/CrewShipEMPAbility', 'Railjack'],
		['/Lotus/Powersuits/Stalker/Abilities/StalkerStunAbility', 'Other'],
	])('puts %s in %s', (path, category) => {
		expect(classifyAbilityPath(path)).toBe(category);
	});
});

describe('buildAbilityInfoMap', () => {
	const infoMap = buildAbilityInfoMap(mockExportWarframes, mockExportAbilities, translate);

	it('records the slot of each ability from its position in the Warframe\'s list', () => {
		expect(miragePaths.map(path => infoMap.get(path)?.slot)).toEqual([0, 1, 2, 3]);
	});

	it('names the ability from the Warframe\'s own ability list', () => {
		expect(miragePaths.map(path => infoMap.get(path)?.name)).toEqual(['Hall of Mirrors', 'Sleight of Hand', 'Eclipse', 'Prism']);
	});

	it('attributes an ability shared by variants to the shortest variant name', () => {
		expect(infoMap.get(miragePaths[0])?.owner).toBe('Mirage');
	});

	it('categorizes Archwings and strips their name prefix', () => {
		expect(infoMap.get('/Lotus/Powersuits/Archwing/ArchwingAbilities/FireShieldAbility')).toMatchObject({owner: 'Odonata', category: 'Archwing', slot: 0});
	});

	it('attributes abilities outside the Warframe lists by category, without a slot', () => {
		expect(infoMap.get('/Lotus/Powersuits/PowersuitAbilities/OperatorTransferenceAbility')).toEqual({
			owner: 'Operator', category: 'Operator', name: 'Transference',
		});
		expect(infoMap.get('/Lotus/Powersuits/PowersuitAbilities/HelminthEfficiencyAbility')).toMatchObject({owner: 'Helminth', category: 'Helminth'});
	});
});

describe('getAbilitySortKey', () => {
	it('sorts a Warframe\'s abilities by slot, not by name', () => {
		const infoMap = buildAbilityInfoMap(mockExportWarframes, mockExportAbilities, translate);
		const keys = miragePaths.map(path => getAbilitySortKey(infoMap.get(path)!, 'ignored'));

		expect(keys).toEqual(['Mirage 1', 'Mirage 2', 'Mirage 3', 'Mirage 4']);
		expect([...keys].sort((a, b) => a.localeCompare(b, undefined, {numeric: true}))).toEqual(keys);
	});

	it('sorts abilities without a slot by owner and then name', () => {
		expect(getAbilitySortKey({owner: 'Operator', category: 'Operator'}, 'Transference')).toBe('Operator Transference');
	});
});

describe('renderAbilityStats', () => {
	const profile = {
		Stats: {
			Abilities: [
				{type: miragePaths[3], used: 40},
				{type: '/Lotus/Powersuits/PowersuitAbilities/OperatorTransferenceAbility', used: 5000},
				{type: miragePaths[0], used: 300},
				{type: '/Lotus/Powersuits/Stalker/Abilities/StalkerStunAbility', used: 7},
			],
		},
	};

	function rows() {
		return [...document.querySelectorAll<HTMLTableRowElement>('#ability-stats tr')];
	}

	beforeEach(() => {
		mockBootstrapTooltip();
		(globalThis as any).ExportImages = ExportImages;
		(globalThis as any).dict = translations;
		exportCache.set('ExportWarframes', Promise.resolve(mockExportWarframes));
		exportCache.set('ExportAbilities', Promise.resolve(mockExportAbilities));
		loadCommonJsFunctions(['setImageSource', 'addTooltip']);
		document.body.innerHTML = `
			<div id="ability-filter-bar"></div>
			<table><tbody id="ability-stats"></tbody></table>
		`;
	});

	it('lists abilities by casts, most first, with sequential ranks', async () => {
		await renderAbilityStats(profile);

		expect(rows().map(row => row.cells[3].textContent)).toEqual([
			(5000).toLocaleString(), (300).toLocaleString(), (40).toLocaleString(), (7).toLocaleString(),
		]);
		expect(rows().map(row => row.cells[0].textContent)).toEqual(['1', '2', '3', '4']);
	});

	it('shows the slot as a keycap emoji with an accessible label', async () => {
		await renderAbilityStats(profile);

		const slot = rows()[1].querySelector<HTMLElement>('.ability-slot');
		expect(slot?.textContent).toBe('1️⃣');
		expect(slot?.getAttribute('aria-label')).toBe('Ability 1');
		expect(rows()[2].querySelector('.ability-slot')?.textContent).toBe('4️⃣');
	});

	it('sorts the Warframe column by slot, and the Ability column by name, without the emoji', async () => {
		await renderAbilityStats(profile);

		const [transference, hallOfMirrors, prism] = [rows()[0], rows()[1], rows()[2]];
		expect(hallOfMirrors.cells[1].dataset.sort).toBe('Mirage 1');
		expect(prism.cells[1].dataset.sort).toBe('Mirage 4');
		expect(transference.cells[1].dataset.sort).toBe('Operator Transference');
		expect(hallOfMirrors.cells[2].dataset.sort).toBe('Hall of Mirrors');
	});

	it('shows abilities with no known name by internal name, in teletype', async () => {
		await renderAbilityStats(profile);

		const code = rows()[3].querySelector<HTMLElement>('code.internal-name');
		expect(code?.textContent).toBe('StalkerStunAbility');
		expect(code?.dataset.bsTitle).toBe('/Lotus/Powersuits/Stalker/Abilities/StalkerStunAbility');
	});

	it('categorizes each row and offers a filter button for each category present', async () => {
		await renderAbilityStats(profile);

		expect(rows().map(row => row.dataset.category)).toEqual(['Operator', 'Warframe', 'Warframe', 'Other']);
		const filters = [...document.querySelectorAll<HTMLElement>('#ability-filter-bar button')].map(button => button.dataset.filter);
		expect(filters).toEqual(['', 'Warframe', 'Operator', 'Other']);
	});

	it('keeps the Operator and Drifter filter buttons next to each other', async () => {
		const withDrifter = {
			Stats: {
				Abilities: [
					...profile.Stats.Abilities,
					{type: '/Lotus/Powersuits/PowersuitAbilities/DuviriDrifterHealAbility', used: 3},
					{type: '/Lotus/Powersuits/PowersuitAbilities/HelminthStunAbility', used: 2},
				],
			},
		};
		await renderAbilityStats(withDrifter);

		const filters = [...document.querySelectorAll<HTMLElement>('#ability-filter-bar button')].map(button => button.dataset.filter);
		expect(filters).toEqual(['', 'Warframe', 'Operator', 'Drifter', 'Helminth', 'Other']);
	});

	it('shows no rows and no filters when there are no abilities', async () => {
		await renderAbilityStats({Stats: {}});

		expect(rows()).toHaveLength(0);
		expect(document.querySelector('#ability-filter-bar button')).toBeNull();
	});

	it('replaces the previous rows when rendered again', async () => {
		await renderAbilityStats(profile);
		await renderAbilityStats(profile);

		expect(rows()).toHaveLength(4);
	});
});
