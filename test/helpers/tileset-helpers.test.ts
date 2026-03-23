import {describe, it, expect} from 'vitest';
import type {IRegion} from 'warframe-public-export-plus';
import {getTileset, formatTileset} from '../../src/helpers/tileset-helpers';

describe('tileset-helpers', () => {
	describe('getTileset', () => {
		it('should return tileset when node has tileset data', () => {
			const node: Partial<IRegion> = {
				tileset: 'GrineerAsteroidTileset',
				name: '/Lotus/Language/Locations/SolNode1',
				systemName: '/Lotus/Language/Systems/SolSystem1',
				systemIndex: 0,
				nodeType: 0,
				masteryReq: 0,
				missionType: 'MT_SURVIVAL',
				missionIndex: 0,
				missionName: '/Lotus/Language/Missions/MissionName_Survival',
				minEnemyLevel: 1,
				maxEnemyLevel: 3,
				masteryExp: 0,
			};

			expect(getTileset(node as IRegion)).toBe('GrineerAsteroidTileset');
		});

		it('every node in ExportRegions with a tileset returns that tileset unchanged', () => {
			const regions: Record<string, IRegion> = (globalThis as any).ExportRegions;
			for (const [key, node] of Object.entries(regions)) {
				if (node.tileset) {
					expect(getTileset(node), `${key} should return its own tileset`).toBe(node.tileset);
				}
			}
		});

		it('every inferred tileset for nodes without tileset data is a known tileset', () => {
			const regions: Record<string, IRegion> = (globalThis as any).ExportRegions;
			const knownTilesets = new Set(Object.values(regions).map(n => n.tileset).filter(Boolean));
			for (const [key, node] of Object.entries(regions)) {
				if (!node.tileset) {
					const inferred = getTileset(node);
					if (inferred !== undefined) {
						expect(knownTilesets, `${key} inferred tileset "${inferred}" should be a known tileset`).toContain(inferred);
					}
				}
			}
		});
	});

	describe('formatTileset', () => {
		it('should format tileset', () => {
			expect(formatTileset('GrineerAsteroidTileset')).toBe('Grineer Asteroid');
			expect(formatTileset('CorpusShipTileset')).toBe('Corpus Ship');
			expect(formatTileset('OrokinVoidTileset')).toBe('Orokin Void');
			expect(formatTileset('OrokinMoonTilesetGrineer')).toBe('Orokin Moon Grineer');
			expect(formatTileset('GrineerOceanTilesetAnywhere')).toBe('Grineer Ocean Anywhere');
			expect(formatTileset('CorpusIcePlanetTilesetCaves')).toBe('Corpus Ice Planet Caves');
		});

		it('should convert PascalCase to Title Case', () => {
			expect(formatTileset('CorpusGasCityTileset')).toBe('Corpus Gas City');
			expect(formatTileset('CorpusIcePlanetCavesTileset')).toBe('Corpus Ice Planet Caves');
			expect(formatTileset('GrineerShipyardsTileset')).toBe('Grineer Shipyards');
		});

		it('should handle undefined input', () => {
			expect(formatTileset(undefined)).toBe('');
		});

		it('should handle single-word tilesets', () => {
			expect(formatTileset('EntratiTileset')).toBe('Entrati');
			expect(formatTileset('ZarimanTileset')).toBe('Zariman');
		});
	});
});
