/**
 * Tests for domain blocker safeguards
 */
import {describe, it, expect} from 'vitest';
import {isBlockedDomain, isImageRequest, validateTestRequest} from './domain-blocker';

describe('Domain Blocker', () => {
	describe('isBlockedDomain', () => {
		it('blocks oracle.browse.wf', () => {
			expect(isBlockedDomain('https://oracle.browse.wf/min')).toBe(true);
			expect(isBlockedDomain('https://oracle.browse.wf/worldState.json')).toBe(true);
		});

		it('blocks browse.wf', () => {
			expect(isBlockedDomain('https://browse.wf/arbys.txt')).toBe(true);
			expect(isBlockedDomain('http://browse.wf/some-path')).toBe(true);
		});

		it('blocks www.browse.wf', () => {
			expect(isBlockedDomain('https://www.browse.wf/')).toBe(true);
		});

		it('allows localhost', () => {
			expect(isBlockedDomain('http://localhost:61969/live.php')).toBe(false);
		});

		it('allows other domains', () => {
			expect(isBlockedDomain('https://example.com/api')).toBe(false);
			expect(isBlockedDomain('https://api.github.com/repos')).toBe(false);
		});

		it('handles invalid URLs gracefully', () => {
			expect(isBlockedDomain('not-a-url')).toBe(false);
			expect(isBlockedDomain('')).toBe(false);
		});
	});

	describe('isImageRequest', () => {
		it('detects PNG images', () => {
			expect(isImageRequest('https://example.com/image.png')).toBe(true);
			expect(isImageRequest('https://example.com/path/to/image.PNG')).toBe(true);
		});

		it('detects JPG/JPEG images', () => {
			expect(isImageRequest('https://example.com/photo.jpg')).toBe(true);
			expect(isImageRequest('https://example.com/photo.jpeg')).toBe(true);
			expect(isImageRequest('https://example.com/photo.JPG')).toBe(true);
		});

		it('detects WEBP images', () => {
			expect(isImageRequest('https://example.com/image.webp')).toBe(true);
			expect(isImageRequest('https://example.com/image.WEBP')).toBe(true);
		});

		it('detects other image formats', () => {
			expect(isImageRequest('https://example.com/image.gif')).toBe(true);
			expect(isImageRequest('https://example.com/image.svg')).toBe(true);
		});

		it('rejects non-image URLs', () => {
			expect(isImageRequest('https://example.com/api/data')).toBe(false);
			expect(isImageRequest('https://example.com/file.json')).toBe(false);
			expect(isImageRequest('https://example.com/file.txt')).toBe(false);
		});

		it('handles URLs with query params', () => {
			expect(isImageRequest('https://example.com/image.png?v=123')).toBe(true);
			expect(isImageRequest('https://example.com/api?file=image.png')).toBe(false);
		});
	});

	describe('validateTestRequest', () => {
		it('allows non-blocked domains', () => {
			expect(() => {
				validateTestRequest('http://localhost:61969/live.php');
			}).not.toThrow();
			expect(() => {
				validateTestRequest('https://example.com/api');
			}).not.toThrow();
		});

		it('allows image requests to blocked domains', () => {
			expect(() => {
				validateTestRequest('https://oracle.browse.wf/logo.png');
			}).not.toThrow();
			expect(() => {
				validateTestRequest('https://browse.wf/image.jpg');
			}).not.toThrow();
		});

		it('throws for non-image requests to oracle.browse.wf', () => {
			expect(() => {
				validateTestRequest('https://oracle.browse.wf/min');
			})
				.toThrow(/TEST SAFEGUARD.*production domain/u);
			expect(() => {
				validateTestRequest('https://oracle.browse.wf/worldState.json');
			})
				.toThrow(/TEST SAFEGUARD.*production domain/u);
		});

		it('throws for non-image requests to browse.wf', () => {
			expect(() => {
				validateTestRequest('https://browse.wf/arbys.txt');
			})
				.toThrow(/TEST SAFEGUARD.*production domain/u);
			expect(() => {
				validateTestRequest('https://www.browse.wf/api');
			})
				.toThrow(/TEST SAFEGUARD.*production domain/u);
		});

		it('error message is helpful', () => {
			try {
				validateTestRequest('https://oracle.browse.wf/min');
				expect.fail('Should have thrown');
			} catch (error) {
				const {message} = (error as Error);
				expect(message).toContain('TEST SAFEGUARD');
				expect(message).toContain('production domain');
				expect(message).toContain('oracle.browse.wf/min');
				expect(message).toContain('api-mocks.ts');
			}
		});
	});
});
