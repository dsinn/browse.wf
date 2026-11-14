import {describe, expect, test} from 'vitest';
import {pickActiveSectionId, pickUrlHash} from './weekly-forecast-toc.js';

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

describe('pickUrlHash', () => {
	const viewportHeight = 1000;

	test('is empty when there are no sections', () => {
		expect(pickUrlHash([], viewportHeight, false)).toBe('');
	});

	test('is empty while the first section is still below the top of the viewport', () => {
		expect(pickUrlHash([{id: 'a', top: 200}, {id: 'b', top: 900}], viewportHeight, false)).toBe('');
	});

	test('names the first section once its top reaches the top of the viewport', () => {
		expect(pickUrlHash([{id: 'a', top: 0}, {id: 'b', top: 900}], viewportHeight, false)).toBe('#a');
	});

	test('names the current section further down the page', () => {
		const sections = [{id: 'a', top: -800}, {id: 'b', top: 250}, {id: 'c', top: 600}];
		expect(pickUrlHash(sections, viewportHeight, false)).toBe('#b');
	});

	test('names the last section at the bottom of the page', () => {
		const sections = [{id: 'a', top: -800}, {id: 'b', top: -100}, {id: 'c', top: 700}];
		expect(pickUrlHash(sections, viewportHeight, true)).toBe('#c');
	});

	test('keeps a link to an earlier section while it still starts on screen and a later one is current', () => {
		const sections = [{id: 'a', top: -800}, {id: 'b', top: 100}, {id: 'c', top: 700}];
		expect(pickUrlHash(sections, viewportHeight, true, '#b')).toBe('#b');
		expect(pickUrlHash([{id: 'z', top: -800}, {id: 'a', top: 50}, {id: 'b', top: 250}], viewportHeight, false, '#a')).toBe('#a');
	});

	test('replaces a link to an earlier section once its start has scrolled off the top', () => {
		const sections = [{id: 'a', top: -800}, {id: 'b', top: -100}, {id: 'c', top: 700}];
		expect(pickUrlHash(sections, viewportHeight, true, '#b')).toBe('#c');
	});

	test('replaces a link to a later section when scrolling back up to an earlier one', () => {
		const sections = [{id: 'a', top: -800}, {id: 'b', top: 250}, {id: 'c', top: 600}];
		expect(pickUrlHash(sections, viewportHeight, false, '#c')).toBe('#b');
	});

	test('drops the link above the first section even if it still starts on screen', () => {
		expect(pickUrlHash([{id: 'a', top: 200}, {id: 'b', top: 900}], viewportHeight, false, '#a')).toBe('');
	});
});
