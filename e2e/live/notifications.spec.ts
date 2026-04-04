import {test, expect} from '@playwright/test';
import {setupMockRoutes} from '../helpers/api-mocks';

test.describe('Notification Toggles (/live)', () => {
	test.beforeEach(async ({page}) => {
		await setupMockRoutes(page);
		await page.goto('/live');
		await page.waitForSelector('#arby-what:not(:has-text("Loading..."))', {timeout: 10_000});
	});

	test('clicking notification toggle changes icon state', async ({page}) => {
		const newsNotifToggle = page.locator('[data-notif-toggle="news"]');
		await page.waitForSelector('[data-notif-toggle="news"] span', {timeout: 5000});

		const span = newsNotifToggle.locator('span');
		const initialClass = await span.getAttribute('class');

		await newsNotifToggle.click();
		await expect(span).not.toHaveAttribute('class', initialClass ?? '');

		const newClass = await span.getAttribute('class');
		expect(newClass === 'notif-bell-enabled' || newClass === 'notif-bell-disabled').toBe(true);
	});

	test('notification preferences persist in localStorage', async ({page}) => {
		const darvoNotifToggle = page.locator('[data-notif-toggle="darvo"]');
		await page.waitForSelector('[data-notif-toggle="darvo"] span', {timeout: 5000});

		await darvoNotifToggle.click();
		await page.waitForFunction(() => localStorage.getItem('live.notif.darvo') !== null);
		const notifState = await page.evaluate(() => localStorage.getItem('live.notif.darvo'));
		expect(notifState).toBeTruthy();

		await page.reload();
		await page.waitForSelector('#arby-what:not(:has-text("Loading..."))', {timeout: 10_000});
		await page.waitForSelector('[data-notif-toggle="darvo"] span', {timeout: 5000});

		const stateAfterReload = await page.evaluate(() => localStorage.getItem('live.notif.darvo'));
		expect(stateAfterReload).toBe(notifState);
	});
});
