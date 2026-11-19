import {
	describe,
	it,
	expect,
	beforeEach,
	vi,
} from 'vitest';
import {
	createInternalName,
	enableInternalNameTooltips,
	renderInternalName,
} from './internal-name';

describe('createInternalName', () => {
	it('is teletype showing the last segment, with the full path as the Bootstrap tooltip title', () => {
		const element = createInternalName('/Lotus/Types/Retired/RetiredAvatar');

		expect(element.tagName).toBe('CODE');
		expect(element.textContent).toBe('RetiredAvatar');
		expect(element.dataset.bsToggle).toBe('tooltip');
		expect(element.dataset.bsTitle).toBe('/Lotus/Types/Retired/RetiredAvatar');
	});

	it('does not use the native title attribute', () => {
		expect(createInternalName('/Lotus/A/B').title).toBe('');
	});
});

describe('renderInternalName', () => {
	it('replaces the cell contents', () => {
		const cell = document.createElement('td');
		cell.textContent = 'undefined';
		renderInternalName(cell, '/Lotus/A/B');

		expect(cell.children).toHaveLength(1);
		expect(cell.textContent).toBe('B');
	});
});

describe('enableInternalNameTooltips', () => {
	let tooltip: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		tooltip = vi.fn();
		(window as any).bootstrap = {Tooltip: tooltip};
	});

	it('creates one delegated Bootstrap tooltip on the container, targeting internal names', () => {
		const tbody = document.createElement('tbody');
		enableInternalNameTooltips(tbody);

		expect(tooltip).toHaveBeenCalledTimes(1);
		expect(tooltip).toHaveBeenCalledWith(tbody, {selector: 'code.internal-name'});
	});

	it('does not create another for the same container', () => {
		const tbody = document.createElement('tbody');
		enableInternalNameTooltips(tbody);
		enableInternalNameTooltips(tbody);

		expect(tooltip).toHaveBeenCalledTimes(1);
	});

	it('does nothing without a container', () => {
		enableInternalNameTooltips(undefined);

		expect(tooltip).not.toHaveBeenCalled();
	});
});
