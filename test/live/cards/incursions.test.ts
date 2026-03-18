/**
 * Tests for Steel Path Incursions card
 */
import {describe, test, expect} from 'vitest';
import {getById} from '../../helpers/dom-helpers';
import {testCardFilters} from '../card-filters-factory';

// Test generic card filter integration for Incursions card
// This verifies: gear icon, accordion, checkboxes, localStorage persistence, auto-expand
testCardFilters('incursions');

describe('Incursions Card - DOM Structure', () => {
	test('incursions body element exists', () => {
		const incursionsBody = getById('incursions-body');
		expect(incursionsBody).toBeTruthy();
	});

	test('incursions body has six placeholder spans', () => {
		const spans = document.querySelectorAll('#incursions-body span.d-block');
		// Live.php renders 6 spans (one per incursion slot)
		expect(spans.length).toBe(6);
	});

	test('empty message element exists and is hidden by default', () => {
		const message = getById('incursions-empty-message');
		expect(message).toBeTruthy();
		expect(message.classList.contains('d-none')).toBe(true);
	});

	test('filter panel has checkboxes for all expected mission types', () => {
		const expectedTypes = [
			'MT_ALCHEMY',
			'MT_ASCENSION',
			'MT_ASSASSINATION',
			'MT_ASSAULT',
			'MT_CAPTURE',
			'MT_EVACUATION',
			'MT_DEFENSE',
			'MT_ARTIFACT',
			'MT_EXCAVATE',
			'MT_EXTERMINATION',
			'MT_RETRIEVAL',
			'MT_HIVE',
			'MT_PURIFY',
			'MT_TERRITORY',
			'MT_MOBILE_DEFENSE',
			'MT_PURSUIT',
			'MT_RESCUE',
			'MT_RUSH',
			'MT_SABOTAGE',
			'MT_OFFERING',
			'MT_SPY',
			'MT_SURVIVAL',
			'MT_ARMAGEDDON',
			'MT_VOID_CASCADE',
			'MT_CORRUPTION',
		];
		for (const type of expectedTypes) {
			const checkbox = document.querySelector(`#incursions-filters input[data-filter-type="${type}"]`);
			expect(checkbox, `Expected checkbox for ${type}`).toBeTruthy();
		}
	});
});
