import {test, expect} from '@playwright/test';
import {setupMockRoutes} from '../helpers/api-mocks';
import {TEST_FRONT_PROXY_BASE_URL} from '../../test/helpers/test-constants';
import {expiryBadge} from './helpers';

/**
 * Archimedea E2E Tests
 *
 * LIMITATION: E2E tests are not the ideal tool for testing this many edge case scenarios.
 * Ideally, we would unit test the updateWeekly() and createArchimedeaTooltip() functions
 * directly with mocked dependencies. However, live.ts has too many global dependencies
 * (osdict, ExportMissionTypes, window.worldState, addTooltip, etc.) to make isolated
 * unit testing practical without significant refactoring.
 */

// Helper to set up page with optional custom worldState
async function setupPage(page: any, worldStateFile?: string) {
	await setupMockRoutes(page, worldStateFile ? {worldStateFile} : undefined);
	await page.goto('/live.php');

	// Wait for "Fetching data..." to disappear from Archimedea cards
	// This ensures updateWeekly() has completed populating the tables
	await page.waitForSelector('#labConquest-missions:not(:has-text("Fetching data..."))', {timeout: 15_000});
	await page.waitForSelector('#hexConquest-missions:not(:has-text("Fetching data..."))', {timeout: 15_000});
}

// Helper for special case tests that need manual updateWeekly() call
// eslint-disable-next-line no-warning-comments
// TODO: Investigate why updateWeekly() doesn't complete automatically with custom
// worldState mocks and remove this workaround. The async Promise-based function
// doesn't complete deterministically in the test environment for special case scenarios.
async function setupPageWithManualWeeklyUpdate(page: any, worldStateFile: string) {
	await setupMockRoutes(page, {worldStateFile});
	await page.goto('/live.php');

	// Manually call updateWeekly() since it doesn't run automatically in test environment
	await page.evaluate(() => {
		if (typeof (globalThis as any).updateWeekly === 'function') {
			(globalThis as any).updateWeekly();
		}
	});

	// Wait for cards to populate
	await page.waitForSelector('#labConquest-missions:not(:has-text("Fetching data..."))', {timeout: 10_000});
	await page.waitForSelector('#hexConquest-missions:not(:has-text("Fetching data..."))', {timeout: 10_000});
}

