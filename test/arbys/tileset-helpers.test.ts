import { describe, it, expect } from 'vitest'
import { getTileset, formatTileset } from '../../src/tileset-helpers'
import type { IRegion } from 'warframe-public-export-plus'

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
        masteryExp: 0
      }

      expect(getTileset(node as IRegion)).toBe('GrineerAsteroidTileset')
    })

    it('should return hardcoded tileset for SolNode94', () => {
      const node: Partial<IRegion> = {
        // SolNode94 (Apollodorus) lacks tileset data
        name: '/Lotus/Language/Locations/SolNode94',
        systemName: '/Lotus/Language/Systems/SolSystem94',
        systemIndex: 0,
        nodeType: 0,
        masteryReq: 0,
        missionType: 'MT_DEFENSE',
        missionIndex: 0,
        missionName: '/Lotus/Language/Missions/MissionName_Defense',
        minEnemyLevel: 15,
        maxEnemyLevel: 25,
        masteryExp: 0
      }

      expect(getTileset(node as IRegion, 'SolNode94')).toBe('GrineerGalleonTileset')
    })

    it('should return undefined for nodes without tileset and no fallback', () => {
      const node: Partial<IRegion> = {
        name: '/Lotus/Language/Locations/SolNode99',
        systemName: '/Lotus/Language/Systems/SolSystem99',
        systemIndex: 0,
        nodeType: 0,
        masteryReq: 0,
        missionType: 'MT_SURVIVAL',
        missionIndex: 0,
        missionName: '/Lotus/Language/Missions/MissionName_Survival',
        minEnemyLevel: 1,
        maxEnemyLevel: 3,
        masteryExp: 0
      }

      expect(getTileset(node as IRegion, 'SolNode99')).toBeUndefined()
    })
  })

  describe('formatTileset', () => {
    it('should format tileset', () => {
      expect(formatTileset('GrineerAsteroidTileset')).toBe('Grineer Asteroid')
      expect(formatTileset('CorpusShipTileset')).toBe('Corpus Ship')
      expect(formatTileset('OrokinVoidTileset')).toBe('Orokin Void')
      expect(formatTileset('OrokinMoonTilesetGrineer')).toBe('Orokin Moon Grineer')
      expect(formatTileset('GrineerOceanTilesetAnywhere')).toBe('Grineer Ocean Anywhere')
      expect(formatTileset('CorpusIcePlanetTilesetCaves')).toBe('Corpus Ice Planet Caves')
    })

    it('should convert PascalCase to Title Case', () => {
      expect(formatTileset('CorpusGasCityTileset')).toBe('Corpus Gas City')
      expect(formatTileset('CorpusIcePlanetCavesTileset')).toBe('Corpus Ice Planet Caves')
      expect(formatTileset('GrineerShipyardsTileset')).toBe('Grineer Shipyards')
    })

    it('should handle undefined input', () => {
      expect(formatTileset(undefined)).toBe('')
    })

    it('should handle single-word tilesets', () => {
      expect(formatTileset('EntratiTileset')).toBe('Entrati')
      expect(formatTileset('ZarimanTileset')).toBe('Zariman')
    })
  })
})
