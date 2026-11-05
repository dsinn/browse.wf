import {
	describe, it, expect, beforeEach,
} from 'vitest';
import {mockBootstrapTooltip} from '@test/helpers/dom-helpers';
import {addTimeStatTooltip, addStatPercentage, addCipherAvgTooltip} from './stats-tooltips';

function makePluralize() {
	return (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
}

describe('addTimeStatTooltip', () => {
	beforeEach(() => {
		mockBootstrapTooltip();
		(globalThis as any).pluralize = makePluralize();
	});

	it('applies tooltip decoration to the element', () => {
		const elm = document.createElement('span');
		addTimeStatTooltip(elm, 'CipherTime', 90);
		expect(elm.style.cursor).toBe('help');
		expect(elm.style.textDecoration).toBe('underline dotted');
		expect(elm.dataset.bsToggle).toBe('tooltip');
	});

	it('sets CipherTime tooltip to rounded seconds', () => {
		const elm = document.createElement('span');
		addTimeStatTooltip(elm, 'CipherTime', 90.7);
		expect(elm.dataset.bsTitle).toBe('91 seconds');
	});

	it('sets TimePlayedSec tooltip to day/hour/minute/second breakdown', () => {
		const elm = document.createElement('span');
		// 1 day + 2 hours + 3 minutes + 4 seconds = 93784 seconds
		addTimeStatTooltip(elm, 'TimePlayedSec', 93_784);
		expect(elm.dataset.bsTitle).toBe('1 day, 2 hours, 3 minutes, 4 seconds');
	});

	it('uses plural forms correctly', () => {
		const elm = document.createElement('span');
		addTimeStatTooltip(elm, 'TimePlayedSec', 3661); // 1h 1m 1s
		expect(elm.dataset.bsTitle).toBe('0 days, 1 hour, 1 minute, 1 second');
	});

	it('initialises a Bootstrap tooltip', () => {
		const elm = document.createElement('span');
		document.body.append(elm);
		addTimeStatTooltip(elm, 'CipherTime', 60);
		expect((globalThis as any).bootstrap.Tooltip.getInstance(elm)).toBeTruthy();
	});
});

describe('addStatPercentage', () => {
	beforeEach(() => {
		document.body.innerHTML = `
			<span id="stat-MissionsCompleted"></span>
			<span id="stat-MissionsFailed"></span>
			<span id="stat-CiphersSolved"></span>
			<span id="stat-CiphersFailed"></span>
			<span id="stat-Income"></span>
		`;
		(globalThis as any).profile = {
			Stats: {
				MissionsCompleted: 75,
				MissionsFailed: 15,
				MissionsQuit: 5,
				MissionsInterrupted: 3,
				MissionsDumped: 2,
				CiphersSolved: 80,
				CiphersFailed: 20,
			},
		};
		// Simulate upstream having set textContent already
		document.querySelector('#stat-MissionsCompleted')!.textContent = '75';
		document.querySelector('#stat-MissionsFailed')!.textContent = '15';
		document.querySelector('#stat-CiphersSolved')!.textContent = '80';
		document.querySelector('#stat-CiphersFailed')!.textContent = '20';
		document.querySelector('#stat-Income')!.textContent = '1,000';
	});

	it('appends percentage to a mission stat', () => {
		addStatPercentage('MissionsCompleted', 75);
		// Total = 75+15+5+3+2 = 100, so 75%
		expect(document.querySelector('#stat-MissionsCompleted')!.textContent).toBe('75 (75.00%)');
	});

	it('appends percentage to a cipher stat', () => {
		addStatPercentage('CiphersSolved', 80);
		// Total = 80+20 = 100, so 80%
		expect(document.querySelector('#stat-CiphersSolved')!.textContent).toBe('80 (80.00%)');
	});

	it('does nothing for a non-mission non-cipher stat', () => {
		addStatPercentage('Income', 1000);
		expect(document.querySelector('#stat-Income')!.textContent).toBe('1,000');
	});

	it('does nothing when total is zero', () => {
		(globalThis as any).profile = {
			Stats: {
				MissionsCompleted: 0, MissionsFailed: 0, MissionsQuit: 0, MissionsInterrupted: 0, MissionsDumped: 0,
			},
		};
		document.querySelector('#stat-MissionsCompleted')!.textContent = '0';
		addStatPercentage('MissionsCompleted', 0);
		expect(document.querySelector('#stat-MissionsCompleted')!.textContent).toBe('0');
	});
});

describe('addCipherAvgTooltip', () => {
	beforeEach(() => {
		mockBootstrapTooltip();
	});

	it('replaces textContent with 3-decimal precision', () => {
		const elm = document.createElement('span');
		elm.textContent = '3.3s'; // Upstream set this
		addCipherAvgTooltip(elm, {Stats: {CipherTime: 10, CiphersSolved: 3}});
		expect(elm.textContent).toBe('3.333s');
	});

	it('applies tooltip decoration', () => {
		const elm = document.createElement('span');
		addCipherAvgTooltip(elm, {Stats: {CipherTime: 5, CiphersSolved: 2}});
		expect(elm.style.cursor).toBe('help');
		expect(elm.dataset.bsToggle).toBe('tooltip');
	});

	it('sets tooltip title to full unrounded value', () => {
		const elm = document.createElement('span');
		addCipherAvgTooltip(elm, {Stats: {CipherTime: 10, CiphersSolved: 3}});
		expect(elm.dataset.bsTitle).toMatch(/^3\.3{15,}\d? seconds$/u);
	});

	it('initialises a Bootstrap tooltip', () => {
		const elm = document.createElement('span');
		document.body.append(elm);
		addCipherAvgTooltip(elm, {Stats: {CipherTime: 5, CiphersSolved: 2}});
		expect((globalThis as any).bootstrap.Tooltip.getInstance(elm)).toBeTruthy();
	});
});
