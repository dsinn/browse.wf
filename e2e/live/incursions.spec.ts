import {test, expect} from '@playwright/test';
import {setupMockRoutes} from '../helpers/api-mocks';
import {openFilterPanel} from '../helpers/dom-helpers';

test.describe('Live Page - Steel Path Incursions Card', () => {
	test.beforeEach(async ({page}) => {
		await setupMockRoutes(page);
		await page.goto('/live');
		// Incursions are loaded via sp-incursions.txt (static file, always has current data).
		// Resume real time so the time-based lookup into the file works correctly.
		await page.clock.resume();
		await expect(page.locator('#incursions-body').getByText('Fetching')).toBeHidden({timeout: 10_000});
	});

	test('incursion location has tileset tooltip attribute', async ({page}) => {
		const rows = page.locator('#incursions-body span.d-block:not(.d-none)');
		const count = await rows.count();
		expect(count).toBeGreaterThan(0);

		for (let i = 0; i < count; i++) {
			const tooltipElement = rows.nth(i).locator('[data-bs-toggle="tooltip"]');
			await expect(tooltipElement).toBeVisible();
			const locationText = await tooltipElement.textContent();
			const title = await tooltipElement.getAttribute('data-bs-title');
			expect(title, `Row ${i + 1} (${locationText}) should have a non-empty tileset tooltip`).toBeTruthy();
		}
	});

	test('filter gear icon toggles filter panel visibility', async ({page}) => {
		const filterPanel = page.locator('#incursions-filters');

		await expect(filterPanel).toBeHidden();
		await openFilterPanel(page, 'incursions');
		await expect(filterPanel).toBeVisible();

		// All 26 mission type checkboxes should be present
		const checkboxes = await page.locator('#incursions-filters input[type="checkbox"]').count();
		expect(checkboxes).toBe(26);
	});

	test('filter preference persists across page reload', async ({page}) => {
		await openFilterPanel(page, 'incursions');

		const firstCheckbox = page.locator('#incursions-filters input[type="checkbox"]').first();
		const checkboxId = await firstCheckbox.getAttribute('id');
		const filterType = checkboxId!.replace('filter-incursions-', '');
		const localStorageKey = `live.filter.incursions.${filterType}`;

		if (await firstCheckbox.isChecked()) {
			await firstCheckbox.click();
		}

		await expect(firstCheckbox).not.toBeChecked();
		await page.waitForFunction(key => localStorage.getItem(key) === '0', localStorageKey);

		await page.reload();
		await page.clock.resume();
		await expect(page.locator('#incursions-body').getByText('Fetching')).toBeHidden({timeout: 10_000});

		await openFilterPanel(page, 'incursions');
		await expect(page.locator(`#${checkboxId}`)).not.toBeChecked();
	});
});
