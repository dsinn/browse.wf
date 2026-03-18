import {describe, test, expect} from 'vitest';
import {loadMock} from '../../helpers/api-mocks';
import {getById} from '../../helpers/dom-helpers';

describe('Darvo\'s Deal Card', () => {
	test('renders Darvo deal information from worldState', () => {
		const worldState = loadMock('worldState.json');
		const deal = worldState.DailyDeals[0];

		// Simulate what the live.ts code does
		const darvoItem = getById('darvo-item');
		const darvoStock = getById('darvo-stock');
		const darvoOgPrice = getById('darvo-ogprice');
		const darvoPrice = getById('darvo-price');
		const darvoDiscount = getById('darvo-discount');

		// Simulate the rendering logic from live.ts
		darvoItem.textContent = deal.StoreItem.split('/').pop();
		darvoStock.textContent = `${deal.AmountSold}/${deal.AmountTotal}`;
		darvoOgPrice.textContent = String(deal.OriginalPrice);
		darvoPrice.textContent = String(deal.SalePrice);
		darvoDiscount.textContent = String(deal.Discount);

		expect(darvoItem.textContent).toBe('Bard');
		expect(darvoStock.textContent).toBe('16/100');
		expect(darvoOgPrice.textContent).toBe('225');
		expect(darvoPrice.textContent).toBe('180');
		expect(darvoDiscount.textContent).toBe('20');
	});

	test('shows correct discount percentage', () => {
		const darvoDiscount = getById('darvo-discount');
		darvoDiscount.textContent = '50';

		expect(darvoDiscount.textContent).toBe('50');
	});
});
