import {test, expect, type Page} from '@playwright/test';
import {setupMockRoutes} from './helpers/api-mocks';
import {mockRivenCalcData} from './helpers/riven-calc-mocks';

/**
 * E2E tests for the Riven calculator (/riven-calc).
 *
 * Only the journeys a user takes are covered here. The maths is covered by src/riven-calc/formula.test.ts and
 * the wiring by src/riven-calc/index.test.ts, both of which run much faster and in far greater detail.
 */

const MELEE = 'PlayerMeleeWeaponRandomModRare';
const SHOTGUN = 'LotusShotgunRandomModRare';

async function openCalculator(page: Page, hash = ''): Promise<void> {
	await setupMockRoutes(page, {freezeTime: false});
	await mockRivenCalcData(page);
	await page.goto('/riven-calc' + hash);
	await expect(page.locator('[data-riven-section="buffs"] .riven-stat').first()).toBeVisible({timeout: 15_000});
}

function statRow(page: Page, section: 'buffs' | 'spliced' | 'curses', tag: string) {
	return page.locator(`[data-riven-section="${section}"] [data-stat-tag="${tag}"]`);
}

test.describe('Riven calculator (/riven-calc)', () => {
	test.beforeEach(async ({page}) => {
		await openCalculator(page);
	});

	test('starts the number box and its spinner at the middle of the range, without grading', async ({page}) => {
		const damage = statRow(page, 'buffs', 'WeaponDamageAmountMod');
		const box = damage.locator('.riven-grade-input');
		const reset = damage.getByRole('button', {name: /Reset/u});

		await expect(box).toHaveValue(/^185\.[67]\d?$/u);
		await expect(damage.locator('.riven-grade-result')).toHaveText('');
		await expect(reset).toBeDisabled();

		await box.focus();
		await page.keyboard.press('ArrowUp');

		// One small step up from the middle, rather than the lowest value or a whole number
		await expect(box).toHaveValue(/^185\.[789]\d?$/u);
		await expect(damage.locator('.riven-grade-result')).toContainText(/\dx = [A-Z]/u);
		await expect(reset).toBeEnabled();
	});

	test('is reachable from the navbar, which marks it as the current page', async ({page}) => {
		await expect(page.locator('.navbar .nav-link.active')).toHaveText('Riven Calculator');
		await expect(page.locator('.navbar a.nav-link', {hasText: 'Riven Calculator'})).toHaveAttribute('href', /\/riven-calc/u);
	});

	test('picking a weapon switches to its Riven type and its traits', async ({page}) => {
		await expect(statRow(page, 'spliced', 'SplicedWeakpointDamage')).toBeVisible();

		await page.locator('#weapon-name').fill('Skana');
		await page.locator('#weapon-name').blur();

		await expect(page.locator('#riven-class')).toHaveValue(MELEE);
		await expect(statRow(page, 'spliced', 'SplicedSlamDamage')).toBeVisible();
		await expect(statRow(page, 'spliced', 'SplicedWeakpointDamage')).toHaveCount(0);
	});

	test('grades the value on a Riven', async ({page}) => {
		const damage = statRow(page, 'buffs', 'WeaponDamageAmountMod');

		await damage.locator('.riven-grade-input').fill('204.2');
		await expect(damage.locator('.riven-grade-result')).toHaveText('1.10x = S');

		await damage.locator('.riven-grade-input').fill('167.1');
		await expect(damage.locator('.riven-grade-result')).toHaveText('0.90x = F');
	});

	test('grades with the slider, which stays in sync with the number box', async ({page}) => {
		const damage = statRow(page, 'buffs', 'WeaponDamageAmountMod');
		const slider = damage.locator('.riven-grade-slider');
		const box = damage.locator('.riven-grade-input');

		await slider.focus();
		await page.keyboard.press('End');
		await expect(box).toHaveValue('204.2');
		await expect(damage.locator('.riven-grade-result')).toHaveText('1.10x = S');

		await box.fill('185.1');
		await expect(slider).toHaveValue('185.1');
		await expect(damage.locator('.riven-grade-result')).toHaveText('1.00x = B');

		await slider.focus();
		await page.keyboard.press('Home');
		await expect(box).toHaveValue('167.1');
		await expect(damage.locator('.riven-grade-result')).toHaveText('0.90x = F');
	});

	test('the reset button puts the slider and the box in the middle and removes the grade', async ({page}) => {
		const damage = statRow(page, 'buffs', 'WeaponDamageAmountMod');
		const crit = statRow(page, 'buffs', 'WeaponCritChanceMod');

		await crit.locator('.riven-grade-input').fill('150');
		await damage.locator('.riven-grade-slider').focus();
		await page.keyboard.press('End');
		await expect(damage.locator('.riven-grade-result')).toHaveText('1.10x = S');

		await damage.getByRole('button', {name: /Reset/u}).click();

		await expect(damage.locator('.riven-grade-input')).toHaveValue(/^185\.[67]\d?$/u);
		await expect(damage.locator('.riven-grade-slider')).toHaveValue(/^185\.[67]\d?$/u);
		await expect(damage.locator('.riven-grade-result')).toBeEmpty();
		// Other traits are left alone
		await expect(crit.locator('.riven-grade-input')).toHaveValue('150');
	});

	// Each card's Reset all button is found by the card's title, which also checks that the card is titled so
	const CARDS = [
		{title: 'Base buffs', section: 'buffs', tag: 'WeaponDamageAmountMod'},
		{title: 'Curses', section: 'curses', tag: 'WeaponCritChanceMod'},
		{title: 'Spliced traits', section: 'spliced', tag: 'SplicedWeakpointDamage'},
	] as const;

	async function gradeAtBest(page: Page, section: 'buffs' | 'spliced' | 'curses', tag: string): Promise<void> {
		await statRow(page, section, tag).locator('.riven-grade-slider').focus();
		await page.keyboard.press('End');
	}

	for (const [index, {title, section, tag}] of CARDS.entries()) {
		test(`the Reset all button under "${title}" resets that card's traits only`, async ({page}) => {
			const other = CARDS[(index + 1) % CARDS.length];
			const resetAll = page.locator('.card').filter({has: page.getByRole('heading', {name: title})})
				.getByRole('button', {name: 'Reset all'});
			await expect(resetAll).toBeDisabled();

			await gradeAtBest(page, section, tag);
			await gradeAtBest(page, other.section, other.tag);
			await expect(statRow(page, section, tag).locator('.riven-grade-result')).not.toBeEmpty();
			await expect(resetAll).toBeEnabled();

			await resetAll.click();

			await expect(statRow(page, section, tag).locator('.riven-grade-result')).toBeEmpty();
			await expect(resetAll).toBeDisabled();
			await expect(statRow(page, other.section, other.tag).locator('.riven-grade-result')).not.toBeEmpty();
		});
	}

	test('the - and + buttons change the number of buffs and curses, recalculating the ranges', async ({page}) => {
		await page.getByRole('button', {name: 'Decrease Buffs'}).click();
		await page.getByRole('button', {name: 'Decrease Curses'}).click();

		await expect(page.locator('#positive-traits')).toHaveValue('2');
		await expect(page.locator('#negative-traits')).toHaveValue('0');
		await expect(statRow(page, 'buffs', 'WeaponDamageAmountMod').locator('.riven-grade-bounds span')).toHaveText(['176.4', '215.6']);
		await expect(page.locator('[data-riven-card="curses"]')).toBeHidden();
	});

	test('keeps the settings in the URL, and restores them on reload', async ({page}) => {
		await page.locator('#weapon-name').fill('Skana');
		await page.locator('#weapon-name').blur();
		await page.locator('#rank').fill('5');
		await page.locator('#rank').blur();
		await page.locator('#negative-traits').fill('0');
		await page.locator('#negative-traits').blur();

		await expect(page).toHaveURL(/#weapon=Skana&lvl=5&buffs=3&curses=0$/u);

		await page.reload();

		await expect(page.locator('#weapon-name')).toHaveValue('Skana');
		await expect(page.locator('#rank')).toHaveValue('5');
		await expect(page.locator('#negative-traits')).toHaveValue('0');
		await expect(page.locator('#riven-class')).toHaveValue(MELEE);
	});
});

// These look at the page as it opens, so they open it themselves
test.describe('Riven calculator (/riven-calc) as it opens', () => {
	test('shows the ranges for a rank 8 rifle Riven with 3 positive and 1 negative trait', async ({page}) => {
		const errors: string[] = [];
		page.on('pageerror', error => {
			errors.push(error.message);
		});

		await openCalculator(page);

		await expect(page.locator('h2')).toHaveText('Riven Calculator');
		await expect(page.locator('#riven-class')).toHaveValue('LotusRifleRandomModRare');
		const damage = statRow(page, 'buffs', 'WeaponDamageAmountMod');
		await expect(damage.locator('.riven-stat-label')).toHaveText('Damage');
		await expect(damage.locator('.riven-grade-bounds span')).toHaveText(['167.1', '204.2']);
		await expect(statRow(page, 'curses', 'WeaponCritChanceMod').locator('.riven-grade-bounds span')).toHaveText(['-148.5', '-121.5']);
		await expect(statRow(page, 'spliced', 'SplicedWeakpointDamage').locator('.riven-stat-label')).toHaveText('Weak Point Damage');
		expect(errors).toEqual([]);
	});

	test('opens links made by the original calculator, ignoring the disposition they carried', async ({page}) => {
		await openCalculator(page, `#weapon=${SHOTGUN}%3A0.65&lvl=8&buffs=3&curses=1`);

		await expect(page.locator('#riven-class')).toHaveValue(SHOTGUN);
		await expect(statRow(page, 'buffs', 'WeaponZoomFovMod')).toBeVisible();
	});
});

test.describe('Original Riven calculator (/rivencalc)', () => {
	test('redirects to the new calculator, keeping the settings in the link', async ({page}) => {
		await setupMockRoutes(page, {freezeTime: false});
		await mockRivenCalcData(page);
		// The old page starts loading its external parser before the redirect takes over
		await page.route('**/warframe-riven-info/RivenParser.js', route => {
			void route.fulfill({status: 200, contentType: 'application/javascript', body: ''});
		});

		await page.goto('/rivencalc#weapon=Skana&lvl=3&buffs=2&curses=0');

		await expect(page).toHaveURL(/\/riven-calc#weapon=Skana&lvl=3&buffs=2&curses=0$/u);
		await expect(page.locator('h2')).toHaveText('Riven Calculator');
		await expect(page.locator('#rank')).toHaveValue('3');
	});
});