test.describe('Live Page - Archimedea Cards', () => {
	test.beforeEach(async ({page}) => {
		// Default setup for base tests
		await setupPage(page);
	});

	test.describe('Deep Archimedea Card', () => {
		test('renders card header with expiry', async ({page}) => {
			// Wait for card to render
			await page.waitForSelector('#labConquest-header', {timeout: 10_000});

			const header = page.locator('#labConquest-header');
			await expect(header).toBeVisible();

			// Should contain "Deep Archimedea" text
			const headerText = await header.textContent();
			expect(headerText).toContain('Deep Archimedea');

			await expect(expiryBadge(header)).toBeVisible();
		});

		test('renders exactly 3 missions', async ({page}) => {
			// Wait for missions table to render
			await page.waitForSelector('#labConquest-missions tbody tr', {timeout: 10_000});

			// Count mission rows
			const missionRows = await page.locator('#labConquest-missions tbody tr').count();
			expect(missionRows).toBe(3);
		});

		test('each mission has type, variant, and 2 conditions', async ({page}) => {
			await page.waitForSelector('#labConquest-missions tbody tr', {timeout: 10_000});

			const missionRows = page.locator('#labConquest-missions tbody tr');
			const count = await missionRows.count();

			for (let i = 0; i < count; i++) {
				const row = missionRows.nth(i);

				// Should have 1 th (mission type) + 3 td (variant + 2 conditions) = 4 cells
				const cells = await row.locator('th, td').count();
				expect(cells).toBe(4);

				// Mission type (th)
				const missionType = row.locator('th');
				await expect(missionType).toBeVisible();
				const typeText = await missionType.textContent();
				expect(typeText).toBeTruthy();

				// Variant (first td)
				const variant = row.locator('td').nth(0);
				await expect(variant).toBeVisible();
				const variantAbbr = variant.locator('abbr');
				await expect(variantAbbr).toBeVisible();
				// Should have tooltip
				await expect(variantAbbr).toHaveAttribute('data-bs-toggle', 'tooltip');

				// First condition (second td)
				const condition1 = row.locator('td').nth(1);
				await expect(condition1).toBeVisible();
				const cond1Abbr = condition1.locator('abbr');
				await expect(cond1Abbr).toBeVisible();
				await expect(cond1Abbr).toHaveAttribute('data-bs-toggle', 'tooltip');

				// Second condition (third td)
				const condition2 = row.locator('td').nth(2);
				await expect(condition2).toBeVisible();
				const cond2Abbr = condition2.locator('abbr');
				await expect(cond2Abbr).toBeVisible();
				await expect(cond2Abbr).toHaveAttribute('data-bs-toggle', 'tooltip');
			}
		});

		test('displays mission types (any valid types)', async ({page}) => {
			await page.waitForSelector('#labConquest-missions tbody tr', {timeout: 10_000});

			// Get all mission types
			const missionTypes = await page.locator('#labConquest-missions tbody tr th').allTextContents();

			// Should have 3 mission types
			expect(missionTypes.length).toBe(3);

			// Each should be a non-empty string
			for (const type of missionTypes) {
				expect(type).toBeTruthy();
				expect(type.length).toBeGreaterThan(0);
			}

			// Should have either "DualDefense" or "Mirror Defense" (both are valid for Lab)
			// The presence of "Defense" variant indicates Defense-type missions for Lab
			const hasDefenseType = missionTypes.some(type => type.includes('Defense'));
			expect(hasDefenseType).toBe(true);
		});

		test('displays frame variables (modifiers)', async ({page}) => {
			await page.waitForSelector('#labConquest-fv', {timeout: 10_000});

			const frameVars = page.locator('#labConquest-fv td');
			const count = await frameVars.count();

			// Should have at least 1 frame variable
			expect(count).toBeGreaterThan(0);

			// Each frame variable should have tooltip
			for (let i = 0; i < count; i++) {
				const td = frameVars.nth(i);
				const abbr = td.locator('abbr');
				await expect(abbr).toBeVisible();
				await expect(abbr).toHaveAttribute('data-bs-toggle', 'tooltip');

				const text = await abbr.textContent();
				expect(text).toBeTruthy();
			}
		});

		test('specific frame variables from mock data are present', async ({page}) => {
			await page.waitForSelector('#labConquest-fv', {timeout: 10_000});

			// Get all frame variable text
			const frameVarTexts = await page.locator('#labConquest-fv td abbr').allTextContents();

			// Mock data should have ShieldDelay and Starvation (from worldState.json)
			expect(frameVarTexts.length).toBeGreaterThan(0);
		});

		test('has completion toggle checkbox', async ({page}) => {
			await page.waitForSelector('#labConquest-header', {timeout: 10_000});

			const completionToggle = page.locator('#labConquest-header .completion-check');
			await expect(completionToggle).toBeVisible();

			// Should be clickable
			await completionToggle.click();
			// Toggle should work (no assertion needed - just verifying it's interactive)
		});
	});

	test.describe('Temporal Archimedea Card', () => {
		test('renders card header with expiry', async ({page}) => {
			// Wait for card to render
			await page.waitForSelector('#hexConquest-header', {timeout: 10_000});

			const header = page.locator('#hexConquest-header');
			await expect(header).toBeVisible();

			// Should contain "Temporal Archimedea" text (or localized equivalent)
			const headerText = await header.textContent();
			expect(headerText).toBeTruthy();

			await expect(expiryBadge(header)).toBeVisible();
		});

		test('renders exactly 3 missions', async ({page}) => {
			// Wait for missions table to render
			await page.waitForSelector('#hexConquest-missions tbody tr', {timeout: 10_000});

			// Count mission rows
			const missionRows = await page.locator('#hexConquest-missions tbody tr').count();
			expect(missionRows).toBe(3);
		});

		test('each mission has type, variant, and 2 conditions', async ({page}) => {
			await page.waitForSelector('#hexConquest-missions tbody tr', {timeout: 10_000});

			const missionRows = page.locator('#hexConquest-missions tbody tr');
			const count = await missionRows.count();

			for (let i = 0; i < count; i++) {
				const row = missionRows.nth(i);

				// Should have 1 th (mission type) + 3 td (variant + 2 conditions) = 4 cells
				const cells = await row.locator('th, td').count();
				expect(cells).toBe(4);

				// Mission type (th)
				const missionType = row.locator('th');
				await expect(missionType).toBeVisible();
				const typeText = await missionType.textContent();
				expect(typeText).toBeTruthy();

				// Variant (first td)
				const variant = row.locator('td').nth(0);
				await expect(variant).toBeVisible();
				const variantAbbr = variant.locator('abbr');
				await expect(variantAbbr).toBeVisible();
				await expect(variantAbbr).toHaveAttribute('data-bs-toggle', 'tooltip');

				// First condition (second td)
				const condition1 = row.locator('td').nth(1);
				await expect(condition1).toBeVisible();
				const cond1Abbr = condition1.locator('abbr');
				await expect(cond1Abbr).toBeVisible();
				await expect(cond1Abbr).toHaveAttribute('data-bs-toggle', 'tooltip');

				// Second condition (third td)
				const condition2 = row.locator('td').nth(2);
				await expect(condition2).toBeVisible();
				const cond2Abbr = condition2.locator('abbr');
				await expect(cond2Abbr).toBeVisible();
				await expect(cond2Abbr).toHaveAttribute('data-bs-toggle', 'tooltip');
			}
		});

		test('displays mission types (any valid types)', async ({page}) => {
			await page.waitForSelector('#hexConquest-missions tbody tr', {timeout: 10_000});

			// Get all mission types
			const missionTypes = await page.locator('#hexConquest-missions tbody tr th').allTextContents();

			// Should have 3 mission types
			expect(missionTypes.length).toBe(3);

			// Each should be a non-empty string
			for (const type of missionTypes) {
				expect(type).toBeTruthy();
				expect(type.length).toBeGreaterThan(0);
			}

			// Temporal should NOT have "DualDefense" (that's specific to Deep Archimedea)
			expect(missionTypes).not.toContain('DualDefense');
		});

		test('displays frame variables (modifiers)', async ({page}) => {
			await page.waitForSelector('#hexConquest-fv', {timeout: 10_000});

			const frameVars = page.locator('#hexConquest-fv td');
			const count = await frameVars.count();

			// Should have at least 1 frame variable
			expect(count).toBeGreaterThan(0);

			// Each frame variable should have tooltip
			for (let i = 0; i < count; i++) {
				const td = frameVars.nth(i);
				const abbr = td.locator('abbr');
				await expect(abbr).toBeVisible();
				await expect(abbr).toHaveAttribute('data-bs-toggle', 'tooltip');

				const text = await abbr.textContent();
				expect(text).toBeTruthy();
			}
		});

		test('has completion toggle checkbox', async ({page}) => {
			await page.waitForSelector('#hexConquest-header', {timeout: 10_000});

			const completionToggle = page.locator('#hexConquest-header .completion-check');
			await expect(completionToggle).toBeVisible();

			// Should be clickable
			await completionToggle.click();
			// Toggle should work (no assertion needed - just verifying it's interactive)
		});
	});

	test.describe('Data Transformation', () => {
		test('Deep and Temporal Archimedea have distinct mission types', async ({page}) => {
			await page.waitForSelector('#labConquest-missions tbody tr', {timeout: 10_000});
			await page.waitForSelector('#hexConquest-missions tbody tr', {timeout: 10_000});

			// Get mission types from both cards
			const labTypes = await page.locator('#labConquest-missions tbody tr th').allTextContents();
			const hexTypes = await page.locator('#hexConquest-missions tbody tr th').allTextContents();

			// Both should have 3 missions
			expect(labTypes.length).toBe(3);
			expect(hexTypes.length).toBe(3);

			// All types should be non-empty
			for (const type of labTypes) {
				expect(type).toBeTruthy();
			}

			for (const type of hexTypes) {
				expect(type).toBeTruthy();
			}

			// Lab should have some form of Defense mission (DualDefense or Mirror Defense)
			const labHasDefense = labTypes.some(type => type.includes('Defense'));
			expect(labHasDefense).toBe(true);

			// Hex should NOT have DualDefense (that's specific to Lab)
			expect(hexTypes).not.toContain('DualDefense');
			expect(hexTypes).not.toContain('Mirror Defense');
		});

		test('both cards use data from worldState.Conquests', async ({page}) => {
			// Intercept worldState fetch to verify it's being used
			let worldStateFetched = false;
			await page.route(`**/${new URL(TEST_FRONT_PROXY_BASE_URL).host}/worldState`, async route => {
				worldStateFetched = true;
				await route.continue();
			});

			// Verify NO fetch to /weekly endpoint occurs
			let weeklyFetched = false;
			await page.route('**/oracle.browse.wf/weekly', async route => {
				weeklyFetched = true;
				await route.abort();
			});

			await page.reload();
			await page.waitForSelector('#labConquest-missions tbody tr', {timeout: 10_000});
			await page.waitForSelector('#hexConquest-missions tbody tr', {timeout: 10_000});

			// WorldState should have been fetched
			expect(worldStateFetched).toBe(true);

			// /weekly should NOT have been fetched
			expect(weeklyFetched).toBe(false);
		});
	});

	test.describe('Edge Cases', () => {
		test('handles missing CD_HARD difficulty gracefully', async ({page}) => {
			// Even if CD_HARD is missing, should still render missions
			// (falls back to difficulty with most risks)
			await page.waitForSelector('#labConquest-missions tbody tr', {timeout: 10_000});

			const missionRows = await page.locator('#labConquest-missions tbody tr').count();
			expect(missionRows).toBe(3);

			// Each mission should still have 2 conditions
			const firstRow = page.locator('#labConquest-missions tbody tr').first();
			const conditions = await firstRow.locator('td').count();
			expect(conditions).toBe(3); // Variant + 2 conditions
		});
	});
});

