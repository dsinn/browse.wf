import {
	describe, test, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {mockBootstrapTooltip} from '../../helpers/dom-helpers';
import {renderAllyIcon, applyBountyTierFilter} from '../../../src/live/bounties';

describe('bounties', () => {
	beforeEach(() => {
		mockBootstrapTooltip();
		(globalThis as any).setImageSource = vi.fn((img: HTMLImageElement, src: string) => {
			img.src = src;
		});
		(globalThis as any).addTooltip = vi.fn((elm: HTMLElement, title: string) => {
			elm.dataset.bsTitle = title;
		});
		(globalThis as any).getMinimumTier = vi.fn(() => 1);
	});

	afterEach(() => {
		delete (globalThis as any).setImageSource;
		delete (globalThis as any).addTooltip;
		delete (globalThis as any).getMinimumTier;
	});

	describe('renderAllyIcon', () => {
		test('inserts ally image with correct src into allyCell', () => {
			const cell = document.createElement('td');
			renderAllyIcon('Teshin', cell);
			const img = cell.querySelector('img');
			expect(img).toBeTruthy();
			expect(img!.src).toContain('TeshinPixelGlyph.png');
			expect(img!.className).toBe('ally-icon');
		});

		test('adds tooltip with ally name', () => {
			const cell = document.createElement('td');
			renderAllyIcon('Teshin', cell);
			const img = cell.querySelector('img');
			expect(img!.dataset.bsTitle).toBe('Teshin');
		});

		test('clears prior cell content before inserting', () => {
			const cell = document.createElement('td');
			cell.innerHTML = '<span>old content</span>';
			renderAllyIcon('Teshin', cell);
			expect(cell.querySelector('span')).toBeNull();
		});
	});

	describe('applyBountyTierFilter', () => {
		function makeRows(count: number): NodeListOf<Element> {
			const table = document.createElement('table');
			for (let i = 0; i < count; i++) {
				table.append(document.createElement('tr'));
			}

			document.body.append(table);
			return table.querySelectorAll('tr');
		}

		test('hides rows below minTier', () => {
			(globalThis as any).getMinimumTier = vi.fn(() => 3);
			const rows = makeRows(5);
			applyBountyTierFilter('EntratiLabSyndicate', rows);
			expect(rows[0].classList.contains('d-none')).toBe(true); // Tier 1
			expect(rows[1].classList.contains('d-none')).toBe(true); // Tier 2
			expect(rows[2].classList.contains('d-none')).toBe(false); // Tier 3
			expect(rows[3].classList.contains('d-none')).toBe(false); // Tier 4
			expect(rows[4].classList.contains('d-none')).toBe(false); // Tier 5
		});

		test('hides heading and all rows when minTier < 1 (Hide)', () => {
			(globalThis as any).getMinimumTier = vi.fn(() => -1);
			const heading = document.querySelector<HTMLElement>('#ZarimanSyndicate-name')!;
			heading.classList.remove('d-none');
			const rows = document.querySelector('#ZarimanSyndicate-table')!.querySelectorAll('tr');
			applyBountyTierFilter('ZarimanSyndicate', rows);
			expect(heading.classList.contains('d-none')).toBe(true);
			for (const row of rows) {
				expect(row.classList.contains('d-none')).toBe(true);
			}
		});

		test('shows all rows and heading when minTier is 1', () => {
			(globalThis as any).getMinimumTier = vi.fn(() => 1);
			const heading = document.querySelector<HTMLElement>('#ZarimanSyndicate-name')!;
			heading.classList.add('d-none');
			const rows = document.querySelector('#ZarimanSyndicate-table')!.querySelectorAll('tr');
			applyBountyTierFilter('ZarimanSyndicate', rows);
			expect(heading.classList.contains('d-none')).toBe(false);
			for (const row of rows) {
				expect(row.classList.contains('d-none')).toBe(false);
			}
		});
	});
});
