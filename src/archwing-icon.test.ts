/**
 * Tests for src/archwing-icon.ts
 */
import {
	describe, test, expect, beforeEach,
} from 'vitest';
import {makeArchwingIcon} from './archwing-icon';

const ARCHWING_ICON_PATH = '/Lotus/Interface/Icons/StoreIcons/Gear/GenericArchwingSystems.png';

describe('makeArchwingIcon', () => {
	beforeEach(() => {
		(globalThis as any).setImageSource = (img: HTMLImageElement, icon: string) => {
			img.dataset.src = icon;
		};

		(globalThis as any).addTooltip = (element: HTMLElement, title: string) => {
			element.dataset.bsTitle = title;
		};
	});

	test('applies the given className when provided', () => {
		const icon = makeArchwingIcon('my-class');
		expect(icon.className).toBe('my-class');
	});

	test('calls setImageSource with the Archwing icon path', () => {
		const icon = makeArchwingIcon();
		expect(icon.dataset.src).toBe(ARCHWING_ICON_PATH);
	});

	test('calls addTooltip with "Archwing"', () => {
		const icon = makeArchwingIcon();
		expect(icon.dataset.bsTitle).toBe('Archwing');
	});

	test('exposes makeArchwingIcon on globalThis', () => {
		expect(typeof (globalThis as any).makeArchwingIcon).toBe('function');
	});
});