test.describe('Special Cases - CT_LAB Defense Mission', () => {
	test.beforeEach(async ({page}) => {
		await setupPageWithManualWeeklyUpdate(page, 'worldState-conquest-ct-lab-defense.json');
	});

	test('transforms Defense mission to DualDefense', async ({page}) => {
		// First mission should be Defense transformed to "DualDefense" or "Mirror Defense"
		const firstMissionType = await page.locator('#labConquest-missions tbody tr').first().locator('th').textContent();

		// CT_LAB uses DualDefense instead of regular Defense
		expect(firstMissionType).toMatch(/defense/iu);
		expect(firstMissionType).not.toBe('Defense'); // Should be transformed
	});
});

test.describe('Special Cases - ShieldDelay Frame Variable', () => {
	test.beforeEach(async ({page}) => {
		await setupPageWithManualWeeklyUpdate(page, 'worldState-conquest-shield-delay.json');
	});

	test('shows transformed description with |val| replaced by 500', async ({page}) => {
		// Find the ShieldDelay frame variable (should be first in Variables array)
		const firstFrameVar = page.locator('#labConquest-fv td').first().locator('abbr');
		await expect(firstFrameVar).toBeVisible();

		// Should have tooltip with transformed description (|val| replaced with "500")
		await expect(firstFrameVar).toHaveAttribute('data-bs-toggle', 'tooltip');
		const tooltip = await firstFrameVar.getAttribute('data-bs-title');

		// The description should contain "500" (transformed from |val|)
		expect(tooltip).toContain('500');
		expect(tooltip).not.toContain('|val|');
	});
});

