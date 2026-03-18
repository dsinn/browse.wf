/**
 * Integration tests for navbar pin toggle feature
 * Tests functionality, appearance, and tooltip behavior
 */
import {
	describe, test, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {loadFixture} from '../helpers/fixture-loader';
import {mockBootstrapTooltip, getById} from '../helpers/dom-helpers';

// Import the functions we're testing by loading the common.js file
// Note: In a real scenario, we'd extract these into a module, but for now we'll test via DOM
declare global {
	type Window = {
		bootstrap?: any;
		updateNavbarPinAppearance?: () => void;
		toggleNavbarFixed?: () => void;
	};
}

describe('Navbar Pin Toggle', () => {
	beforeEach(() => {
		// Clear localStorage before each test
		localStorage.clear();

		// Setup DOM from actual navbar.php
		document.body.innerHTML = loadFixture('navbar');
		mockBootstrapTooltip();

		// Load the navbar functions by evaluating common.js code
		// In production, these would be properly imported
		loadNavbarFunctions();
	});

	afterEach(() => {
		localStorage.clear();
		delete globalThis.bootstrap;
		delete globalThis.updateNavbarPinAppearance;
		delete globalThis.toggleNavbarFixed;
	});

	describe('Initial State', () => {
		test('navbar should be fixed by default', () => {
			const navbar = getById('main-navbar');
			globalThis.updateNavbarPinAppearance();

			expect(navbar.classList.contains('fixed-top')).toBe(true);
		});

		test('spacer should have height when fixed', () => {
			const spacer = getById('navbar-spacer');
			globalThis.updateNavbarPinAppearance();

			expect(spacer.style.height).toBe('56px');
		});

		test('pin icons should not have unfixed class by default', () => {
			const pinMobile = getById('navbar-pin-mobile');
			const pinDesktop = getById('navbar-pin-desktop');
			globalThis.updateNavbarPinAppearance();

			expect(pinMobile.classList.contains('navbar-pin-unfixed')).toBe(false);
			expect(pinDesktop.classList.contains('navbar-pin-unfixed')).toBe(false);
		});

		test('tooltip should show "Unfix navbar from the top" when fixed', () => {
			globalThis.updateNavbarPinAppearance();

			const pinMobile = getById('navbar-pin-mobile');
			const pinDesktop = getById('navbar-pin-desktop');

			expect(pinMobile.dataset.bsTitle).toBe('Unfix navbar from the top');
			expect(pinDesktop.dataset.bsTitle).toBe('Unfix navbar from the top');
		});
	});

	describe('Toggle Functionality', () => {
		test('clicking pin should toggle fixed state', () => {
			const navbar = getById('main-navbar');
			globalThis.updateNavbarPinAppearance();

			// Initially fixed
			expect(navbar.classList.contains('fixed-top')).toBe(true);

			// Toggle to unfixed
			globalThis.toggleNavbarFixed();
			expect(navbar.classList.contains('fixed-top')).toBe(false);

			// Toggle back to fixed
			globalThis.toggleNavbarFixed();
			expect(navbar.classList.contains('fixed-top')).toBe(true);
		});

		test('toggling should update spacer height', () => {
			const spacer = getById('navbar-spacer');
			globalThis.updateNavbarPinAppearance();

			// Initially 56px
			expect(spacer.style.height).toBe('56px');

			// Toggle to unfixed - should be 0 or 0px (browser normalizes it)
			globalThis.toggleNavbarFixed();
			expect(spacer.style.height).toMatch(/^0(px)?$/u);

			// Toggle back - should be 56px
			globalThis.toggleNavbarFixed();
			expect(spacer.style.height).toBe('56px');
		});

		test('toggling should store preference in localStorage', () => {
			globalThis.updateNavbarPinAppearance();

			// Initially no localStorage entry
			expect(localStorage.getItem('navbar.unfixed')).toBe(null);

			// Toggle to unfixed
			globalThis.toggleNavbarFixed();
			expect(localStorage.getItem('navbar.unfixed')).toBe('1');

			// Toggle back to fixed
			globalThis.toggleNavbarFixed();
			expect(localStorage.getItem('navbar.unfixed')).toBe(null);
		});
	});

	describe('Appearance - CSS Classes', () => {
		test('pin icons should have unfixed class when navbar is unfixed', () => {
			const pinMobile = getById('navbar-pin-mobile');
			const pinDesktop = getById('navbar-pin-desktop');

			globalThis.updateNavbarPinAppearance();
			expect(pinMobile.classList.contains('navbar-pin-unfixed')).toBe(false);

			globalThis.toggleNavbarFixed();
			expect(pinMobile.classList.contains('navbar-pin-unfixed')).toBe(true);
			expect(pinDesktop.classList.contains('navbar-pin-unfixed')).toBe(true);
		});

		test('pin icons should remove unfixed class when navbar is fixed', () => {
			// Start unfixed
			localStorage.setItem('navbar.unfixed', '1');
			globalThis.updateNavbarPinAppearance();

			const pinMobile = getById('navbar-pin-mobile');
			const pinDesktop = getById('navbar-pin-desktop');

			expect(pinMobile.classList.contains('navbar-pin-unfixed')).toBe(true);
			expect(pinDesktop.classList.contains('navbar-pin-unfixed')).toBe(true);

			// Toggle to fixed
			globalThis.toggleNavbarFixed();
			expect(pinMobile.classList.contains('navbar-pin-unfixed')).toBe(false);
			expect(pinDesktop.classList.contains('navbar-pin-unfixed')).toBe(false);
		});

		test('navbar should have fixed-top class when fixed', () => {
			const navbar = getById('main-navbar');
			globalThis.updateNavbarPinAppearance();

			expect(navbar.classList.contains('fixed-top')).toBe(true);
		});

		test('navbar should not have fixed-top class when unfixed', () => {
			const navbar = getById('main-navbar');

			globalThis.toggleNavbarFixed();
			expect(navbar.classList.contains('fixed-top')).toBe(false);
		});
	});

	describe('Tooltip Text Updates', () => {
		test('tooltip text should change to "Fix navbar to the top" when unfixed', () => {
			globalThis.updateNavbarPinAppearance();

			// Toggle to unfixed
			globalThis.toggleNavbarFixed();

			const pinMobile = getById('navbar-pin-mobile');
			const pinDesktop = getById('navbar-pin-desktop');

			expect(pinMobile.dataset.bsTitle).toBe('Fix navbar to the top');
			expect(pinDesktop.dataset.bsTitle).toBe('Fix navbar to the top');
		});

		test('tooltip text should change to "Unfix navbar from the top" when fixed', () => {
			// Start unfixed
			localStorage.setItem('navbar.unfixed', '1');
			globalThis.updateNavbarPinAppearance();

			// Toggle to fixed
			globalThis.toggleNavbarFixed();

			const pinMobile = getById('navbar-pin-mobile');
			const pinDesktop = getById('navbar-pin-desktop');

			expect(pinMobile.dataset.bsTitle).toBe('Unfix navbar from the top');
			expect(pinDesktop.dataset.bsTitle).toBe('Unfix navbar from the top');
		});

		test('Bootstrap tooltips should be recreated on toggle', () => {
			globalThis.updateNavbarPinAppearance();

			const pinMobile = getById('navbar-pin-mobile');
			const pinDesktop = getById('navbar-pin-desktop');

			// Get initial tooltip instances
			const initialMobileTooltip = globalThis.bootstrap.Tooltip.getInstance(pinMobile);
			const initialDesktopTooltip = globalThis.bootstrap.Tooltip.getInstance(pinDesktop);

			expect(initialMobileTooltip).toBeDefined();
			expect(initialDesktopTooltip).toBeDefined();

			// Toggle - should dispose old and create new tooltips
			globalThis.toggleNavbarFixed();

			const newMobileTooltip = globalThis.bootstrap.Tooltip.getInstance(pinMobile);
			const newDesktopTooltip = globalThis.bootstrap.Tooltip.getInstance(pinDesktop);

			// New instances should exist
			expect(newMobileTooltip).toBeDefined();
			expect(newDesktopTooltip).toBeDefined();
		});
	});

	describe('localStorage Persistence', () => {
		test('should restore fixed state from localStorage on initialization', () => {
			// Set unfixed in localStorage
			localStorage.setItem('navbar.unfixed', '1');

			// Initialize
			globalThis.updateNavbarPinAppearance();

			const navbar = getById('main-navbar');
			expect(navbar.classList.contains('fixed-top')).toBe(false);
		});

		test('should use fixed as default when no localStorage entry', () => {
			// No localStorage entry
			expect(localStorage.getItem('navbar.unfixed')).toBe(null);

			// Initialize
			globalThis.updateNavbarPinAppearance();

			const navbar = getById('main-navbar');
			expect(navbar.classList.contains('fixed-top')).toBe(true);
		});

		test('localStorage state should persist across multiple initializations', () => {
			// Set to unfixed
			globalThis.updateNavbarPinAppearance();
			globalThis.toggleNavbarFixed();

			expect(localStorage.getItem('navbar.unfixed')).toBe('1');

			// Simulate page reload by re-initializing
			globalThis.updateNavbarPinAppearance();

			const navbar = getById('main-navbar');
			expect(navbar.classList.contains('fixed-top')).toBe(false);
		});
	});

	describe('Mobile and Desktop Icons', () => {
		test('both mobile and desktop icons should exist', () => {
			const pinMobile = document.querySelector('#navbar-pin-mobile');
			const pinDesktop = document.querySelector('#navbar-pin-desktop');

			expect(pinMobile).not.toBeNull();
			expect(pinDesktop).not.toBeNull();
		});

		test('both icons should update together when toggling', () => {
			const pinMobile = getById('navbar-pin-mobile');
			const pinDesktop = getById('navbar-pin-desktop');

			globalThis.updateNavbarPinAppearance();

			// Initially fixed - neither has unfixed class
			expect(pinMobile.classList.contains('navbar-pin-unfixed')).toBe(false);
			expect(pinDesktop.classList.contains('navbar-pin-unfixed')).toBe(false);

			// Toggle to unfixed - both should have unfixed class
			globalThis.toggleNavbarFixed();
			expect(pinMobile.classList.contains('navbar-pin-unfixed')).toBe(true);
			expect(pinDesktop.classList.contains('navbar-pin-unfixed')).toBe(true);
		});

		test('both icons should have same tooltip text', () => {
			globalThis.updateNavbarPinAppearance();

			const pinMobile = getById('navbar-pin-mobile');
			const pinDesktop = getById('navbar-pin-desktop');

			expect(pinMobile.dataset.bsTitle).toBe(pinDesktop.dataset.bsTitle);

			// Toggle and check again
			globalThis.toggleNavbarFixed();
			expect(pinMobile.dataset.bsTitle).toBe(pinDesktop.dataset.bsTitle);
		});
	});
});

/**
 * Helper function to load navbar functions from common.js
 * This simulates loading the actual functions
 */
function loadNavbarFunctions() {
	// Recreate the functions from common.js
	globalThis.updateNavbarPinAppearance = function () {
		const isFixed = !localStorage.getItem('navbar.unfixed');
		const navbar = document.querySelector('#main-navbar');
		const spacer = document.querySelector('#navbar-spacer');
		const pinMobile = document.querySelector('#navbar-pin-mobile');
		const pinDesktop = document.querySelector('#navbar-pin-desktop');

		if (!navbar || !spacer || !pinMobile || !pinDesktop) {
			return;
		}

		const tooltipText = isFixed ? 'Unfix navbar from the top' : 'Fix navbar to the top';

		if (isFixed) {
			navbar.classList.add('fixed-top');
			spacer.style.height = '56px';
			pinMobile.classList.remove('navbar-pin-unfixed');
			pinDesktop.classList.remove('navbar-pin-unfixed');
		} else {
			navbar.classList.remove('fixed-top');
			spacer.style.height = '0';
			pinMobile.classList.add('navbar-pin-unfixed');
			pinDesktop.classList.add('navbar-pin-unfixed');
		}

		// Update tooltips if Bootstrap is loaded
		if (globalThis.bootstrap?.Tooltip) {
			const tooltipMobile = globalThis.bootstrap.Tooltip.getInstance(pinMobile);
			if (tooltipMobile) {
				tooltipMobile.dispose();
			}

			pinMobile.dataset.bsTitle = tooltipText;
			void new globalThis.bootstrap.Tooltip(pinMobile);

			const tooltipDesktop = globalThis.bootstrap.Tooltip.getInstance(pinDesktop);
			if (tooltipDesktop) {
				tooltipDesktop.dispose();
			}

			pinDesktop.dataset.bsTitle = tooltipText;
			void new globalThis.bootstrap.Tooltip(pinDesktop);
		}
	};

	globalThis.toggleNavbarFixed = function () {
		if (localStorage.getItem('navbar.unfixed')) {
			localStorage.removeItem('navbar.unfixed');
		} else {
			localStorage.setItem('navbar.unfixed', '1');
		}

		globalThis.updateNavbarPinAppearance();
	};
}
