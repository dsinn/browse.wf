import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadScript, loadCommonJsFunctions, mockBootstrapTooltip } from '../helpers/dom-helpers'
import { loadExportJson } from '../helpers/api-mocks'

const ExportImages = loadExportJson('ExportImages.json')

describe('profile-stats-filters', () => {
  beforeEach(() => {
    mockBootstrapTooltip()
    ;(window as any).ExportImages = ExportImages
    loadCommonJsFunctions(['setImageSource'])
    loadScript('typestripped/src/tooltip.js')
    loadScript('typestripped/src/profile-stats-filters.js')
  })

  describe('EQUIPMENT_CATEGORIES', () => {
    it('contains all expected productCategory keys', () => {
      const cats = (window as any).EQUIPMENT_CATEGORIES
      const expectedKeys = [
        'Suits', 'LongGuns', 'Pistols', 'Melee', 'SpaceSuits', 'MechSuits',
        'Sentinels', 'KubrowPets', 'MoaPets', 'SpaceGuns', 'SpaceMelee',
        'SentinelWeapons', 'DrifterMelee', 'OperatorAmps', 'SpecialItems',
      ]
      for (const key of expectedKeys) {
        expect(cats).toHaveProperty(key)
      }
    })

    it('every entry has a label string', () => {
      const cats = (window as any).EQUIPMENT_CATEGORIES
      for (const [key, val] of Object.entries(cats) as [string, any][]) {
        expect(typeof val.label, key).toBe('string')
        expect(val.label.length, key).toBeGreaterThan(0)
      }
    })

    it('every entry has an icon string (may be empty for SpecialItems)', () => {
      const cats = (window as any).EQUIPMENT_CATEGORIES
      for (const [key, val] of Object.entries(cats) as [string, any][]) {
        expect(typeof val.icon, key).toBe('string')
      }
    })
  })

  describe('ENEMY_FACTIONS', () => {
    it('is an array with at least one entry', () => {
      const factions = (window as any).ENEMY_FACTIONS
      expect(Array.isArray(factions)).toBe(true)
      expect(factions.length).toBeGreaterThan(0)
    })

    it('every entry has label, icon, and factions array', () => {
      const factions = (window as any).ENEMY_FACTIONS
      for (const entry of factions) {
        expect(typeof entry.label).toBe('string')
        expect(typeof entry.icon).toBe('string')
        expect(Array.isArray(entry.factions)).toBe(true)
        expect(entry.factions.length).toBeGreaterThan(0)
      }
    })

    it('covers the main factions', () => {
      const factions = (window as any).ENEMY_FACTIONS
      const labels = factions.map((f: any) => f.label)
      for (const expected of ['Grineer', 'Corpus', 'Infested', 'Orokin', 'Sentient', 'Narmer', 'Murmur']) {
        expect(labels).toContain(expected)
      }
    })

    it('Infested bucket covers both Infestation and Infested strings', () => {
      const factions = (window as any).ENEMY_FACTIONS
      const infested = factions.find((f: any) => f.label === 'Infested')
      expect(infested.factions).toContain('Infestation')
      expect(infested.factions).toContain('Infested')
    })
  })

  describe('icon paths resolve to content.warframe.com via setImageSource', () => {
    it('every non-empty equipment category icon produces a content.warframe.com URL', () => {
      const cats = (window as any).EQUIPMENT_CATEGORIES
      for (const [key, val] of Object.entries(cats) as [string, { icon: string }][]) {
        if (!val.icon) continue
        const img = document.createElement('img')
        ;(window as any).setImageSource(img, val.icon)
        expect(img.src, key).not.toMatch(/^https:\/\/browse\.wf\//)
      }
    })

    it('every enemy faction icon produces a content.warframe.com URL', () => {
      const factions = (window as any).ENEMY_FACTIONS
      for (const entry of factions) {
        const img = document.createElement('img')
        ;(window as any).setImageSource(img, entry.icon)
        expect(img.src, entry.label).not.toMatch(/^https:\/\/browse\.wf\//)
      }
    })
  })

  describe('getEquipmentCategoryLabel', () => {
    it('returns the display label for a known productCategory', () => {
      const fn = (window as any).getEquipmentCategoryLabel
      expect(fn('Suits')).toBe('Warframes')
      expect(fn('LongGuns')).toBe('Primary')
      expect(fn('Pistols')).toBe('Secondary')
      expect(fn('Melee')).toBe('Melee')
    })

    it('returns null for an unknown productCategory', () => {
      const fn = (window as any).getEquipmentCategoryLabel
      expect(fn('Unknown')).toBeNull()
      expect(fn('')).toBeNull()
    })
  })

  describe('getEnemyFactionLabel', () => {
    it('returns the bucket label for a known faction string', () => {
      const fn = (window as any).getEnemyFactionLabel
      expect(fn('Grineer')).toBe('Grineer')
      expect(fn('Corpus')).toBe('Corpus')
      expect(fn('Infestation')).toBe('Infested')
      expect(fn('Infested')).toBe('Infested')
      expect(fn('OrokinEmpire')).toBe('Orokin')
      expect(fn('Orokin Empire')).toBe('Orokin')
      expect(fn('NarmerVeil')).toBe('Narmer')
      expect(fn('MITW')).toBe('Murmur')
    })

    it('returns null for an unknown faction string', () => {
      const fn = (window as any).getEnemyFactionLabel
      expect(fn('Unknown')).toBeNull()
      expect(fn('')).toBeNull()
    })
  })

  describe('initStatsFilterBar', () => {
    let filterBar: HTMLElement
    let tbody: HTMLElement

    const entries = [
      { key: 'Alpha', label: 'Alpha Label', icon: '/Lotus/some/Alpha.png' },
      { key: 'Beta',  label: 'Beta Label',  icon: '' },
      { key: 'Gamma', label: 'Gamma Label', icon: '/Lotus/some/Gamma.png' },
    ]

    beforeEach(() => {
      document.body.innerHTML = `
        <div id="filter-bar"></div>
        <table><tbody id="tbody">
          <tr data-category="Alpha"></tr>
          <tr data-category="Alpha"></tr>
          <tr data-category="Beta"></tr>
          <tr data-category="Gamma"></tr>
        </tbody></table>
      `
      filterBar = document.getElementById('filter-bar')!
      tbody = document.getElementById('tbody')!
    })

    it('renders an "All" button as the first button', () => {
      ;(window as any).initStatsFilterBar(filterBar, tbody, entries, new Set(['Alpha', 'Beta', 'Gamma']))
      const buttons = filterBar.querySelectorAll('button')
      expect(buttons[0].getAttribute('data-bs-title')).toBe('All')
      expect(buttons[0].dataset.filter).toBe('')
    })

    it('"All" button starts active', () => {
      ;(window as any).initStatsFilterBar(filterBar, tbody, entries, new Set(['Alpha', 'Beta', 'Gamma']))
      const allBtn = filterBar.querySelector('button')!
      expect(allBtn.classList.contains('active')).toBe(true)
    })

    it('every button has a Bootstrap tooltip', () => {
      ;(window as any).initStatsFilterBar(filterBar, tbody, entries, new Set(['Alpha', 'Beta', 'Gamma']))
      for (const btn of filterBar.querySelectorAll('button')) {
        expect(btn.getAttribute('data-bs-toggle')).toBe('tooltip')
        expect(btn.getAttribute('data-bs-title')).toBeTruthy()
      }
    })

    it('only renders buttons for categories present in presentKeys', () => {
      ;(window as any).initStatsFilterBar(filterBar, tbody, entries, new Set(['Alpha', 'Gamma']))
      const buttons = filterBar.querySelectorAll('button')
      // All + Alpha + Gamma = 3, Beta is absent
      expect(buttons).toHaveLength(3)
      const filters = Array.from(buttons).map(b => (b as HTMLButtonElement).dataset.filter)
      expect(filters).not.toContain('Beta')
    })

    it('renders an img for entries with an icon', () => {
      ;(window as any).initStatsFilterBar(filterBar, tbody, entries, new Set(['Alpha', 'Beta', 'Gamma']))
      const alphaBtn = filterBar.querySelector<HTMLButtonElement>('[data-filter="Alpha"]')!
      expect(alphaBtn.querySelector('img')).toBeTruthy()
    })

    it('renders a text span for entries with no icon', () => {
      ;(window as any).initStatsFilterBar(filterBar, tbody, entries, new Set(['Alpha', 'Beta', 'Gamma']))
      const betaBtn = filterBar.querySelector<HTMLButtonElement>('[data-filter="Beta"]')!
      expect(betaBtn.querySelector('span')).toBeTruthy()
      expect(betaBtn.querySelector('img')).toBeNull()
    })

    it('clicking a filter button sets data-filter on tbody and marks button active', () => {
      ;(window as any).initStatsFilterBar(filterBar, tbody, entries, new Set(['Alpha', 'Beta', 'Gamma']))
      const alphaBtn = filterBar.querySelector<HTMLButtonElement>('[data-filter="Alpha"]')!
      alphaBtn.click()
      expect(tbody.dataset.filter).toBe('Alpha')
      expect(alphaBtn.classList.contains('active')).toBe(true)
    })

    it('clicking the active filter button again resets to "All"', () => {
      ;(window as any).initStatsFilterBar(filterBar, tbody, entries, new Set(['Alpha', 'Beta', 'Gamma']))
      const alphaBtn = filterBar.querySelector<HTMLButtonElement>('[data-filter="Alpha"]')!
      alphaBtn.click()
      alphaBtn.click()
      expect(tbody.dataset.filter).toBeUndefined()
      const allBtn = filterBar.querySelector<HTMLButtonElement>('[data-filter=""]')!
      expect(allBtn.classList.contains('active')).toBe(true)
    })

    it('clicking "All" clears the filter', () => {
      ;(window as any).initStatsFilterBar(filterBar, tbody, entries, new Set(['Alpha', 'Beta', 'Gamma']))
      const alphaBtn = filterBar.querySelector<HTMLButtonElement>('[data-filter="Alpha"]')!
      const allBtn = filterBar.querySelector<HTMLButtonElement>('[data-filter=""]')!
      alphaBtn.click()
      expect(tbody.dataset.filter).toBe('Alpha')
      allBtn.click()
      expect(tbody.dataset.filter).toBeUndefined()
      expect(allBtn.classList.contains('active')).toBe(true)
    })

    it('only one button is active at a time', () => {
      ;(window as any).initStatsFilterBar(filterBar, tbody, entries, new Set(['Alpha', 'Beta', 'Gamma']))
      const alphaBtn = filterBar.querySelector<HTMLButtonElement>('[data-filter="Alpha"]')!
      const gammaBtn = filterBar.querySelector<HTMLButtonElement>('[data-filter="Gamma"]')!
      alphaBtn.click()
      gammaBtn.click()
      const activeButtons = filterBar.querySelectorAll('button.active')
      expect(activeButtons).toHaveLength(1)
      expect((activeButtons[0] as HTMLButtonElement).dataset.filter).toBe('Gamma')
    })

    it('calls onFilter callback when a category button is clicked', () => {
      const onFilter = vi.fn()
      ;(window as any).initStatsFilterBar(filterBar, tbody, entries, new Set(['Alpha', 'Beta', 'Gamma']), onFilter)
      const alphaBtn = filterBar.querySelector<HTMLButtonElement>('[data-filter="Alpha"]')!
      alphaBtn.click()
      expect(onFilter).toHaveBeenCalledTimes(1)
    })

    it('calls onFilter callback when "All" is clicked', () => {
      const onFilter = vi.fn()
      ;(window as any).initStatsFilterBar(filterBar, tbody, entries, new Set(['Alpha', 'Beta', 'Gamma']), onFilter)
      const alphaBtn = filterBar.querySelector<HTMLButtonElement>('[data-filter="Alpha"]')!
      const allBtn = filterBar.querySelector<HTMLButtonElement>('[data-filter=""]')!
      alphaBtn.click()
      onFilter.mockClear()
      allBtn.click()
      expect(onFilter).toHaveBeenCalledTimes(1)
    })

    it('does not throw when onFilter is omitted', () => {
      expect(() => {
        ;(window as any).initStatsFilterBar(filterBar, tbody, entries, new Set(['Alpha']))
        filterBar.querySelector<HTMLButtonElement>('[data-filter="Alpha"]')!.click()
      }).not.toThrow()
    })
  })
})
