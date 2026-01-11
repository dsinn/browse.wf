/**
 * DOM helper utilities for testing
 *
 * Tests load actual PHP-rendered HTML via loadFixture('name')
 * instead of duplicating HTML structure here.
 */

/**
 * Helper to get element by ID with type safety
 */
export function getById<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Element with id "${id}" not found`);
  }
  return element as T;
}

/**
 * Helper to check if element exists
 */
export function elementExists(id: string): boolean {
  return document.getElementById(id) !== null;
}

/**
 * Mock Bootstrap Tooltip for testing
 */
export function mockBootstrapTooltip() {
  const tooltipInstances = new Map<HTMLElement, any>();

  (window as any).bootstrap = {
    Tooltip: class MockTooltip {
      private element: HTMLElement;
      private title: string;

      constructor(element: HTMLElement) {
        this.element = element;
        this.title = element.getAttribute('data-bs-title') || element.getAttribute('title') || '';
        tooltipInstances.set(element, this);
      }

      dispose() {
        tooltipInstances.delete(this.element);
      }

      static getInstance(element: HTMLElement) {
        return tooltipInstances.get(element);
      }

      getTitle() {
        return this.title;
      }
    }
  };
}
