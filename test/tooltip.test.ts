import {
	describe, it, expect, beforeEach, afterEach,
} from 'vitest';
import {addTooltip} from '../src/tooltip';
import {mockBootstrapTooltip} from './helpers/dom-helpers';

describe('tooltip', () => {
	beforeEach(() => {
		mockBootstrapTooltip();
	});

	afterEach(() => {
		delete globalThis.bootstrap;
	});

	it('exposes addTooltip globally', () => {
		expect(typeof (globalThis as any).addTooltip).toBe('function');
	});

	it('sets data-bs-toggle to "tooltip"', () => {
		const elm = document.createElement('span');
		addTooltip(elm, 'Hello');
		expect(elm.dataset.bsToggle).toBe('tooltip');
	});

	it('sets data-bs-title to the provided title', () => {
		const elm = document.createElement('span');
		addTooltip(elm, 'Hello');
		expect(elm.dataset.bsTitle).toBe('Hello');
	});

	it('initialises a Bootstrap Tooltip instance on the element', () => {
		const elm = document.createElement('span');
		addTooltip(elm, 'Hello');
		expect(globalThis.bootstrap.Tooltip.getInstance(elm)).toBeTruthy();
	});
});
