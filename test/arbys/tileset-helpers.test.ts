import { describe, it, expect, beforeEach } from 'vitest'
import { loadScript } from '../helpers/dom-helpers'
import type { IRegion } from 'warframe-public-export-plus'

describe('tileset-helpers', () => {
  beforeEach(() => {
    // Load the actual compiled production code
    loadScript('typestripped/src/tileset-helpers.js')
  })

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

      expect((window as any).getTileset(node as IRegion)).toBe('GrineerAsteroidTileset')
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

      expect((window as any).getTileset(node as IRegion, 'SolNode94')).toBe('GrineerGalleonTileset')
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

      expect((window as any).getTileset(node as IRegion, 'SolNode99')).toBeUndefined()
    })
  })

  describe('formatTileset', () => {
    it('should format tileset by removing "Tileset" suffix', () => {
      expect((window as any).formatTileset('GrineerAsteroidTileset')).toBe('Grineer Asteroid')
      expect((window as any).formatTileset('CorpusShipTileset')).toBe('Corpus Ship')
      expect((window as any).formatTileset('OrokinVoidTileset')).toBe('Orokin Void')
    })

    it('should convert PascalCase to Title Case', () => {
      expect((window as any).formatTileset('CorpusGasCityTileset')).toBe('Corpus Gas City')
      expect((window as any).formatTileset('CorpusIcePlanetCavesTileset')).toBe('Corpus Ice Planet Caves')
      expect((window as any).formatTileset('GrineerShipyardsTileset')).toBe('Grineer Shipyards')
    })

    it('should handle undefined input', () => {
      expect((window as any).formatTileset(undefined)).toBe('')
    })

    it('should handle single-word tilesets', () => {
      expect((window as any).formatTileset('EntratiTileset')).toBe('Entrati')
      expect((window as any).formatTileset('ZarimanTileset')).toBe('Zariman')
    })
  })
})
