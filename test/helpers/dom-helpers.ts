/**
 * DOM helper utilities for testing
 *
 * Tests load actual PHP-rendered HTML via loadFixture('name')
 * instead of duplicating HTML structure here.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';

/**
 * Helper to get element by ID with type safety
 */
export function getById<T extends HTMLElement = HTMLElement>(id: string): T {
	const element = document.querySelector<T>(`#${id}`);
	if (!element) {
		throw new Error(`Element with id "${id}" not found`);
	}

	return element;
}

/**
 * Helper to check if element exists
 */
export function elementExists(id: string): boolean {
	return document.querySelector(`#${id}`) !== null;
}

/**
 * Mock Bootstrap Tooltip for testing
 */
export function mockBootstrapTooltip() {
	const tooltipInstances = new Map<HTMLElement, any>();

	globalThis.bootstrap = {
		Tooltip: class MockTooltip {
			static getInstance(element: HTMLElement) {
				return tooltipInstances.get(element);
			}

			private readonly element: HTMLElement;
			private readonly title: string;

			constructor(element: HTMLElement) {
				this.element = element;
				this.title = element.dataset.bsTitle || element.getAttribute('title') || '';
				tooltipInstances.set(element, this);
			}

			dispose() {
				tooltipInstances.delete(this.element);
			}

			getTitle() {
				return this.title;
			}
		},
	};
}

/**
 * Load common.js and promote the named plain function declarations to window.
 *
 * common.js uses plain function declarations rather than explicit window
 * assignments. In a browser, the global scope is window so these are
 * automatically accessible as window.fn. In vitest, eval() runs inside a
 * strict ES module where function declarations are local to the eval scope
 * and never reach globalThis. This wrapper appends explicit window assignments
 * for the requested names as a workaround.
 *
 * @param functionNames - Names of functions from common.js to expose on window
 */
export function loadCommonJsFunctions(functionNames: string[]) {
	const scriptContent = fs.readFileSync(path.join(process.cwd(), 'common.js'), 'utf8');
	const promotions = functionNames.map(name => `window.${name} = ${name};`).join('\n');
	// eslint-disable-next-line no-eval
	eval(String(scriptContent) + '\n' + promotions);
}
