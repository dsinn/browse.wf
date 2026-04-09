/**
 * Tests for CloudSyncHandler
 * Push/pull operations and justPushed deduplication
 */
import {
	describe, test, expect, beforeEach, afterEach, vi,
} from 'vitest';
import type {UserData} from '../../src/cloud-sync/types';
import {CloudSyncHandler} from '../../src/cloud-sync/handler';
import {db} from '../../src/cloud-sync/database';

vi.mock('../../src/cloud-sync/database', () => ({
	db: {
		from: vi.fn(),
	},
	isDatabaseConfigured: vi.fn(() => true),
}));

vi.mock('../../src/logger', () => ({
	logger: {
		debug: vi.fn(),
		log: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

describe('CloudSyncHandler', () => {
	let handler: CloudSyncHandler;
	let mockFromChain: any;

	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();

		mockFromChain = {
			select: vi.fn().mockReturnThis(),
			eq: vi.fn().mockReturnThis(),
			single: vi.fn(),
			upsert: vi.fn(),
		};

		vi.mocked(db.from).mockReturnValue(mockFromChain);

		handler = new CloudSyncHandler();
	});

	afterEach(() => {
		localStorage.clear();
	});

	describe('pushToDatabase', () => {
		test('should serialize localStorage and upsert to db', async () => {
			localStorage.setItem('lang', 'fr');
			localStorage.setItem('live.notif.alert1', 'true');
			localStorage.setItem('live.collapse.section1', 'true');

			mockFromChain.upsert.mockResolvedValue({error: null});

			await handler.pushToDatabase('test-user-uuid');

			expect(db.from).toHaveBeenCalledWith('user_data');
			expect(mockFromChain.upsert).toHaveBeenCalledWith({
				user_id: 'test-user-uuid',
				data: {
					lang: 'fr',
					live: {
						notif: {alert1: 'true'},
						collapse: {section1: 'true'},
					},
				},
			});
		});

		test('should dispatch cloud-sync-before-push before serializing', async () => {
			mockFromChain.upsert.mockResolvedValue({error: null});

			const events: string[] = [];
			globalThis.addEventListener('cloud-sync-before-push', () => {
				events.push('cloud-sync-before-push');
			}, {once: true});

			await handler.pushToDatabase('test-user');

			expect(events).toContain('cloud-sync-before-push');
		});

		test('should set justPushed flag after successful push', async () => {
			mockFromChain.upsert.mockResolvedValue({error: null});

			await handler.pushToDatabase('test-user');

			expect((handler as any).justPushed).toBe(true);
		});

		test('should expose justPushed via isJustPushed getter', async () => {
			mockFromChain.upsert.mockResolvedValue({error: null});

			expect(handler.isJustPushed).toBe(false);
			await handler.pushToDatabase('test-user');
			expect(handler.isJustPushed).toBe(true);
		});

		test('should clear justPushed flag after 5 seconds', async () => {
			vi.useFakeTimers();

			mockFromChain.upsert.mockResolvedValue({error: null});
			await handler.pushToDatabase('test-user');

			expect(handler.isJustPushed).toBe(true);

			vi.advanceTimersByTime(5000);
			await vi.runAllTimersAsync();

			expect(handler.isJustPushed).toBe(false);

			vi.useRealTimers();
		});

		test('should clear justPushed flag and rethrow on upsert error', async () => {
			mockFromChain.upsert.mockResolvedValue({error: {message: 'DB write failed'}});

			await expect(handler.pushToDatabase('test-user')).rejects.toThrow('DB write failed');
			expect(handler.isJustPushed).toBe(false);
		});

		test('should clear justPushed and justPushedTimeout when upsert rejects after prior success', async () => {
			vi.useFakeTimers();

			// First a successful push to start the timeout
			mockFromChain.upsert.mockResolvedValue({error: null});
			await handler.pushToDatabase('test-user');
			expect(handler.isJustPushed).toBe(true);
			expect((handler as any).justPushedTimeout).toBeDefined();

			// Now fail a second push — existing timeout should be cleared too
			mockFromChain.upsert.mockResolvedValue({error: {message: 'fail'}});
			await expect(handler.pushToDatabase('test-user')).rejects.toThrow();

			expect(handler.isJustPushed).toBe(false);
			expect((handler as any).justPushedTimeout).toBeUndefined();

			vi.useRealTimers();
		});

		test('should exclude auth token from sync (security)', async () => {
			localStorage.setItem('lang', 'en');
			localStorage.setItem('sb-test-project-auth-token', 'sensitive-value');

			mockFromChain.upsert.mockResolvedValue({error: null});

			await handler.pushToDatabase('test-user-uuid');

			const call = vi.mocked(mockFromChain.upsert).mock.calls[0][0];
			expect(call.data.lang).toBe('en');
			expect(call.data.sb).toBeUndefined();
		});
	});

	describe('pullFromDatabase', () => {
		test('should write cloud data to localStorage', async () => {
			const userData: UserData = {
				lang: 'fr',
				live: {
					notif: {alert1: 'true'},
					collapse: {section1: 'true'},
				},
			};

			mockFromChain.single.mockResolvedValue({
				data: {data: userData},
				error: null,
			});

			await handler.pullFromDatabase('test-user');

			expect(localStorage.getItem('lang')).toBe('fr');
			expect(localStorage.getItem('live.notif.alert1')).toBe('true');
			expect(localStorage.getItem('live.collapse.section1')).toBe('true');
		});

		test('should dispatch cloud-sync-pulled after writing data', async () => {
			mockFromChain.single.mockResolvedValue({
				data: {data: {lang: 'en'}},
				error: null,
			});

			const events: string[] = [];
			globalThis.addEventListener('cloud-sync-pulled', () => {
				events.push('cloud-sync-pulled');
			}, {once: true});

			await handler.pullFromDatabase('test-user');

			expect(events).toContain('cloud-sync-pulled');
		});

		test('should do nothing when row is null', async () => {
			mockFromChain.single.mockResolvedValue({data: null, error: null});

			await handler.pullFromDatabase('test-user');

			expect(localStorage.length).toBe(0);
		});

		test('should throw when db returns an error', async () => {
			mockFromChain.single.mockResolvedValue({
				data: null,
				error: {message: 'connection reset'},
			});

			await expect(handler.pullFromDatabase('test-user')).rejects.toThrow('connection reset');
		});

		test('should clear localStorage keys not in cloud data', async () => {
			localStorage.setItem('live.notif.alert1', 'true');

			mockFromChain.single.mockResolvedValue({
				data: {data: {lang: 'en'}},
				error: null,
			});

			await handler.pullFromDatabase('test-user');

			expect(localStorage.getItem('lang')).toBe('en');
			expect(localStorage.getItem('live.notif.alert1')).toBeNull();
		});

		test('should preserve auth token when pulling', async () => {
			localStorage.setItem('sb-test-project-auth-token', 'sensitive-value');

			mockFromChain.single.mockResolvedValue({
				data: {data: {lang: 'en'}},
				error: null,
			});

			await handler.pullFromDatabase('test-user');

			expect(localStorage.getItem('sb-test-project-auth-token')).toBe('sensitive-value');
		});
	});
});
