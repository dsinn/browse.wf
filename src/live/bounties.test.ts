import {
	describe,
	test,
	expect,
	beforeEach,
	afterEach,
	vi,
} from 'vitest';
import {mockBootstrapTooltip} from '@test/helpers/dom-helpers';
import {renderAllyIcon, applyBountyFilters} from './bounties';

const {mockGetMinimumTier, mockIsBountyMissionTypeEnabled} = vi.hoisted(() => ({
	mockGetMinimumTier: vi.fn<(syndicateTag: string) => number>(),
	mockIsBountyMissionTypeEnabled: vi.fn<(syndicateTag: string, missionType: string) => boolean>(),
}));

vi.mock('./bounty-filters.js', () => ({
	getMinimumTier: mockGetMinimumTier,
	isBountyMissionTypeEnabled: mockIsBountyMissionTypeEnabled,
}));

describe('bounties', () => {
	beforeEach(() => {
		mockBootstrapTooltip();
		(globalThis as any).setImageSource = vi.fn((img: HTMLImageElement, src: string) => {
			img.src = src;
		});
		(globalThis as any).addTooltip = vi.fn((elm: HTMLElement, title: string) => {
			elm.dataset.bsTitle = title;
		});
		mockGetMinimumTier.mockReset().mockReturnValue(1);
		mockIsBountyMissionTypeEnabled.mockReset().mockReturnValue(true);
	});

	afterEach(() => {
		delete (globalThis as any).setImageSource;
		delete (globalThis as any).addTooltip;
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

	describe('applyBountyFilters', () => {
		function makeRows(missionTypes: string[]): NodeListOf<Element> {
			const table = document.createElement('table');
			for (const mt of missionTypes) {
				const tr = document.createElement('tr');
				tr.dataset.missionType = mt;
				table.append(tr);
			}

			document.body.append(table);
			return table.querySelectorAll('tr');
		}

		test('hides rows below minTier', () => {
			mockGetMinimumTier.mockReturnValue(3);
			const rows = makeRows(['MT_CORRUPTION', 'MT_EXTERMINATION', 'MT_VOID_CASCADE', 'MT_ARMAGEDDON', 'MT_MOBILE_DEFENSE']);
			applyBountyFilters('EntratiLabSyndicate', rows);
			expect(rows[0].classList.contains('d-none')).toBe(true); // Tier 1
			expect(rows[1].classList.contains('d-none')).toBe(true); // Tier 2
			expect(rows[2].classList.contains('d-none')).toBe(false); // Tier 3
			expect(rows[3].classList.contains('d-none')).toBe(false); // Tier 4
			expect(rows[4].classList.contains('d-none')).toBe(false); // Tier 5
		});

		test('hides heading and all rows when minTier < 1 (Hide)', () => {
			mockGetMinimumTier.mockReturnValue(-1);
			const heading = document.querySelector<HTMLElement>('#ZarimanSyndicate-name')!;
			heading.classList.remove('d-none');
			const rows = document.querySelector('#ZarimanSyndicate-table')!.querySelectorAll('tr');
			applyBountyFilters('ZarimanSyndicate', rows);
			expect(heading.classList.contains('d-none')).toBe(true);
			for (const row of rows) {
				expect(row.classList.contains('d-none')).toBe(true);
			}
		});

		test('shows all rows and heading when minTier is 1', () => {
			mockGetMinimumTier.mockReturnValue(1);
			const heading = document.querySelector<HTMLElement>('#ZarimanSyndicate-name')!;
			heading.classList.add('d-none');
			const rows = document.querySelector('#ZarimanSyndicate-table')!.querySelectorAll('tr');
			applyBountyFilters('ZarimanSyndicate', rows);
			expect(heading.classList.contains('d-none')).toBe(false);
			for (const row of rows) {
				expect(row.classList.contains('d-none')).toBe(false);
			}
		});

		test('hides row whose mission type is disabled', () => {
			mockIsBountyMissionTypeEnabled.mockImplementation((_, mt) => mt !== 'MT_SURVIVAL');
			const rows = makeRows(['MT_ASSASSINATION', 'MT_SURVIVAL', 'MT_ALCHEMY']);
			applyBountyFilters('EntratiLabSyndicate', rows);
			expect(rows[0].classList.contains('d-none')).toBe(false); // Assassination — visible
			expect(rows[1].classList.contains('d-none')).toBe(true); // Survival — filtered
			expect(rows[2].classList.contains('d-none')).toBe(false); // Alchemy — visible
		});

		test('passes syndicate tag to isBountyMissionTypeEnabled', () => {
			const rows = makeRows(['MT_DEFENSE']);
			applyBountyFilters('HexSyndicate', rows);
			expect(mockIsBountyMissionTypeEnabled).toHaveBeenCalledWith('HexSyndicate', 'MT_DEFENSE');
		});

		test('row with no data-mission-type is always shown', () => {
			const rows = makeRows(['']);
			applyBountyFilters('ZarimanSyndicate', rows);
			expect(rows[0].classList.contains('d-none')).toBe(false);
		});

		test('shows empty state when all rows are filtered by mission type', () => {
			mockIsBountyMissionTypeEnabled.mockReturnValue(false);
			const rows = document.querySelector('#EntratiLabSyndicate-table')!.querySelectorAll('tr');
			for (const row of rows) {
				(row as HTMLElement).dataset.missionType = 'MT_SURVIVAL';
			}

			applyBountyFilters('EntratiLabSyndicate', rows);
			expect(document.querySelector('#EntratiLabSyndicate-empty')!.classList.contains('d-none')).toBe(false);
		});

		test('does not show empty state when minTier < 1 (hide all)', () => {
			mockGetMinimumTier.mockReturnValue(-1);
			mockIsBountyMissionTypeEnabled.mockReturnValue(false);
			const rows = document.querySelector('#EntratiLabSyndicate-table')!.querySelectorAll('tr');
			for (const row of rows) {
				(row as HTMLElement).dataset.missionType = 'MT_SURVIVAL';
			}

			applyBountyFilters('EntratiLabSyndicate', rows);
			expect(document.querySelector('#EntratiLabSyndicate-empty')!.classList.contains('d-none')).toBe(true);
		});

		test('hides empty state when rows become visible again', () => {
			mockIsBountyMissionTypeEnabled.mockReturnValue(false);
			const rows = document.querySelector('#EntratiLabSyndicate-table')!.querySelectorAll('tr');
			for (const row of rows) {
				(row as HTMLElement).dataset.missionType = 'MT_SURVIVAL';
			}

			applyBountyFilters('EntratiLabSyndicate', rows);
			expect(document.querySelector('#EntratiLabSyndicate-empty')!.classList.contains('d-none')).toBe(false);

			mockIsBountyMissionTypeEnabled.mockReturnValue(true);
			applyBountyFilters('EntratiLabSyndicate', rows);
			expect(document.querySelector('#EntratiLabSyndicate-empty')!.classList.contains('d-none')).toBe(true);
		});
	});
});
