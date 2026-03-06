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

/**
 * Load common.js and promote the named plain function declarations to window.
 *
 * common.js uses plain function declarations rather than explicit window
 * assignments. In a browser, the global scope is window so these are
 * automatically accessible as window.fn. In vitest, loadScript() uses eval()
 * inside a strict ES module where function declarations are local to the eval
 * scope and never reach globalThis. This wrapper appends explicit window
 * assignments for the requested names as a workaround.
 *
 * @param functionNames - Names of functions from common.js to expose on window
 */
export function loadCommonJsFunctions(functionNames: string[]) {
  const fs = require('fs');
  const path = require('path');
  const scriptContent = fs.readFileSync(path.join(process.cwd(), 'common.js'), 'utf-8');
  const promotions = functionNames.map(name => `window.${name} = ${name};`).join('\n');
  eval(scriptContent + '\n' + promotions);
}

/**
 * Load a compiled JavaScript file into the test environment
 * Executes the script in the global (window) context
 *
 * @param relativePath - Path relative to project root (e.g., 'typestripped/src/card-filters.js')
 */

export function loadScript(relativePath: string) {
  const fs = require('fs');
  const path = require('path');

  const scriptPath = path.join(process.cwd(), relativePath);

  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Script not found: ${scriptPath}`);
  }

  const scriptContent = fs.readFileSync(scriptPath, 'utf-8');

  // Execute script in global context using eval
  // This makes all global assignments (window.foo = ...) work correctly
  eval(scriptContent);
}
