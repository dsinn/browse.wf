import { describe, it, expect, beforeEach } from 'vitest'
import { loadScript } from './helpers/dom-helpers'

describe('string-helpers', () => {
  beforeEach(() => {
    loadScript('typestripped/src/string-helpers.js')
  })

  describe('pluralize', () => {
    it('returns singular for count of 1', () => {
      expect((window as any).pluralize(1, 'day')).toBe('1 day')
      expect((window as any).pluralize(1, 'hour')).toBe('1 hour')
      expect((window as any).pluralize(1, 'minute')).toBe('1 minute')
      expect((window as any).pluralize(1, 'second')).toBe('1 second')
    })

    it('returns plural for count of 0', () => {
      expect((window as any).pluralize(0, 'day')).toBe('0 days')
      expect((window as any).pluralize(0, 'hour')).toBe('0 hours')
    })

    it('returns plural for count > 1', () => {
      expect((window as any).pluralize(2, 'day')).toBe('2 days')
      expect((window as any).pluralize(100, 'second')).toBe('100 seconds')
    })

    it('uses default plural (singular + "s")', () => {
      expect((window as any).pluralize(2, 'cat')).toBe('2 cats')
      expect((window as any).pluralize(1, 'cat')).toBe('1 cat')
    })

    it('uses custom plural when provided', () => {
      expect((window as any).pluralize(1, 'ox', 'oxen')).toBe('1 ox')
      expect((window as any).pluralize(2, 'ox', 'oxen')).toBe('2 oxen')
      expect((window as any).pluralize(0, 'ox', 'oxen')).toBe('0 oxen')
    })
  })
})
