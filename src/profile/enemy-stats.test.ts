import {
	describe, it, expect, beforeEach,
} from 'vitest';
import {mockBootstrapTooltip, loadCommonJsFunctions} from '@test/helpers/dom-helpers';
import {loadExportJson} from '@test/helpers/api-mocks';
import {augmentEnemyStats} from './enemy-stats';

const ExportImages = loadExportJson('ExportImages.json');

const mockExportEnemies = {
	avatars: {
		'/Lotus/Types/Enemies/Grineer/GrineerLancer': {name: '/Lotus/Language/Enemies/GrineerLancer', faction: 'Grineer'},
		'/Lotus/Types/Enemies/Corpus/CorpusCrewman': {name: '/Lotus/Language/Enemies/CorpusCrewman', faction: 'Corpus'},
		'/Lotus/Types/Enemies/Infested/InfectedRunner': {name: '/Lotus/Language/Enemies/InfectedRunner', faction: 'Infestation'},
	},
};

// Sorted descending by kills, matching what upstream renderProfile() does
const mockProfile = {
	Stats: {
		Enemies: [
			{type: '/Lotus/Types/Enemies/Grineer/GrineerLancer', kills: 1000},
			{type: '/Lotus/Types/Enemies/Corpus/CorpusCrewman', kills: 500},
			{type: '/Lotus/Types/Enemies/Infested/InfectedRunner', kills: 300},
		],
	},
};

// Simulate the upstream-rendered tbody: one row per enemy in array order,
// no rank cell, no data-category.
function setupDOM(enemies: Array<{type: string; kills?: number}> = mockProfile.Stats.Enemies) {
	const rows = enemies.map(enemy => `<tr><td>Name</td><td>${enemy.kills}</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>`).join('');
	document.body.innerHTML = `
		<div id="enemy-filter-bar"></div>
		<table><tbody id="enemy-stats">${rows}</tbody></table>
	`;
}

describe('augmentEnemyStats', () => {
	beforeEach(() => {
		mockBootstrapTooltip();
		(globalThis as any).ExportImages = ExportImages;
		(globalThis as any).ExportEnemies = mockExportEnemies;
		loadCommonJsFunctions(['setImageSource', 'addTooltip']);
	});

	it('prepends a rank cell to each row', () => {
		setupDOM();
		augmentEnemyStats(mockProfile);
		const rows = document.querySelectorAll<HTMLTableRowElement>('#enemy-stats tr');
		expect(rows[0].cells).toHaveLength(8); // 7 upstream + 1 rank
	});

	it('assigns sequential ranks starting at 1', () => {
		setupDOM();
		augmentEnemyStats(mockProfile);
		const rows = document.querySelectorAll<HTMLTableRowElement>('#enemy-stats tr');
		for (const [i, tr] of rows.entries()) {
			expect(tr.cells[0].textContent).toBe(String(i + 1));
		}
	});

	it('assigns data-category from ENEMY_FACTIONS bucket', () => {
		setupDOM();
		augmentEnemyStats(mockProfile);
		const rows = document.querySelectorAll<HTMLTableRowElement>('#enemy-stats tr');
		// Sorted by kills: Lancer (1000)=Grineer, Crewman (500)=Corpus, Runner (300)=Infested
		expect(rows[0].dataset.category).toBe('Grineer');
		expect(rows[1].dataset.category).toBe('Corpus');
		expect(rows[2].dataset.category).toBe('Infested');
	});

	it('assigns empty data-category for unrecognised faction', () => {
		const profile = {Stats: {Enemies: [{type: '/Lotus/Types/Enemies/Grineer/GrineerLancer', kills: 1}]}};
		const exportEnemies = {avatars: {'/Lotus/Types/Enemies/Grineer/GrineerLancer': {name: 'x', faction: 'UnknownFaction'}}};
		(globalThis as any).ExportEnemies = exportEnemies;
		setupDOM(profile.Stats.Enemies);
		augmentEnemyStats(profile);
		expect(document.querySelector<HTMLTableRowElement>('#enemy-stats tr')!.dataset.category).toBe('');
	});

	it('initialises a filter bar with an "All" button', () => {
		setupDOM();
		augmentEnemyStats(mockProfile);
		expect(document.querySelector('#enemy-filter-bar button[data-filter=""]')).not.toBeNull();
	});

	it('applies faction in the same order as upstream, including items with no kills', () => {
		// Item with undefined kills sorts differently under b.kills - a.kills (NaN)
		// vs (b.kills ?? 0) - (a.kills ?? 0). The augmenter must not re-sort independently.
		const enemies = [
			{type: '/Lotus/Types/Enemies/Grineer/GrineerLancer', kills: 1000},
			{type: '/Lotus/Types/Enemies/Infested/InfectedRunner', kills: undefined},
			{type: '/Lotus/Types/Enemies/Corpus/CorpusCrewman', kills: 500},
		];
		setupDOM(enemies);

		augmentEnemyStats({Stats: {Enemies: enemies}});

		const rows = document.querySelectorAll<HTMLTableRowElement>('#enemy-stats tr');
		const {ENEMY_FACTIONS} = (globalThis as any);
		let rowIndex = 0;
		for (const enemy of enemies) {
			const type = (globalThis as any).ExportEnemies.avatars[enemy.type];
			if (!type) {
				continue;
			}

			const bucket = ENEMY_FACTIONS.find((f: any) => f.factions.includes(type.faction));
			const expected = bucket ? bucket.tooltip : '';
			expect(rows[rowIndex++].dataset.category).toBe(expected);
		}
	});

	it('does nothing when tbody is empty', () => {
		document.body.innerHTML = `
			<div id="enemy-filter-bar"></div>
			<table><tbody id="enemy-stats"></tbody></table>
		`;
		augmentEnemyStats(mockProfile);
		expect(document.querySelector('#enemy-filter-bar button')).toBeNull();
	});
});