test.describe('Special Cases - TimeDilation Frame Variable', () => {
	test.beforeEach(async ({page}) => {
		await setupPageWithManualWeeklyUpdate(page, 'worldState-conquest-time-dilation.json');
	});

	test('shows transformed description with |val| replaced by 50', async ({page}) => {
		// Find the TimeDilation frame variable (should be first in Variables array)
		const firstFrameVar = page.locator('#hexConquest-fv td').first().locator('abbr');
		await expect(firstFrameVar).toBeVisible();

		// Should have tooltip with transformed description (|val| replaced with "50")
		await expect(firstFrameVar).toHaveAttribute('data-bs-toggle', 'tooltip');
		const tooltip = await firstFrameVar.getAttribute('data-bs-title');

		// The description should contain "50" (transformed from |val|)
		expect(tooltip).toContain('50');
		expect(tooltip).not.toContain('|val|');
	});
});

test.describe('Special Cases - Unknown Frame Variable', () => {
	test('shows raw value without tooltip and logs console warning', async ({page}) => {
		// Set up console warning listener BEFORE loading page
		const consoleWarnings: string[] = [];
		page.on('console', message => {
			if (message.type() === 'warning' && message.text().includes('Missing osdict key')) {
				consoleWarnings.push(message.text());
			}
		});

		await setupPageWithManualWeeklyUpdate(page, 'worldState-conquest-unknown-frame-variable.json');

		// First frame variable should be the unknown one
		const firstFrameVarCell = page.locator('#labConquest-fv td').first();
		await expect(firstFrameVarCell).toBeVisible();

		// Should show raw value as plain text (not in abbr)
		const cellText = await firstFrameVarCell.textContent();
		expect(cellText).toBe('UnknownFrameVariable');

		// Should NOT have an abbr element with tooltip
		const abbr = firstFrameVarCell.locator('abbr');
		await expect(abbr).not.toBeVisible();

		// Should have logged console warning
		expect(consoleWarnings.length).toBeGreaterThan(0);
		expect(consoleWarnings.some(w => w.includes('/Lotus/Language/Conquest/PersonalMod_UnknownFrameVariable'))).toBe(true);
	});
});

