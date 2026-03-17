import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mockBootstrapTooltip } from './helpers/dom-helpers'
import { addTooltip } from '../src/tooltip'

describe('tooltip', () => {
  beforeEach(() => {
    mockBootstrapTooltip()
  })

  afterEach(() => {
    delete window.bootstrap
  })

  it('exposes addTooltip globally', () => {
    expect(typeof (window as any).addTooltip).toBe('function')
  })

  it('sets data-bs-toggle to "tooltip"', () => {
    const elm = document.createElement('span')
    addTooltip(elm, 'Hello')
    expect(elm.getAttribute('data-bs-toggle')).toBe('tooltip')
  })

  it('sets data-bs-title to the provided title', () => {
    const elm = document.createElement('span')
    addTooltip(elm, 'Hello')
    expect(elm.getAttribute('data-bs-title')).toBe('Hello')
  })

  it('initialises a Bootstrap Tooltip instance on the element', () => {
    const elm = document.createElement('span')
    addTooltip(elm, 'Hello')
    expect(window.bootstrap!.Tooltip.getInstance(elm)).toBeTruthy()
  })
})
