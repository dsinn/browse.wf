import {test, expect, type Page} from '@playwright/test';
import {setupMockRoutes} from './helpers/api-mocks';
import {scrollToElement, scrollToPageBottom} from './helpers/dom-helpers';

async function setupPage(page: Page) {
	await setupMockRoutes(page);
	await page.goto('/weekly-forecast');

	// Wait for content to be populated by weekly-forecast.ts
	await page.waitForSelector('#deep-archimedea-tabs .nav-link', {timeout: 15_000});
	await page.waitForSelector('#descendia-tabs .nav-link', {timeout: 15_000});
	await page.waitForSelector('#calendar-season-tabs .nav-link', {state: 'attached', timeout: 15_000});
	await page.waitForSelector('#clan-weekly-columns .col-6', {state: 'attached', timeout: 15_000});
	await page.waitForSelector('#circuit-forecast-body tr', {timeout: 15_000});
	await page.waitForSelector('#teshin-forecast-body tr', {timeout: 15_000});
}

test.describe('Weekly Forecast Page', () => {
	test.beforeEach(async ({page}) => {
		await setupPage(page);
	});

	test.describe('Page Structure', () => {
		test('shows page heading and all cards', async ({page}) => {
			await expect(page.locator('h2')).toHaveText('Weekly Forecast');
			await expect(page.locator('.card').filter({hasText: 'Deep Archimedea'})).toBeVisible();
			await expect(page.locator('.card').filter({hasText: 'Temporal Archimedea'})).toBeVisible();
			await expect(page.locator('.card').filter({hasText: 'Descendia'})).toBeVisible();
			await expect(page.locator('.card').filter({hasText: 'Descendia'}).locator('p')).toContainText('not yet been translated');
		});

		test('shows weekly missions notice with countdown badge', async ({page}) => {
			const notice = page.locator('.alert-info');
			await expect(notice).toBeVisible();
			await expect(notice).toContainText('The forecast for the weeklies below will update in');
			const badge = notice.locator('#weekly-missions-timer .badge');
			await expect(badge).toBeVisible();
			await expect(badge).not.toBeEmpty();
		});

		test('Deep Archimedea active pane renders 3 rows', async ({page}) => {
			const activePane = page.locator('#deep-archimedea-content .tab-pane.active');
			await expect(activePane).toBeVisible();
			await expect(activePane.locator('table:first-of-type tbody tr')).toHaveCount(3);
		});

		test('Temporal Archimedea active pane renders 3 rows', async ({page}) => {
			const activePane = page.locator('#temporal-archimedea-content .tab-pane.active');
			await expect(activePane).toBeVisible();
			await expect(activePane.locator('table:first-of-type tbody tr')).toHaveCount(3);
		});

		test('Descendia active pane renders 21 rows × 5 columns', async ({page}) => {
			const activePane = page.locator('#descendia-content .tab-pane.active');
			await expect(activePane).toBeVisible();
			const rows = activePane.locator('tbody tr');
			await expect(rows).toHaveCount(21);
			for (let i = 0; i < 21; i++) {
				await expect(rows.nth(i).locator('td')).toHaveCount(5);
			}
		});
	});

	test.describe('Tab interactions', () => {
		test('clicking a non-active Descendia tab switches content', async ({page}) => {
			const firstTab = page.locator('#descendia-tabs .nav-link').first();
			await firstTab.click();
			await expect(firstTab).toHaveClass(/active/u);
			const firstPane = page.locator('#descendia-content .tab-pane').first();
			await expect(firstPane).toBeVisible();
			await expect(firstPane.locator('tbody tr')).toHaveCount(21);
		});
	});

	test.describe('Calendar Seasons — two-column layout (xl+)', () => {
		test.use({viewport: {width: 1280, height: 720}});

		test('renders one column per season', async ({page}) => {
			await expect(page.locator('#calendar-season-columns .col-6')).toHaveCount(1);
		});

		test('column contains formatted calendar dates', async ({page}) => {
			const dateText = await page.locator('#calendar-season-columns .calendar-season-date').first().textContent();
			expect(dateText).toMatch(/\b[A-Z][a-z]{2} \d{1,2}$/u);
		});
	});

	test.describe('Clan Weekly Initiatives', () => {
		test('shows the Clan Weekly Initiatives card', async ({page}) => {
			await expect(page.locator('.card').filter({hasText: 'Clan Weekly Initiatives'})).toBeVisible();
		});

		test('renders one column per entry, each with a date heading', async ({page}) => {
			const cols = page.locator('#clan-weekly-columns .col-6');
			await expect(cols).toHaveCount(2);
			for (const col of await cols.all()) {
				const heading = await col.locator('h5').textContent();
				expect(heading).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/u);
			}
		});

		test('column renders four reward rows', async ({page}) => {
			const col = page.locator('#clan-weekly-columns .col-6').first();
			await expect(col).toBeVisible();
			await expect(col.locator('tbody tr')).toHaveCount(4);
		});
	});

	test.describe('The Circuit', () => {
		test('renders 11 weeks with date, normal, and steel path columns', async ({page}) => {
			const rows = page.locator('#circuit-forecast-body tr');
			await expect(rows).toHaveCount(11);
			const cells = rows.first().locator('td');
			await expect(cells).toHaveCount(3);
			for (const cell of await cells.all()) {
				await expect(cell).not.toBeEmpty();
			}
		});
	});

	test.describe('Steel Path Honors', () => {
		test('renders one row per offer with an offer name and appearance dates', async ({page}) => {
			const rows = page.locator('#teshin-forecast-body tr');
			await expect(rows).toHaveCount(8);
			const cells = rows.first().locator('td');
			await expect(cells).toHaveCount(7);
			for (const cell of await cells.all()) {
				await expect(cell).not.toBeEmpty();
			}
		});
	});

	test.describe('Table of contents (lg+)', () => {
		test.use({viewport: {width: 1280, height: 720}});

		test('has a link to each card, in page order, pointing at the card\'s anchor', async ({page}) => {
			const cards = await page.locator('.card').all();
			const links = page.locator('#weekly-forecast-toc .nav-link');
			expect(cards.length).toBeGreaterThan(0);
			await expect(links).toHaveCount(cards.length);
			for (const [i, card] of cards.entries()) {
				await expect(links.nth(i)).toHaveText(await card.locator('.card-header h5').textContent() ?? '');
				await expect(links.nth(i)).toHaveAttribute('href', '#' + await card.getAttribute('id'));
			}
		});

		test('clicking an entry scrolls to its section and highlights it', async ({page}) => {
			const link = page.locator('#weekly-forecast-toc .nav-link[href="#circuit"]');
			await link.click();
			await expect(page).toHaveURL(/#circuit$/u);
			await expect(link).toHaveClass(/active/u);
			await expect(page.locator('#weekly-forecast-toc .nav-link.active')).toHaveCount(1);
			await expect(page.locator('#circuit')).toBeInViewport();
		});

		test('loading the page with a #section fragment ends up at that section once content has loaded', async ({page}) => {
			// Delay API responses so the cards fill in well after the browser's own jump to the fragment
			await page.route('**/*', async route => {
				if (['fetch', 'xhr'].includes(route.request().resourceType())) {
					await new Promise(resolve => {
						setTimeout(resolve, 1000);
					});
				}

				await route.fallback();
			});
			await page.goto('/weekly-forecast#circuit');
			await page.waitForSelector('#circuit-forecast-body tr', {timeout: 15_000});
			await page.waitForSelector('#teshin-forecast-body tr', {timeout: 15_000});
			// Scrolled to the section itself, not merely somewhere it is partly visible
			await expect.poll(async () => (await page.locator('#circuit').boundingBox())!.y).toBeLessThan(150);
			await expect(page.locator('#weekly-forecast-toc .nav-link.active')).toHaveAttribute('href', '#circuit');
			// Not overwritten by the sections the page passed through while the cards were loading
			await expect(page).toHaveURL(/#circuit$/u);
		});

		test('keeps the URL fragment on the current section while scrolling, without adding history entries', async ({page}) => {
			const historyLength = await page.evaluate(() => window.history.length);
			// Retry the scroll: content above can still grow (e.g. as images load), which pushes the section back down
			await expect(async () => {
				await scrollToElement(page, '#clan-weekly');
				await expect(page).toHaveURL(/#clan-weekly$/u, {timeout: 1000});
			}).toPass();

			await page.evaluate(() => {
				window.scrollTo(0, 0);
			});
			await expect(page).not.toHaveURL(/#/u);
			expect(await page.evaluate(() => window.history.length)).toBe(historyLength);
		});

		test('reloading comes back to the section being read', async ({page}) => {
			await expect(async () => {
				await scrollToElement(page, '#circuit');
				await expect(page).toHaveURL(/#circuit$/u, {timeout: 1000});
			}).toPass();

			await page.reload();
			await page.waitForSelector('#circuit-forecast-body tr', {timeout: 15_000});
			await page.waitForSelector('#teshin-forecast-body tr', {timeout: 15_000});
			await expect.poll(async () => (await page.locator('#circuit').boundingBox())!.y).toBeLessThan(150);
		});

		test('stays visible while scrolling and follows the current section', async ({page}) => {
			const toc = page.locator('#weekly-forecast-toc');
			await expect(toc).toBeInViewport();
			// Retry the scroll: content above can still grow (e.g. as images load), which pushes the section back down
			await expect(async () => {
				await scrollToElement(page, '#clan-weekly');
				await expect(toc).toBeInViewport();
				const activeLink = page.locator('#weekly-forecast-toc .nav-link.active');
				await expect(activeLink).toHaveAttribute('href', '#clan-weekly', {timeout: 1000});
			}).toPass();
		});

		test('highlights the last section when scrolled to the bottom of the page', async ({page}) => {
			// Retry the scroll: the page can still grow (e.g. as images load), which moves the bottom
			await expect(async () => {
				await scrollToPageBottom(page);
				const activeLink = page.locator('#weekly-forecast-toc .nav-link.active');
				await expect(activeLink).toHaveAttribute('href', '#steel-path-honors', {timeout: 1000});
			}).toPass();
		});
	});

	test.describe('Table of contents (lg+, tall viewport)', () => {
		// Tall enough that The Circuit can't be scrolled to the top: the page bottoms out first
		test.use({viewport: {width: 1280, height: 2400}});

		test('keeps a link to a section the page can\'t scroll to the top', async ({page}) => {
			await page.locator('#weekly-forecast-toc .nav-link[href="#circuit"]').click();
			// At the bottom, the last section is highlighted; this also means the scroll has been handled
			await expect(page.locator('#weekly-forecast-toc .nav-link.active')).toHaveAttribute('href', '#steel-path-honors');
			expect(await page.locator('#circuit').evaluate(element => element.getBoundingClientRect().top)).toBeGreaterThan(1);

			// The URL is only updated once scrolling has settled, so let that delay pass before checking it
			await page.clock.runFor(1000);
			await expect(page).toHaveURL(/#circuit$/u);
		});
	});

	test.describe('Table of contents strip (below lg)', () => {
		test.use({viewport: {width: 390, height: 844}});

		test('stays pinned under the navbar while scrolling', async ({page}) => {
			const strip = page.locator('#weekly-forecast-toc');
			await scrollToPageBottom(page);
			await expect(strip).toBeInViewport();
			const navbarBox = (await page.locator('#main-navbar').boundingBox())!;
			const navbarBottom = navbarBox.y + navbarBox.height;
			// 2px of slack: the navbar's height varies with the fonts, while the strip's offset is a fixed 56px
			await expect.poll(async () => Math.abs((await strip.boundingBox())!.y - navbarBottom)).toBeLessThanOrEqual(2);
		});
	});

	test.describe('Calendar Seasons — tabs (below xl)', () => {
		test.use({viewport: {width: 1199, height: 720}});

		test('renders one tab per season', async ({page}) => {
			await expect(page.locator('#calendar-season-tabs .nav-link')).toHaveCount(1);
		});

		test('active tab pane contains formatted calendar dates', async ({page}) => {
			const activePane = page.locator('#calendar-season-content .tab-pane.active');
			await expect(activePane).toBeVisible();
			const dateText = await activePane.locator('.calendar-season-date').first().textContent();
			expect(dateText).toMatch(/\b[A-Z][a-z]{2} \d{1,2}$/u);
		});
	});
});

test.describe('Weekly Forecast Page without worldState', () => {
	test('still renders the forecasts that don\'t need the worldState', async ({page}) => {
		await setupMockRoutes(page);
		// Registered last, so it takes precedence over the worldState mock
		await page.route('**/worldState', async route => route.abort());
		await page.goto('/weekly-forecast');

		await expect(page.locator('#circuit-forecast-body tr')).toHaveCount(11);
		await expect(page.locator('#teshin-forecast-body tr')).toHaveCount(8);
	});
});