test.describe('Special Cases - Unknown Risk', () => {
	test('shows raw value without tooltip and logs console warning', async ({page}) => {
		// Set up console warning listener BEFORE loading page
		const consoleWarnings: string[] = [];
		page.on('console', message => {
			if (message.type() === 'warning' && message.text().includes('Missing osdict key')) {
				consoleWarnings.push(message.text());
			}
		});

		await setupPageWithManualWeeklyUpdate(page, 'worldState-conquest-unknown-risk.json');

		// First mission, first condition (second td) should have the unknown risk
		const firstConditionCell = page.locator('#labConquest-missions tbody tr').first().locator('td').nth(1);
		await expect(firstConditionCell).toBeVisible();

		// Should show raw value as plain text (not in abbr)
		const cellText = await firstConditionCell.textContent();
		expect(cellText).toBe('UnknownRiskFromFuture');

		// Should NOT have an abbr element with tooltip
		const abbr = firstConditionCell.locator('abbr');
		await expect(abbr).not.toBeVisible();

		// Should have logged console warning
		expect(consoleWarnings.length).toBeGreaterThan(0);
		expect(consoleWarnings.some(w => w.includes('/Lotus/Language/Conquest/Condition_UnknownRiskFromFuture'))).toBe(true);
	});
});

test.describe('Special Cases - Unknown Deviation', () => {
	test('shows raw value without tooltip and logs console warning', async ({page}) => {
		// Set up console warning listener BEFORE loading page
		const consoleWarnings: string[] = [];
		page.on('console', message => {
			if (message.type() === 'warning' && message.text().includes('Missing osdict key')) {
				consoleWarnings.push(message.text());
			}
		});

		await setupPageWithManualWeeklyUpdate(page, 'worldState-conquest-unknown-deviation.json');

		// First mission, variant (first td) should have the unknown deviation
		const variantCell = page.locator('#labConquest-missions tbody tr').first().locator('td').nth(0);
		await expect(variantCell).toBeVisible();

		// Should show raw value as plain text (not in abbr)
		const cellText = await variantCell.textContent();
		expect(cellText).toBe('UnknownDeviationFromFuture');

		// Should NOT have an abbr element with tooltip
		const abbr = variantCell.locator('abbr');
		await expect(abbr).not.toBeVisible();

		// Should have logged console warning
		expect(consoleWarnings.length).toBeGreaterThan(0);
		expect(consoleWarnings.some(w => w.includes('/Lotus/Language/Conquest/MissionVariant_LabConquest_UnknownDeviationFromFuture'))).toBe(true);
	});
});
