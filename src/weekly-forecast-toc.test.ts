import {describe, expect, test} from 'vitest';
import {pickActiveSectionId} from './weekly-forecast-toc.js';

describe('pickActiveSectionId', () => {
	const viewportHeight = 1000;

	test('returns undefined when there are no sections', () => {
		expect(pickActiveSectionId([], viewportHeight, false)).toBeUndefined();
	});

	test('defaults to the first section when none has reached the top yet', () => {
		expect(pickActiveSectionId([{id: 'a', top: 400}, {id: 'b', top: 900}], viewportHeight, false)).toBe('a');
	});

	test('picks the last section whose top is within the top 30% of the viewport', () => {
		const sections = [{id: 'a', top: -800}, {id: 'b', top: 250}, {id: 'c', top: 600}];
		expect(pickActiveSectionId(sections, viewportHeight, false)).toBe('b');
	});

	test('picks the last section at the bottom of the page even if it never reached the top', () => {
		const sections = [{id: 'a', top: -800}, {id: 'b', top: -100}, {id: 'c', top: 700}];
		expect(pickActiveSectionId(sections, viewportHeight, true)).toBe('c');
	});
});
