import {test, expect} from '@playwright/test';
import {setupMockRoutes} from '../helpers/api-mocks';

async function setupPage(page: any) {
	await setupMockRoutes(page);
	await page.goto('/live.php');
	await page.waitForSelector('#netracell-checks .completion-check', {timeout: 15_000});
	await page.waitForSelector('#labConquest-header .completion-check', {timeout: 15_000});
	await page.waitForSelector('#hexConquest-header .completion-check', {timeout: 15_000});
}

test('checking a middle Netracell checks all boxes to its left', async ({page}) => {
	await setupPage(page);

	const netracellChecks = page.locator('#netracell-checks .completion-check');

	// Click box 4 (index 3) — boxes 1, 2, 3 should become checked
	await netracellChecks.nth(3).click();
	await expect(netracellChecks.nth(0).locator('i')).toHaveClass(/bi-check-square/u);
	await expect(netracellChecks.nth(1).locator('i')).toHaveClass(/bi-check-square/u);
	await expect(netracellChecks.nth(2).locator('i')).toHaveClass(/bi-check-square/u);
	await expect(netracellChecks.nth(4).locator('i')).toHaveClass(/bi-square/u);
});

test('unchecking a middle Netracell unchecks all boxes to its right', async ({page}) => {
	await setupPage(page);

	const netracellChecks = page.locator('#netracell-checks .completion-check');

	// Check all boxes first
	for (let i = 0; i < 5; i++) {
		await netracellChecks.nth(i).click();
	}

	// Uncheck box 2 (index 1) — boxes 3, 4, 5 should become unchecked
	await netracellChecks.nth(1).click();
	await expect(netracellChecks.nth(0).locator('i')).toHaveClass(/bi-check-square/u);
	await expect(netracellChecks.nth(2).locator('i')).toHaveClass(/bi-square/u);
	await expect(netracellChecks.nth(3).locator('i')).toHaveClass(/bi-square/u);
	await expect(netracellChecks.nth(4).locator('i')).toHaveClass(/bi-square/u);
});

test('Netracell checkboxes are linked to the Archimedeas\' and persist after reload', async ({page}) => {
	await setupPage(page);

	const netracellChecks = page.locator('#netracell-checks .completion-check');
	const deepArch = page.locator('#labConquest-header .completion-check');
	const temporaryArch = page.locator('#hexConquest-header .completion-check');

	// Click the first Netracell box
	await netracellChecks.nth(0).click();
	await expect(netracellChecks.nth(0).locator('i')).toHaveClass(/bi-check-square/u);

	// Click Deep Archimedea — should add 2 more Netracell checks (boxes 2 and 3)
	await deepArch.click();
	await expect(netracellChecks.nth(1).locator('i')).toHaveClass(/bi-check-square/u);
	await expect(netracellChecks.nth(2).locator('i')).toHaveClass(/bi-check-square/u);
	await expect(netracellChecks.nth(3).locator('i')).toHaveClass(/bi-square/u);
	await expect(netracellChecks.nth(4).locator('i')).toHaveClass(/bi-square/u);

	// Click Temporal Archimedea — should add 2 more (boxes 4 and 5)
	await temporaryArch.click();
	await expect(netracellChecks.nth(3).locator('i')).toHaveClass(/bi-check-square/u);
	await expect(netracellChecks.nth(4).locator('i')).toHaveClass(/bi-check-square/u);

	// All 5 Netracell boxes should now be checked
	for (let i = 0; i < 5; i++) {
		await expect(netracellChecks.nth(i).locator('i')).toHaveClass(/bi-check-square/u);
	}

	// Uncheck the last Netracell box — 4 checked
	await netracellChecks.nth(4).click();
	await expect(netracellChecks.nth(4).locator('i')).toHaveClass(/bi-square/u);
	for (let i = 0; i < 4; i++) {
		await expect(netracellChecks.nth(i).locator('i')).toHaveClass(/bi-check-square/u);
	}

	// Uncheck Temporal Archimedea — removes 2, leaving 2 checked
	await temporaryArch.click();
	await expect(netracellChecks.nth(0).locator('i')).toHaveClass(/bi-check-square/u);
	await expect(netracellChecks.nth(1).locator('i')).toHaveClass(/bi-check-square/u);
	await expect(netracellChecks.nth(2).locator('i')).toHaveClass(/bi-square/u);
	await expect(netracellChecks.nth(3).locator('i')).toHaveClass(/bi-square/u);
	await expect(netracellChecks.nth(4).locator('i')).toHaveClass(/bi-square/u);

	// Uncheck Deep Archimedea — removes 2, leaving 0 checked
	await deepArch.click();
	for (let i = 0; i < 5; i++) {
		await expect(netracellChecks.nth(i).locator('i')).toHaveClass(/bi-square/u);
	}

	// Reload and verify all boxes are still unchecked
	await page.reload();
	await page.waitForSelector('#netracell-checks .completion-check', {timeout: 15_000});

	const netracellChecksAfterReload = page.locator('#netracell-checks .completion-check');
	for (let i = 0; i < 5; i++) {
		await expect(netracellChecksAfterReload.nth(i).locator('i')).toHaveClass(/bi-square/u);
	}
});
