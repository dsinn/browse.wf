import {test, expect} from '@playwright/test';
import {MOCK_TIMESTAMP} from '../test/helpers/test-constants';
import {setupMockRoutes} from './helpers/api-mocks';

// Keep in sync with DAY_COUNT in src/bounty-cycle-schedule-page.ts and MAX_WINDOWS_PER_DAY in
// src/bounty-cycle-schedule.ts (also mirrored in bounty-cycle-schedule.php's $dayCount and
// $maxWindowsPerDay). These are fixed properties of the game's Cetus/Deimos cycle, not values
// expected to change casually, so a plain hardcoded copy here is fine - but if PERIOD_MS is
// ever retuned such that MAX_WINDOWS_PER_DAY changes, update this constant too so this test
// keeps failing loudly on any drift between the PHP grid and the real TS constant.
const DAY_COUNT = 7;
const MAX_WINDOWS_PER_DAY = 10;

test.describe('Cetus/Deimos Cycle Schedule (/bounty-cycle-schedule)', () => {
	test.beforeEach(async ({page}) => {
		await setupMockRoutes(page);
		await page.goto('/bounty-cycle-schedule');
		// The static grid's <td>s exist (and satisfy a count assertion) before render() has
		// filled them in, so wait for actual content too - otherwise a test can capture an
		// empty "before" snapshot in that narrow window and see a false content change later.
		// Every day has at least 9 windows (MAX_WINDOWS_PER_DAY - 1), so row index 8 (the 9th
		// row, second-last of 10) is always populated once rendering has genuinely completed.
		await expect(page.locator('#schedule-table-body tr').nth(8).locator('td').last()).not.toBeEmpty();
	});

	test('renders a 7-day, 10-row grid with content, first column heading is today', async ({page}) => {
		await expect(page.locator('#schedule-table-body tr')).toHaveCount(MAX_WINDOWS_PER_DAY);
		await expect(page.locator('#schedule-table-body td')).toHaveCount(MAX_WINDOWS_PER_DAY * DAY_COUNT);
		await expect(page.locator('#schedule-table-body td:not(.is-empty-slot)').first()).toBeVisible();

		// Today is always the first column (see the comment above startDayBucket in render(),
		// src/bounty-cycle-schedule-page.ts). Verified functionally here by checking the
		// heading's date text, not the column's styling - visual treatment is a UAT concern.
		const expectedHeading = new Intl.DateTimeFormat(undefined, {
			weekday: 'short', month: 'short', day: 'numeric',
		}).format(new Date(MOCK_TIMESTAMP));
		await expect(page.locator('#schedule-table-headings th').first()).toHaveText(expectedHeading);
	});

	test('unchecking the toggle swaps theme and table contents to Day/Fass', async ({page}) => {
		const beforeText = await page.locator('#schedule-table-body').textContent();

		await page.locator('#phase-toggle').click();

		await expect(page.locator('#phase-toggle')).not.toBeChecked();
		await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'light', {timeout: 2000});
		await expect(page.locator('#phase-label-day')).toHaveClass(/is-active-phase/u);
		await expect(page.locator('h2')).toHaveText('Cetus/Deimos Cycle Schedule');

		// The table data swap is deliberately delayed to the theme transition's midpoint
		// (lowest-contrast point), so wait for it rather than asserting immediately.
		await expect(page.locator('#schedule-table-body td')).toHaveCount(MAX_WINDOWS_PER_DAY * DAY_COUNT);
		await expect(async () => {
			expect(await page.locator('#schedule-table-body').textContent()).not.toBe(beforeText);
		}).toPass({timeout: 2000});
	});

	test('toggling back to Night/Vome restores the dark theme', async ({page}) => {
		await page.locator('#phase-toggle').click();
		await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'light');

		await page.locator('#phase-toggle').click();
		await expect(page.locator('#phase-toggle')).toBeChecked();
		await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'dark');
		await expect(page.locator('#phase-label-night')).toHaveClass(/is-active-phase/u);
	});

	test('setting zulu timezone re-renders the table', async ({page}) => {
		// Military format appends "Z" only in zulu mode (see formatTime in
		// src/bounty-cycle-schedule.ts), giving each timezone a directly checkable, positive
		// signal rather than needing a before/after diff.
		await page.locator('#select-hourfmt').selectOption('mil');
		await page.locator('#select-tz').selectOption('zulu');
		const firstWindow = await page.locator('#schedule-table-body td:not(.is-empty-slot)').first().textContent();
		expect(firstWindow).toMatch(/^\d{4}Z–\d{4}Z$/u);
	});

	test('setting local timezone re-renders the table', async ({page}) => {
		await page.locator('#select-hourfmt').selectOption('mil');
		await page.locator('#select-tz').selectOption('local');
		const firstWindow = await page.locator('#schedule-table-body td:not(.is-empty-slot)').first().textContent();
		expect(firstWindow).toMatch(/^\d{4}–\d{4}$/u);
	});

	test('setting 24-hour format re-renders as HH:MM–HH:MM', async ({page}) => {
		await page.locator('#select-hourfmt').selectOption('24');
		const firstWindow = await page.locator('#schedule-table-body td:not(.is-empty-slot)').first().textContent();
		expect(firstWindow).toMatch(/^\d{2}:\d{2}–\d{2}:\d{2}$/u);
	});

	test('setting 12-hour format re-renders with zero-padded hours and period-free am/pm', async ({page}) => {
		await page.locator('#select-hourfmt').selectOption('12');
		const firstWindow = await page.locator('#schedule-table-body td:not(.is-empty-slot)').first().textContent();
		expect(firstWindow).toMatch(/^\d{2}:\d{2}(am|pm)–\d{2}:\d{2}(am|pm)$/u);
	});

	test('setting military time re-renders without a colon', async ({page}) => {
		await page.locator('#select-hourfmt').selectOption('mil');
		const firstWindow = await page.locator('#schedule-table-body td:not(.is-empty-slot)').first().textContent();
		expect(firstWindow).toMatch(/^\d{4}–\d{4}$/u);
	});
});

test.describe('Cetus/Deimos Cycle Schedule — theme sync on load', () => {
	// Browsers can restore a checkbox's checked state on reload independently of the HTML's
	// `checked` attribute (e.g. form state restoration). The page's initial theme must be
	// derived from the checkbox's actual state, not a separate hardcoded default, or the two
	// can end up out of sync (theme stuck dark while the toggle shows Day/Fass, or vice versa).
	test('reloading after switching to Day/Fass keeps the theme consistent with the toggle', async ({page}) => {
		await setupMockRoutes(page);
		await page.goto('/bounty-cycle-schedule');
		await expect(page.locator('#schedule-table-body td')).toHaveCount(MAX_WINDOWS_PER_DAY * DAY_COUNT);

		await page.locator('#phase-toggle').click();
		await expect(page.locator('#phase-toggle')).not.toBeChecked();
		await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'light');

		await page.reload();
		await expect(page.locator('#schedule-table-body td')).toHaveCount(MAX_WINDOWS_PER_DAY * DAY_COUNT);

		// Whatever the toggle's post-reload state ends up being, the theme must match it —
		// they must never disagree (e.g. toggle showing Day/Fass while the theme stays dark).
		const isChecked = await page.locator('#phase-toggle').isChecked();
		const expectedTheme = isChecked ? 'dark' : 'light';
		await expect(page.locator('html')).toHaveAttribute('data-bs-theme', expectedTheme);
		await expect(page.locator('body')).toHaveAttribute('data-bs-theme', expectedTheme);
	});
});
