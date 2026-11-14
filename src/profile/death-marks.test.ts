import {
	describe,
	it,
	expect,
	beforeEach,
	afterEach,
	vi,
} from 'vitest';
import {mockBootstrapTooltip} from '@test/helpers/dom-helpers';
import {describeMarkingBoss, getDeathMarks, renderDeathMarks} from './death-marks';

const bosses = '/Lotus/Language/Bosses/';
const dict = {
	'/Lotus/Language/Game/Stalker': 'Stalker',
	'/Lotus/Language/Game/ZanukaHunter': 'Zanuka Hunter',
	[`${bosses}BossTheRaptor`]: 'The Raptor',
};

describe('describeMarkingBoss', () => {
	it('uses the translation when there is one', () => {
		expect(describeMarkingBoss(`${bosses}BossTheRaptor`, dict)).toBe('The Raptor');
	});

	it('finds the in-game names of the Hyenas, whose keys are named differently', () => {
		const hyenas = {
			'/Lotus/Language/Game/HyenaElecName': 'Hyena TH',
			'/Lotus/Language/Game/HyenaFireName': 'Hyena NG',
			'/Lotus/Language/Game/HyenaGunName': 'Hyena PB',
			'/Lotus/Language/Game/HyenaIceName': 'Hyena LN2',
		};

		expect(['Electric', 'Fire', 'Gun', 'Ice'].map(type => describeMarkingBoss(`${bosses}BossHyena${type}`, hyenas)))
			.toEqual(['Hyena TH', 'Hyena NG', 'Hyena PB', 'Hyena LN2']);
	});

	it('finds names in the game\'s own strings, with or without the "Boss" prefix', () => {
		const game = {
			'/Lotus/Language/Game/CaptainVor': 'Captain Vor',
			'/Lotus/Language/Game/SargasRuk': 'General Sargas Ruk',
			'/Lotus/Language/Game/QuadRobot': 'Jackal',
			'/Lotus/Language/Game/BossAmbulas': 'Ambulas',
			'/Lotus/Language/Game/GolemBossFull': 'Lephantis',
			'/Lotus/Language/Game/JuniorGolemName': 'Jordas Golem',
		};

		expect(describeMarkingBoss(`${bosses}BossCaptainVor`, game)).toBe('Captain Vor');
		expect(describeMarkingBoss(`${bosses}BossGeneralSargasRuk`, game)).toBe('General Sargas Ruk');
		expect(describeMarkingBoss(`${bosses}BossTheJackal`, game)).toBe('Jackal');
		expect(describeMarkingBoss(`${bosses}BossAmbulas`, game)).toBe('Ambulas');
		expect(describeMarkingBoss(`${bosses}BossLephantis`, game)).toBe('Lephantis');
		expect(describeMarkingBoss(`${bosses}BossJ3Golem`, game)).toBe('Jordas Golem');
	});

	it('otherwise splits the key into words, without its "Boss" prefix', () => {
		expect(describeMarkingBoss(`${bosses}BossHyenaFire`, dict)).toBe('Hyena Fire');
		expect(describeMarkingBoss(`${bosses}BossGeneralSargasRuk`)).toBe('General Sargas Ruk');
	});
});

