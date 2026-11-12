import {test, expect, type Page} from '@playwright/test';
import {setupMockRoutes} from './helpers/api-mocks';

type Interaction = {
	field: string;
	value: string;
	platform?: string;
	result: string;
	expected: string;
	message?: string;
};

/**
 Fills a form (and optionally picks a platform), submits it, and checks the result.

 The dev server can reload the page shortly after it loads (it watches the pre-rendered pages), which would discard
 anything entered too early, so the whole interaction is retried until it holds.
 */
async function submitAndExpect(page: Page, interaction: Interaction) {
	await expect(async () => {
		if (interaction.platform !== undefined) {
			await page.selectOption('#platform', interaction.platform);
		}

		await page.fill(interaction.field, interaction.value);
		await page.click(`form:has(${interaction.field}) input[type=submit]`);
		await expect(page.locator(interaction.result), interaction.message).toHaveText(interaction.expected, {timeout: 1000});
	}).toPass();
}

// Expected discriminators come from running upstream's platform-suffix.pluto in the real PlutoScript runtime
test.describe('Platform suffix (/platform-suffix)', () => {
	test.beforeEach(async ({page}) => {
		await setupMockRoutes(page);
		await page.goto('/platform-suffix');
	});

	test('suffixes a name for each platform', async ({page}) => {
		const expectedSuffixes = [['PC', 230], ['PlayStation', 116], ['Xbox', 724], ['Switch', 514], ['iOS', 537], ['Android', 638]] as const;
		for (const [index, [platform, discriminator]] of expectedSuffixes.entries()) {
			await submitAndExpect(page, {
				field: '#partial-name',
				value: 'AerodynamicHead',
				platform: String(index),
				result: '#partial2full-res',
				expected: `AerodynamicHead#${discriminator}`,
				message: platform,
			});
		}
	});

	test('pads discriminators to three digits and handles non-ASCII names', async ({page}) => {
		await submitAndExpect(page, {
			field: '#partial-name',
			value: '日本語',
			platform: '1',
			result: '#partial2full-res',
			expected: '日本語#076',
		});
	});

	test('identifies the platform from a suffixed name', async ({page}) => {
		const cases = [['AerodynamicHead#230', 'PC'], ['AerodynamicHead#638', 'Android'], ['TENNO#335', 'Xbox']] as const;
		for (const [fullName, platform] of cases) {
			await submitAndExpect(page, {
				field: '#full-name',
				value: fullName,
				result: '#full2platform-res',
				expected: platform,
				message: fullName,
			});
		}
	});

	test('reports "Invalid" when no platform matches', async ({page}) => {
		await submitAndExpect(page, {
			field: '#full-name',
			value: 'AerodynamicHead#999',
			result: '#full2platform-res',
			expected: 'Invalid',
		});
	});
});
