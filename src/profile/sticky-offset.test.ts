import {
	describe,
	it,
	expect,
	beforeEach,
	vi,
} from 'vitest';
import {initStickyOffset, updateStickyOffset} from './sticky-offset';

const offset = () => document.documentElement.style.getPropertyValue('--profile-sticky-top');

function setNavbarHeight(height: number): void {
	const navbar = document.querySelector('#main-navbar')!;
	vi.spyOn(navbar, 'getBoundingClientRect').mockReturnValue({height} as DOMRect);
}

describe('updateStickyOffset', () => {
	beforeEach(() => {
		document.documentElement.removeAttribute('style');
		document.body.innerHTML = '<nav id="main-navbar" class="navbar fixed-top"></nav>';
	});

	it('sets the offset to the height of the navbar when it is fixed to the top', () => {
		setNavbarHeight(72);
		updateStickyOffset();

		expect(offset()).toBe('72px');
	});

	it('sets the offset to 0 when the navbar is not fixed to the top', () => {
		setNavbarHeight(72);
		document.querySelector('#main-navbar')!.classList.remove('fixed-top');
		updateStickyOffset();

		expect(offset()).toBe('0px');
	});

	it('sets the offset to 0 when the page has no navbar', () => {
		document.body.replaceChildren();
		updateStickyOffset();

		expect(offset()).toBe('0px');
	});
});

describe('initStickyOffset', () => {
	beforeEach(() => {
		document.documentElement.removeAttribute('style');
		document.body.innerHTML = '<nav id="main-navbar" class="navbar fixed-top"></nav><table class="sticky-header"></table>';
	});

	it('sets the offset straight away', () => {
		setNavbarHeight(60);
		initStickyOffset();

		expect(offset()).toBe('60px');
	});

	it('follows the navbar being unfixed and fixed again', async () => {
		setNavbarHeight(60);
		initStickyOffset();
		const navbar = document.querySelector('#main-navbar')!;

		navbar.classList.remove('fixed-top');
		await vi.waitFor(() => {
			expect(offset()).toBe('0px');
		});

		navbar.classList.add('fixed-top');
		await vi.waitFor(() => {
			expect(offset()).toBe('60px');
		});
	});

	it('does nothing on a page without sticky tables', () => {
		document.querySelector('table')!.remove();
		setNavbarHeight(60);
		initStickyOffset();

		expect(offset()).toBe('');
	});
});