describe('getDeathMarks', () => {
	it('shows the Stalker when there are death marks, naming the bosses that marked the player', () => {
		const [mark] = getDeathMarks({DeathMarks: [`${bosses}BossTheRaptor`, `${bosses}BossHyenaFire`]}, dict);

		expect(mark.name).toBe('Stalker');
		expect(mark.tooltip).toBe('Marked by killing: Hyena Fire, The Raptor');
	});

	it('lists the bosses alphabetically, ignoring a leading "The"', () => {
		const names = {
			...dict,
			[`${bosses}BossTylRegor`]: 'Tyl Regor',
			[`${bosses}BossAmbulas`]: 'Ambulas',
		};
		const [mark] = getDeathMarks({DeathMarks: [`${bosses}BossTylRegor`, `${bosses}BossTheRaptor`, `${bosses}BossAmbulas`]}, names);

		expect(mark.tooltip).toBe('Marked by killing: Ambulas, The Raptor, Tyl Regor');
	});

	it('shows the Zanuka Hunter only while Harvestable is true', () => {
		expect(getDeathMarks({Harvestable: true}, dict).map(mark => mark.name)).toEqual(['Zanuka Hunter']);
		expect(getDeathMarks({Harvestable: false}, dict)).toEqual([]);
	});

	it('shows the Grustrag Three only while DeathSquadable is true', () => {
		expect(getDeathMarks({DeathSquadable: true}, dict).map(mark => mark.name)).toEqual(['The Grustrag Three']);
		expect(getDeathMarks({DeathSquadable: false}, dict)).toEqual([]);
	});

	it('gives each hunter its sigil', () => {
		const marks = getDeathMarks({DeathMarks: [`${bosses}BossPhorid`], Harvestable: true, DeathSquadable: true}, dict);

		expect(marks.map(mark => mark.icon)).toEqual([
			'/Lotus/Interface/Icons/MarkedForDeathStalker.png',
			'/Lotus/Interface/Icons/MarkedForDeathZanuka.png',
			'/Lotus/Interface/Icons/MarkedForDeathGrustrag.png',
		]);
	});

	it('shows nothing when none of the fields are set, or the list of marks is empty', () => {
		expect(getDeathMarks({}, dict)).toEqual([]);
		expect(getDeathMarks({DeathMarks: []}, dict)).toEqual([]);
		expect(getDeathMarks(undefined, dict)).toEqual([]);
	});

	it('lists every mark, in the order Stalker, Zanuka Hunter, Grustrag Three', () => {
		const marks = getDeathMarks({DeathSquadable: true, Harvestable: true, DeathMarks: [`${bosses}BossPhorid`]}, dict);

		expect(marks.map(mark => mark.name)).toEqual(['Stalker', 'Zanuka Hunter', 'The Grustrag Three']);
	});
});

describe('renderDeathMarks', () => {
	beforeEach(() => {
		mockBootstrapTooltip();
		(globalThis as any).dict = dict;
		document.body.innerHTML = '<p id="marks" class="d-none"><b>Marked by:</b> <span></span></p>';
	});

	afterEach(() => {
		Reflect.deleteProperty(window, 'setImageSource');
	});

	const paragraph = () => document.querySelector<HTMLElement>('#marks')!;

	it('shows the marks, comma separated, and reveals the line', () => {
		renderDeathMarks({Results: [{DeathMarks: [`${bosses}BossPhorid`], DeathSquadable: true}]});

		expect(paragraph().classList.contains('d-none')).toBe(false);
		expect(paragraph().textContent).toBe('Marked by: Stalker, The Grustrag Three');
	});

	it('puts each hunter\'s sigil before their name', () => {
		const setImageSource = vi.fn((img: HTMLImageElement, icon: string) => {
			img.dataset.icon = icon;
		});
		window.setImageSource = setImageSource;
		renderDeathMarks({Results: [{Harvestable: true, DeathSquadable: true}]});

		const icons = [...paragraph().querySelectorAll<HTMLImageElement>('img.mark-icon')];
		expect(icons.map(icon => icon.dataset.icon)).toEqual([
			'/Lotus/Interface/Icons/MarkedForDeathZanuka.png',
			'/Lotus/Interface/Icons/MarkedForDeathGrustrag.png',
		]);
		expect(icons[0].nextSibling?.textContent).toBe('Zanuka Hunter');
		expect(icons[0].alt).toBe('');
	});

	it('gives the Stalker a tooltip listing the bosses', () => {
		renderDeathMarks({Results: [{DeathMarks: [`${bosses}BossTheRaptor`]}]});

		expect(paragraph().querySelector<HTMLElement>('.has-tooltip')?.dataset.bsTitle).toBe('Marked by killing: The Raptor');
	});

	it('hides the line when nothing is marking the player, and clears an earlier one', () => {
		renderDeathMarks({Results: [{DeathSquadable: true}]});
		renderDeathMarks({Results: [{Harvestable: false, DeathSquadable: false}]});

		expect(paragraph().classList.contains('d-none')).toBe(true);
		expect(paragraph().querySelector('span')?.textContent).toBe('');
	});

	it('does nothing when the page has no such line', () => {
		document.body.replaceChildren();

		expect(() => {
			renderDeathMarks({Results: [{DeathSquadable: true}]});
		}).not.toThrow();
	});
});
