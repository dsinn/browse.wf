import {
	describe,
	it,
	expect,
	beforeEach,
	afterEach,
} from 'vitest';
import {activateStatsSubtab, initStatsSubtabs} from './stats-subtabs';

function setupDOM() {
	document.body.innerHTML = `
		<ul id="stats-subnav">
			<li><a href="#" data-subtab="overview" class="active">Overview</a></li>
			<li><a href="#" data-subtab="equipment">Equipment</a></li>
			<li><a href="#" data-subtab="enemies">Enemies</a></li>
			<li><a href="#" data-subtab="abilities">Abilities</a></li>
			<li><a href="#" data-subtab="races">Races</a></li>
		</ul>
		<div id="stats-overview" class="stats-panel"></div>
		<div id="stats-equipment" class="stats-panel d-none"></div>
		<div id="stats-enemies" class="stats-panel d-none"></div>
		<div id="stats-abilities" class="stats-panel d-none"></div>
		<div id="stats-races" class="stats-panel d-none"></div>
	`;
}

function visiblePanels(): string[] {
	return [...document.querySelectorAll<HTMLElement>('.stats-panel:not(.d-none)')].map(panel => panel.id);
}

describe('stats sub-tabs', () => {
	beforeEach(() => {
		setupDOM();
		location.hash = '';
	});

	afterEach(() => {
		delete (window as any).profile;
	});

	describe('activateStatsSubtab', () => {
		it('shows only the requested panel and marks its link active', () => {
			activateStatsSubtab('equipment');

			expect(visiblePanels()).toEqual(['stats-equipment']);
			expect(document.querySelector('[data-subtab="equipment"]')?.classList.contains('active')).toBe(true);
			expect(document.querySelector('[data-subtab="overview"]')?.classList.contains('active')).toBe(false);
		});

		it('includes the races sub-tab', () => {
			activateStatsSubtab('races');

			expect(visiblePanels()).toEqual(['stats-races']);
		});

		it('falls back to the overview for an unknown sub-tab', () => {
			activateStatsSubtab('equipment');
			activateStatsSubtab('nonsense');

			expect(visiblePanels()).toEqual(['stats-overview']);
		});
	});

	describe('initStatsSubtabs', () => {
		it('starts on the sub-tab requested by the URL', () => {
			initStatsSubtabs(new URLSearchParams('tab=stats&sub=abilities'));

			expect(visiblePanels()).toEqual(['stats-abilities']);
		});

		it('starts on the overview when the URL has no sub-tab', () => {
			initStatsSubtabs(new URLSearchParams('tab=stats'));

			expect(visiblePanels()).toEqual(['stats-overview']);
		});

		it('switches panels when a link is clicked', () => {
			initStatsSubtabs();
			document.querySelector<HTMLElement>('[data-subtab="enemies"]')!.click();

			expect(visiblePanels()).toEqual(['stats-enemies']);
		});

		it('binds the click handler only once, however often it is initialized', () => {
			initStatsSubtabs();
			initStatsSubtabs(new URLSearchParams('sub=abilities'));

			expect(visiblePanels()).toEqual(['stats-overview']);
		});

		it('records the sub-tab in the URL hash once a profile is loaded', () => {
			(window as any).profile = {};
			location.hash = 'tab=stats';
			initStatsSubtabs();
			document.querySelector<HTMLElement>('[data-subtab="equipment"]')!.click();

			expect(new URLSearchParams(location.hash.replace('#', '')).toString()).toBe('tab=stats&sub=equipment');
		});

		it('leaves the URL hash alone when no profile is loaded', () => {
			initStatsSubtabs();
			document.querySelector<HTMLElement>('[data-subtab="equipment"]')!.click();

			expect(location.hash).toBe('');
		});
	});
});
