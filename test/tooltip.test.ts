import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { loadScript, mockBootstrapTooltip } from './helpers/dom-helpers'

describe('tooltip', () => {
  beforeEach(() => {
    mockBootstrapTooltip()
    loadScript('typestripped/src/tooltip.js')
  })

  afterEach(() => {
    delete (window as any).bootstrap
    delete (window as any).addTooltip
  })

  it('exposes addTooltip globally', () => {
    expect(typeof (window as any).addTooltip).toBe('function')
  })

  it('sets data-bs-toggle to "tooltip"', () => {
    const elm = document.createElement('span')
    ;(window as any).addTooltip(elm, 'Hello')
    expect(elm.getAttribute('data-bs-toggle')).toBe('tooltip')
  })

  it('sets data-bs-title to the provided title', () => {
    const elm = document.createElement('span')
    ;(window as any).addTooltip(elm, 'Hello')
    expect(elm.getAttribute('data-bs-title')).toBe('Hello')
  })

  it('initialises a Bootstrap Tooltip instance on the element', () => {
    const elm = document.createElement('span')
    ;(window as any).addTooltip(elm, 'Hello')
    expect((window as any).bootstrap.Tooltip.getInstance(elm)).toBeTruthy()
  })
})
