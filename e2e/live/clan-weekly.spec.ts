import {test, expect} from '@playwright/test';
import {setupMockRoutes, reloadWithFrozenClock} from '../helpers/api-mocks';
import {expiryBadge, mockLiveExports} from './helpers';

test.describe('Live Page - Clan Weekly Initiatives Card', () => {
	test.beforeEach(async ({page}) => {
		await setupMockRoutes(page);
		await mockLiveExports(page);
		await page.goto('/live');
		await page.waitForSelector('#clan-weekly-body table', {timeout: 10_000});
	});

	test.describe('Card Structure', () => {
		test('card header shows "Clan Weekly"', async ({page}) => {
			const header = page.locator('.card').filter({hasText: 'Clan Weekly'}).locator('.card-header h5');
			await expect(header).toContainText('Clan Weekly');
		});

		test('collapse toggle is present in header', async ({page}) => {
			const toggle = page.locator('[data-collapse-toggle="clan-weekly"]');
			await expect(toggle).toBeVisible();
		});

		test('expiry badge is visible in the card header', async ({page}) => {
			await expect(expiryBadge(page.locator('#clan-weekly-expiry'))).toBeVisible();
		});

		test('completion toggle checkbox is present in header', async ({page}) => {
			const checkbox = page.locator('#clan-weekly-checks .completion-check');
			await expect(checkbox).toBeVisible();
		});

		test('card body is visible initially', async ({page}) => {
			await expect(page.locator('#clan-weekly-body')).toBeVisible();
		});
	});

	test.describe('Collapse', () => {
		test('clicking collapse toggle hides card body', async ({page}) => {
			const toggle = page.locator('[data-collapse-toggle="clan-weekly"]');
			const body = page.locator('#clan-weekly-body');

			await expect(body).toBeVisible();
			await toggle.click();
			await expect(body).toBeHidden();
		});

		test('clicking collapse toggle again shows card body', async ({page}) => {
			const toggle = page.locator('[data-collapse-toggle="clan-weekly"]');
			const body = page.locator('#clan-weekly-body');

			await toggle.click();
			await expect(body).toBeHidden();

			await toggle.click();
			await expect(body).toBeVisible();
		});
	});

	test.describe('Completion Toggle', () => {
		test('completion toggle is enabled', async ({page}) => {
			const checkbox = page.locator('#clan-weekly-checks .completion-check');
			await expect(checkbox).toBeEnabled();
		});

		test('clicking marks it as completed (bi-check-square icon)', async ({page}) => {
			const checkbox = page.locator('#clan-weekly-checks .completion-check');

			await expect(checkbox.locator('.bi-square')).toBeVisible();
			await checkbox.click();
			await expect(checkbox.locator('.bi-check-square')).toBeVisible();
		});

		test('clicking again unmarks it (bi-square icon)', async ({page}) => {
			const checkbox = page.locator('#clan-weekly-checks .completion-check');

			await checkbox.click();
			await expect(checkbox.locator('.bi-check-square')).toBeVisible();

			await checkbox.click();
			await expect(checkbox.locator('.bi-square')).toBeVisible();
		});

		test('completed state persists in localStorage after reload', async ({page}) => {
			const checkbox = page.locator('#clan-weekly-checks .completion-check');

			await checkbox.click();
			await expect(checkbox.locator('.bi-check-square')).toBeVisible();

			const oid = await checkbox.getAttribute('data-oid');
			expect(oid).toBeTruthy();

			await reloadWithFrozenClock(page);
			await page.waitForSelector('#clan-weekly-body table', {timeout: 10_000});

			const completedOids = await page.evaluate(() => {
				const stored = localStorage.getItem('oids_completed');
				return stored ? JSON.parse(stored) : [];
			});
			expect(completedOids).toContain(oid);

			await expect(page.locator('#clan-weekly-checks .completion-check .bi-check-square')).toBeVisible();
		});
	});

	test.describe('Reward Rows', () => {
		test('renders four reward rows (one per tier)', async ({page}) => {
			const rows = page.locator('#clan-weekly-body tbody tr');
			await expect(rows).toHaveCount(4);
		});

		test('first column of each row shows a percentage', async ({page}) => {
			const firstCells = page.locator('#clan-weekly-body tbody tr td:first-child');
			await expect(firstCells).toHaveCount(4);
			for (const cell of await firstCells.all()) {
				const text = await cell.textContent();
				expect(text).toMatch(/^\d+%$/u);
			}
		});

		test('bonus region is shown at the bottom of the card body', async ({page}) => {
			const regionP = page.locator('#clan-weekly-body p');
			await expect(regionP).toBeVisible();
			await expect(regionP).toContainText('Bonus region:');
		});
	});
});
