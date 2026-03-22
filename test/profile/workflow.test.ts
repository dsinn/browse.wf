import {
	describe, it, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {loadFixture} from '../helpers/fixture-loader';
// WarframeApiFrontProxyClient is imported after module reset in each test group,
// so we spy on the globally-registered instance instead of the static import.
// A static import here lets TypeScript resolve types.
import type {WarframeApiFrontProxyClient as _WarframeApiFrontProxyClient} from '../../src/warframe-api-proxy-client';

const VALID_ACCOUNT_ID = '55540360384632532d7b23c6';
const MOCK_PROFILE_DATA = {Results: [{DisplayName: 'TestUser', PlayerLevel: 30, AccountId: {$oid: VALID_ACCOUNT_ID}}]};
const PROFILE_FIXTURE = loadFixture('profile');

function setupGlobals() {
	(globalThis as any).__profileParams = new URLSearchParams('');
	(globalThis as any).renderProfile = vi.fn();
	(globalThis as any).activateTab = vi.fn();
	(globalThis as any).triggerCloudSync = vi.fn();
	(globalThis as any).createArbyCountdownBadge = vi.fn(() => document.createTextNode('21h'));
	(globalThis as any).__showAutoFetchFlow = false;
}

async function freshWorkflow() {
	vi.resetModules();
	return import('../../src/profile/workflow.js');
}

beforeEach(() => {
	document.body.innerHTML = PROFILE_FIXTURE;
	setupGlobals();
	localStorage.clear();
	// Pre-populate profile data so initialProfilePromise resolves from cache
	// Rather than triggering a fallback fetch (which isn't mocked).
	localStorage.setItem('profile.data', JSON.stringify(MOCK_PROFILE_DATA));
	vi.useFakeTimers({now: 1_768_087_200_000}); // Frozen time
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
	for (const key of [
		'cloudSyncEvent',
		'initialProfilePromise',
		'__showAutoFetchFlow',
		'__profileParams',
		'renderProfile',
		'activateTab',
		'triggerCloudSync',
		'createArbyCountdownBadge',
		'copyWarframePath',
		'fetchProfile',
		'loadEELog',
		'loadProfile',
		'onAccountIdManualInput',
		'onDownloadLinkLeftClick',
		'onDownloadLinkRightClick',
		'onPlatformChange',
		'profileWorkflowReady',
		'updateProfileAge',
	]) {
		// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
		delete (globalThis as any)[key];
	}
});

// ─── step status indicators ───────────────────────────────────────────────────

describe('step status indicators', () => {
	it('profileWorkflowReady marks step1 complete when platform is pre-selected', async () => {
		document.querySelector<HTMLSelectElement>('#platform-select')!.value = 'pc';
		await freshWorkflow();
		(globalThis as any).profileWorkflowReady('unauthenticated', false);
		expect(document.querySelector('#step1-container')?.classList.contains('complete')).toBe(true);
	});

	it('profileWorkflowReady leaves step1 incomplete when no platform selected', async () => {
		await freshWorkflow();
		(globalThis as any).profileWorkflowReady('unauthenticated', false);
		expect(document.querySelector('#step1-container')?.classList.contains('complete')).toBe(false);
	});

	it('onPlatformChange marks step1 complete when a platform is selected', async () => {
		await freshWorkflow();
		document.querySelector<HTMLSelectElement>('#platform-select')!.value = 'ps4';
		(globalThis as any).onPlatformChange();
		expect(document.querySelector('#step1-container')?.classList.contains('complete')).toBe(true);
	});

	it('onPlatformChange marks step1 incomplete when platform is cleared', async () => {
		await freshWorkflow();
		document.querySelector<HTMLSelectElement>('#platform-select')!.value = '';
		(globalThis as any).onPlatformChange();
		expect(document.querySelector('#step1-container')?.classList.contains('complete')).toBe(false);
	});
});

// ─── profileWorkflowReady ─────────────────────────────────────────────────────

describe('profileWorkflowReady', () => {
	beforeEach(async () => {
		await freshWorkflow();
	});

	it('reveals #steps element', () => {
		(globalThis as any).profileWorkflowReady('unauthenticated', false);
		expect(document.querySelector('#steps')?.classList.contains('d-none')).toBe(false);
	});

	it('adds manual-flow class when showAutoFetchFlow is false', () => {
		(globalThis as any).profileWorkflowReady('unauthenticated', false);
		expect(document.querySelector('#steps')?.classList.contains('manual-flow')).toBe(true);
	});

	it('removes manual-flow class when showAutoFetchFlow is true', () => {
		(globalThis as any).profileWorkflowReady('complete', true);
		expect(document.querySelector('#steps')?.classList.contains('manual-flow')).toBe(false);
	});

	it('sets __showAutoFetchFlow on globalThis', () => {
		(globalThis as any).profileWorkflowReady('complete', true);
		expect((globalThis as any).__showAutoFetchFlow).toBe(true);
	});

	it('shows rate-limit notice when syncResult is complete and nextFetch is in the future', () => {
		const futureTs = Date.now() + 3_600_000;
		localStorage.setItem('profile.nextFetchAvailableAt', futureTs.toString());
		(globalThis as any).profileWorkflowReady('complete', false);
		expect(document.querySelector('#rate-limit-notice')?.classList.contains('d-none')).toBe(false);
	});

	it('does not show rate-limit notice when nextFetch is in the past', () => {
		localStorage.setItem('profile.nextFetchAvailableAt', (Date.now() - 1000).toString());
		(globalThis as any).profileWorkflowReady('complete', true);
		expect(document.querySelector('#rate-limit-notice')?.classList.contains('d-none')).toBe(true);
	});

	it('restores saved platform from localStorage', () => {
		localStorage.setItem('profile.platform', 'ps4');
		(globalThis as any).profileWorkflowReady('unauthenticated', false);
		expect(document.querySelector<HTMLSelectElement>('#platform-select')!.value).toBe('ps4');
	});

	it('restores saved account ID from localStorage', () => {
		localStorage.setItem('profile.accountId', VALID_ACCOUNT_ID);
		(globalThis as any).profileWorkflowReady('unauthenticated', false);
		expect(document.querySelector<HTMLInputElement>('#account-id')!.value).toBe(VALID_ACCOUNT_ID);
	});

	it('shows refresh alert when saved account ID is present', () => {
		localStorage.setItem('profile.accountId', VALID_ACCOUNT_ID);
		(globalThis as any).profileWorkflowReady('unauthenticated', false);
		expect(document.querySelector('#refresh-alert')?.classList.contains('d-none')).toBe(false);
	});

	it('marks step2 complete when saved account ID is present', () => {
		localStorage.setItem('profile.accountId', VALID_ACCOUNT_ID);
		(globalThis as any).profileWorkflowReady('unauthenticated', false);
		expect(document.querySelector('#step2-container')?.classList.contains('complete')).toBe(true);
	});
});

// ─── onAccountIdManualInput ───────────────────────────────────────────────────

describe('onAccountIdManualInput', () => {
	beforeEach(async () => {
		await freshWorkflow();
	});

	it('accepts a valid 24-char hex account ID', () => {
		const input = document.querySelector<HTMLInputElement>('#account-id')!;
		input.value = VALID_ACCOUNT_ID;
		(globalThis as any).onAccountIdManualInput();
		expect(input.classList.contains('is-valid')).toBe(true);
		expect(input.classList.contains('is-invalid')).toBe(false);
	});

	it('marks step2 complete for a valid account ID', () => {
		const input = document.querySelector<HTMLInputElement>('#account-id')!;
		input.value = VALID_ACCOUNT_ID;
		(globalThis as any).onAccountIdManualInput();
		expect(document.querySelector('#step2-container')?.classList.contains('complete')).toBe(true);
	});

	it('marks input invalid for a partial (short) ID', () => {
		const input = document.querySelector<HTMLInputElement>('#account-id')!;
		input.value = 'abc123';
		(globalThis as any).onAccountIdManualInput();
		expect(input.classList.contains('is-invalid')).toBe(true);
	});

	it('does not mark invalid when input is empty', () => {
		const input = document.querySelector<HTMLInputElement>('#account-id')!;
		input.value = '';
		(globalThis as any).onAccountIdManualInput();
		expect(input.classList.contains('is-invalid')).toBe(false);
	});

	it('strips non-hex characters and lowercases', () => {
		const input = document.querySelector<HTMLInputElement>('#account-id')!;
		input.value = 'ABCXYZ123';
		(globalThis as any).onAccountIdManualInput();
		expect(input.value).toBe('abc123');
	});

	it('shows invalid-chars notice when non-hex chars were entered', () => {
		const input = document.querySelector<HTMLInputElement>('#account-id')!;
		input.value = 'GHI';
		(globalThis as any).onAccountIdManualInput();
		expect(document.querySelector('#account-id-invalid-chars')?.classList.contains('d-none')).toBe(false);
	});

	it('saves valid account ID to localStorage', () => {
		const input = document.querySelector<HTMLInputElement>('#account-id')!;
		input.value = VALID_ACCOUNT_ID;
		(globalThis as any).onAccountIdManualInput();
		expect(localStorage.getItem('profile.accountId')).toBe(VALID_ACCOUNT_ID);
	});

	it('updates char count display', () => {
		const input = document.querySelector<HTMLInputElement>('#account-id')!;
		input.value = 'abc';
		(globalThis as any).onAccountIdManualInput();
		expect(document.querySelector('#account-id-char-count')?.textContent).toBe('3');
	});

	it('updates feedback to valid-feedback class for valid ID', () => {
		const input = document.querySelector<HTMLInputElement>('#account-id')!;
		input.value = VALID_ACCOUNT_ID;
		(globalThis as any).onAccountIdManualInput();
		const feedback = document.querySelector('#account-id-feedback');
		expect(feedback?.classList.contains('valid-feedback')).toBe(true);
		expect(feedback?.classList.contains('invalid-feedback')).toBe(false);
	});

	it('updates feedback to invalid-feedback for partial ID', () => {
		const input = document.querySelector<HTMLInputElement>('#account-id')!;
		input.value = 'abc';
		(globalThis as any).onAccountIdManualInput();
		const feedback = document.querySelector('#account-id-feedback');
		expect(feedback?.classList.contains('invalid-feedback')).toBe(true);
	});
});

// ─── updateDownloadLink ───────────────────────────────────────────────────────

describe('updateDownloadLink (via onAccountIdManualInput with valid ID + platform)', () => {
	beforeEach(async () => {
		await freshWorkflow();
		document.querySelector<HTMLSelectElement>('#platform-select')!.value = 'pc';
		(globalThis as any).onPlatformChange();
	});

	it('sets href on #download-link for PC', () => {
		const input = document.querySelector<HTMLInputElement>('#account-id')!;
		input.value = VALID_ACCOUNT_ID;
		(globalThis as any).onAccountIdManualInput();
		const {href} = document.querySelector<HTMLAnchorElement>('#download-link')!;
		expect(href).toContain('content.warframe.com');
		expect(href).toContain(VALID_ACCOUNT_ID);
	});

	it('sets href with platform suffix for ps4', () => {
		document.querySelector<HTMLSelectElement>('#platform-select')!.value = 'ps4';
		(globalThis as any).onPlatformChange();
		const input = document.querySelector<HTMLInputElement>('#account-id')!;
		input.value = VALID_ACCOUNT_ID;
		(globalThis as any).onAccountIdManualInput();
		const {href} = document.querySelector<HTMLAnchorElement>('#download-link')!;
		expect(href).toContain('content-ps4.warframe.com');
	});
});

// ─── onDownloadLinkLeftClick / onDownloadLinkRightClick ───────────────────────

describe('download link click handlers', () => {
	beforeEach(async () => {
		await freshWorkflow();
	});

	it('left-click prevents default and shows download warning', () => {
		const event = new MouseEvent('click');
		const preventSpy = vi.spyOn(event, 'preventDefault');
		(globalThis as any).onDownloadLinkLeftClick(event);
		expect(preventSpy).toHaveBeenCalled();
		expect(document.querySelector('#download-warning')?.classList.contains('d-none')).toBe(false);
	});

	it('right-click marks step3-manual complete and hides download warning', () => {
		document.querySelector('#download-warning')?.classList.remove('d-none');
		(globalThis as any).onDownloadLinkRightClick(new MouseEvent('contextmenu'));
		expect(document.querySelector('#step3-manual-container')?.classList.contains('complete')).toBe(true);
		expect(document.querySelector('#download-warning')?.classList.contains('d-none')).toBe(true);
	});
});

// ─── loadEELog ────────────────────────────────────────────────────────────────

describe('loadEELog', () => {
	const EE_LOG_CONTENT = `[0.000] Sys [Diag]: Build label: ...\n[1.234] Net [Info]: Logged in, playerId: ${VALID_ACCOUNT_ID}`;
	const EE_LOG_NO_ID = '[0.000] Sys [Diag]: Build label: ...\n[1.0] Net [Info]: Not logged in yet.';

	beforeEach(async () => {
		await freshWorkflow();
		document.querySelector<HTMLSelectElement>('#platform-select')!.value = 'pc';
		(globalThis as any).__showAutoFetchFlow = false;
	});

	it('extracts account ID and populates #account-id in manual flow', async () => {
		const file = new File([EE_LOG_CONTENT], 'EE.log', {type: 'text/plain'});
		await (globalThis as any).loadEELog(file);
		expect(document.querySelector<HTMLInputElement>('#account-id')!.value).toBe(VALID_ACCOUNT_ID);
	});

	it('saves account ID to localStorage', async () => {
		const file = new File([EE_LOG_CONTENT], 'EE.log', {type: 'text/plain'});
		await (globalThis as any).loadEELog(file);
		expect(localStorage.getItem('profile.accountId')).toBe(VALID_ACCOUNT_ID);
	});

	it('marks step2 complete after extraction', async () => {
		const file = new File([EE_LOG_CONTENT], 'EE.log', {type: 'text/plain'});
		await (globalThis as any).loadEELog(file);
		expect(document.querySelector('#step2-container')?.classList.contains('complete')).toBe(true);
	});

	it('calls fetchProfile when __showAutoFetchFlow is true', async () => {
		(globalThis as any).__showAutoFetchFlow = true;
		const {WarframeApiFrontProxyClient} = await import('../../src/warframe-api-proxy-client.js');
		const fetchSpy = vi.spyOn(WarframeApiFrontProxyClient, 'fetchProfile').mockResolvedValue({
			status: 200, data: MOCK_PROFILE_DATA, nextFetchAvailableAt: undefined,
		});
		const file = new File([EE_LOG_CONTENT], 'EE.log', {type: 'text/plain'});
		await (globalThis as any).loadEELog(file);
		expect(fetchSpy).toHaveBeenCalledWith('pc', VALID_ACCOUNT_ID);
	});

	it('does not call fetchProfile in manual flow', async () => {
		const {WarframeApiFrontProxyClient} = await import('../../src/warframe-api-proxy-client.js');
		const fetchSpy = vi.spyOn(WarframeApiFrontProxyClient, 'fetchProfile');
		const file = new File([EE_LOG_CONTENT], 'EE.log', {type: 'text/plain'});
		await (globalThis as any).loadEELog(file);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('hides status after successful extraction', async () => {
		const file = new File([EE_LOG_CONTENT], 'EE.log', {type: 'text/plain'});
		await (globalThis as any).loadEELog(file);
		expect(document.querySelector('#status')?.classList.contains('d-none')).toBe(true);
	});

	it('returns early without side effects when no file provided', async () => {
		await (globalThis as any).loadEELog(undefined);
		expect(localStorage.getItem('profile.accountId')).toBeNull();
	});

	it('shows alert when no account ID found in log', async () => {
		const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {
			// No-op
		});
		const file = new File([EE_LOG_NO_ID], 'EE.log', {type: 'text/plain'});
		await (globalThis as any).loadEELog(file);
		expect(alertSpy).toHaveBeenCalled();
	});
});

// ─── loadProfile ─────────────────────────────────────────────────────────────

describe('loadProfile', () => {
	beforeEach(async () => {
		await freshWorkflow();
		document.querySelector<HTMLSelectElement>('#platform-select')!.value = 'pc';
	});

	it('parses JSON and sets globalThis.profile', async () => {
		const file = new File([JSON.stringify(MOCK_PROFILE_DATA)], 'profile.json', {type: 'application/json'});
		await (globalThis as any).loadProfile(file);
		expect((globalThis as any).profile).toEqual(MOCK_PROFILE_DATA);
	});

	it('calls renderProfile', async () => {
		const file = new File([JSON.stringify(MOCK_PROFILE_DATA)], 'profile.json', {type: 'application/json'});
		await (globalThis as any).loadProfile(file);
		expect((globalThis as any).renderProfile).toHaveBeenCalled();
	});

	it('calls activateTab', async () => {
		const file = new File([JSON.stringify(MOCK_PROFILE_DATA)], 'profile.json', {type: 'application/json'});
		await (globalThis as any).loadProfile(file);
		expect((globalThis as any).activateTab).toHaveBeenCalled();
	});

	it('saves profile data and timestamp to localStorage', async () => {
		const file = new File([JSON.stringify(MOCK_PROFILE_DATA)], 'profile.json', {type: 'application/json'});
		await (globalThis as any).loadProfile(file);
		expect(localStorage.getItem('profile.data')).toBeTruthy();
		expect(localStorage.getItem('profile.dataFetchedAt')).toBeTruthy();
	});

	it('saves platform to localStorage', async () => {
		const file = new File([JSON.stringify(MOCK_PROFILE_DATA)], 'profile.json', {type: 'application/json'});
		await (globalThis as any).loadProfile(file);
		expect(localStorage.getItem('profile.platform')).toBe('pc');
	});

	it('triggers cloud sync', async () => {
		const file = new File([JSON.stringify(MOCK_PROFILE_DATA)], 'profile.json', {type: 'application/json'});
		await (globalThis as any).loadProfile(file);
		expect((globalThis as any).triggerCloudSync).toHaveBeenCalled();
	});

	it('marks step4 complete', async () => {
		const file = new File([JSON.stringify(MOCK_PROFILE_DATA)], 'profile.json', {type: 'application/json'});
		await (globalThis as any).loadProfile(file);
		expect(document.querySelector('#step4-container')?.classList.contains('complete')).toBe(true);
	});

	it('returns early without side effects when no file provided', async () => {
		await (globalThis as any).loadProfile(undefined);
		expect((globalThis as any).renderProfile).not.toHaveBeenCalled();
	});

	it('shows alert on invalid JSON', async () => {
		const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {
			// No-op
		});
		const file = new File(['not json {{{'], 'profile.json', {type: 'application/json'});
		await (globalThis as any).loadProfile(file);
		expect(alertSpy).toHaveBeenCalled();
	});

	it('activates the tab from __profileParams when tab param is set', async () => {
		(globalThis as any).__profileParams = new URLSearchParams('tab=missions');
		const file = new File([JSON.stringify(MOCK_PROFILE_DATA)], 'profile.json', {type: 'application/json'});
		await (globalThis as any).loadProfile(file);
		expect((globalThis as any).activateTab).toHaveBeenCalledWith('missions');
	});
});

// ─── fetchAndRenderProfile (via globalThis.fetchProfile) ─────────────────────

describe('fetchAndRenderProfile', () => {
	const NEXT_FETCH = Date.now() + 3_600_000;

	beforeEach(async () => {
		await freshWorkflow();
		document.querySelector<HTMLSelectElement>('#platform-select')!.value = 'pc';
		localStorage.setItem('profile.accountId', VALID_ACCOUNT_ID);
		(globalThis as any).profileWorkflowReady('complete', true);
	});

	async function spyFetch(result: {status: number; data: any; nextFetchAvailableAt: number | undefined}) {
		const {WarframeApiFrontProxyClient} = await import('../../src/warframe-api-proxy-client.js');
		return vi.spyOn(WarframeApiFrontProxyClient, 'fetchProfile').mockResolvedValue(result);
	}

	it('shows "Fetching profile…" status synchronously', async () => {
		await spyFetch({status: 200, data: MOCK_PROFILE_DATA, nextFetchAvailableAt: undefined});
		(globalThis as any).fetchProfile();
		expect(document.querySelector('#status')?.classList.contains('d-none')).toBe(false);
		expect(document.querySelector('#status span')?.textContent).toBe('Fetching profile...');
		await vi.advanceTimersByTimeAsync(0);
	});

	it('on success: sets profile and calls renderProfile', async () => {
		await spyFetch({status: 200, data: MOCK_PROFILE_DATA, nextFetchAvailableAt: undefined});
		(globalThis as any).fetchProfile();
		await vi.advanceTimersByTimeAsync(0);
		expect((globalThis as any).profile).toEqual(MOCK_PROFILE_DATA);
		expect((globalThis as any).renderProfile).toHaveBeenCalled();
	});

	it('on success: saves profile data, platform, account ID, timestamp to localStorage', async () => {
		await spyFetch({status: 200, data: MOCK_PROFILE_DATA, nextFetchAvailableAt: undefined});
		(globalThis as any).fetchProfile();
		await vi.advanceTimersByTimeAsync(0);
		expect(localStorage.getItem('profile.data')).toBeTruthy();
		expect(localStorage.getItem('profile.platform')).toBe('pc');
		expect(localStorage.getItem('profile.accountId')).toBe(VALID_ACCOUNT_ID);
		expect(localStorage.getItem('profile.dataFetchedAt')).toBeTruthy();
	});

	it('on success: saves nextFetchAvailableAt to localStorage', async () => {
		await spyFetch({status: 200, data: MOCK_PROFILE_DATA, nextFetchAvailableAt: NEXT_FETCH});
		(globalThis as any).fetchProfile();
		await vi.advanceTimersByTimeAsync(0);
		expect(localStorage.getItem('profile.nextFetchAvailableAt')).toBe(NEXT_FETCH.toString());
	});

	it('on success: hides status and refresh alert', async () => {
		await spyFetch({status: 200, data: MOCK_PROFILE_DATA, nextFetchAvailableAt: undefined});
		(globalThis as any).fetchProfile();
		await vi.advanceTimersByTimeAsync(0);
		expect(document.querySelector('#status')?.classList.contains('d-none')).toBe(true);
		expect(document.querySelector('#refresh-alert')?.classList.contains('d-none')).toBe(true);
	});

	it('on success: calls triggerCloudSync', async () => {
		await spyFetch({status: 200, data: MOCK_PROFILE_DATA, nextFetchAvailableAt: undefined});
		(globalThis as any).fetchProfile();
		await vi.advanceTimersByTimeAsync(0);
		expect((globalThis as any).triggerCloudSync).toHaveBeenCalled();
	});

	it('on 429: adds manual-flow and saves nextFetchAvailableAt', async () => {
		await spyFetch({status: 429, data: undefined, nextFetchAvailableAt: NEXT_FETCH});
		(globalThis as any).fetchProfile();
		await vi.advanceTimersByTimeAsync(0);
		expect(document.querySelector('#steps')?.classList.contains('manual-flow')).toBe(true);
		expect(localStorage.getItem('profile.nextFetchAvailableAt')).toBe(NEXT_FETCH.toString());
	});

	it('on 429: hides status', async () => {
		await spyFetch({status: 429, data: undefined, nextFetchAvailableAt: undefined});
		(globalThis as any).fetchProfile();
		await vi.advanceTimersByTimeAsync(0);
		expect(document.querySelector('#status')?.classList.contains('d-none')).toBe(true);
	});

	it('on 401: switches to manual flow with session-expiry message', async () => {
		await spyFetch({status: 401, data: undefined, nextFetchAvailableAt: undefined});
		(globalThis as any).fetchProfile();
		await vi.advanceTimersByTimeAsync(0);
		expect(document.querySelector('#steps')?.classList.contains('manual-flow')).toBe(true);
		expect(document.querySelector('#status span')?.textContent).toContain('expired');
	});

	it('on no data (200 but null): shows error status', async () => {
		await spyFetch({status: 200, data: undefined, nextFetchAvailableAt: undefined});
		(globalThis as any).fetchProfile();
		await vi.advanceTimersByTimeAsync(0);
		expect(document.querySelector('#status span')?.textContent).toContain('Failed');
	});

	it('on network error: shows error message in status', async () => {
		const {WarframeApiFrontProxyClient} = await import('../../src/warframe-api-proxy-client.js');
		vi.spyOn(WarframeApiFrontProxyClient, 'fetchProfile').mockRejectedValue(new Error('Network error'));
		(globalThis as any).fetchProfile();
		await vi.advanceTimersByTimeAsync(0);
		expect(document.querySelector('#status span')?.textContent).toContain('Failed');
	});
});

// ─── updateProfileAge ─────────────────────────────────────────────────────────

describe('updateProfileAge', () => {
	beforeEach(async () => {
		await freshWorkflow();
	});

	it('does nothing when no timestamp in localStorage', () => {
		(globalThis as any).updateProfileAge();
		expect(document.querySelector('#profile-fetched')?.classList.contains('d-none')).toBe(true);
	});

	it('shows "just now" when fetched less than 1 minute ago', () => {
		localStorage.setItem('profile.dataFetchedAt', (Date.now() - 30_000).toString());
		(globalThis as any).updateProfileAge();
		expect(document.querySelector('#profile-fetched span')?.textContent).toBe('just now');
	});

	it('shows singular "minute" at exactly 1 minute ago', () => {
		localStorage.setItem('profile.dataFetchedAt', (Date.now() - 60_000).toString());
		(globalThis as any).updateProfileAge();
		expect(document.querySelector('#profile-fetched span')?.textContent).toBe('1 minute ago');
	});

	it('shows plural "minutes" at 5 minutes ago', () => {
		localStorage.setItem('profile.dataFetchedAt', (Date.now() - (5 * 60_000)).toString());
		(globalThis as any).updateProfileAge();
		expect(document.querySelector('#profile-fetched span')?.textContent).toBe('5 minutes ago');
	});

	it('shows singular "hour" at exactly 1 hour ago', () => {
		localStorage.setItem('profile.dataFetchedAt', (Date.now() - 3_600_000).toString());
		(globalThis as any).updateProfileAge();
		expect(document.querySelector('#profile-fetched span')?.textContent).toBe('1 hour ago');
	});

	it('shows plural "hours" at 3 hours ago', () => {
		localStorage.setItem('profile.dataFetchedAt', (Date.now() - (3 * 3_600_000)).toString());
		(globalThis as any).updateProfileAge();
		expect(document.querySelector('#profile-fetched span')?.textContent).toBe('3 hours ago');
	});

	it('shows "1 day ago" at exactly 24 hours ago', () => {
		localStorage.setItem('profile.dataFetchedAt', (Date.now() - 86_400_000).toString());
		(globalThis as any).updateProfileAge();
		expect(document.querySelector('#profile-fetched span')?.textContent).toBe('1 day ago');
	});

	it('shows plural "days" at 2 days ago', () => {
		localStorage.setItem('profile.dataFetchedAt', (Date.now() - (2 * 86_400_000)).toString());
		(globalThis as any).updateProfileAge();
		expect(document.querySelector('#profile-fetched span')?.textContent).toBe('2 days ago');
	});

	it('reveals #profile-fetched element', () => {
		localStorage.setItem('profile.dataFetchedAt', (Date.now() - 60_000).toString());
		(globalThis as any).updateProfileAge();
		expect(document.querySelector('#profile-fetched')?.classList.contains('d-none')).toBe(false);
	});

	it('sets cursor:help and underline-dotted style on the time span', () => {
		localStorage.setItem('profile.dataFetchedAt', (Date.now() - 60_000).toString());
		(globalThis as any).updateProfileAge();
		const span = document.querySelector<HTMLSpanElement>('#profile-fetched span')!;
		expect(span.style.cursor).toBe('help');
		expect(span.style.textDecoration).toBe('underline dotted');
	});
});

// ─── cloudSyncEvent / initialProfilePromise globals ──────────────────────────

describe('module-level globals', () => {
	it('exposes cloudSyncEvent as a Promise on globalThis', async () => {
		await freshWorkflow();
		expect((globalThis as any).cloudSyncEvent).toBeInstanceOf(Promise);
	});

	it('exposes initialProfilePromise as a Promise on globalThis', async () => {
		await freshWorkflow();
		expect((globalThis as any).initialProfilePromise).toBeInstanceOf(Promise);
	});

	it('cloudSyncEvent resolves to "complete" when cloud-sync-complete fires', async () => {
		await freshWorkflow();
		const promise = (globalThis as any).cloudSyncEvent as Promise<string>;
		globalThis.dispatchEvent(new CustomEvent('cloud-sync-complete'));
		expect(await promise).toBe('complete');
	});

	it('cloudSyncEvent resolves to "unauthenticated" when that event fires', async () => {
		await freshWorkflow();
		const promise = (globalThis as any).cloudSyncEvent as Promise<string>;
		globalThis.dispatchEvent(new CustomEvent('cloud-sync-unauthenticated'));
		expect(await promise).toBe('unauthenticated');
	});

	it('initialProfilePromise resolves from localStorage when profile.data is set', async () => {
		localStorage.setItem('profile.data', JSON.stringify(MOCK_PROFILE_DATA));
		await freshWorkflow();
		globalThis.dispatchEvent(new CustomEvent('cloud-sync-complete'));
		const data = await (globalThis as any).initialProfilePromise;
		expect(data).toEqual(MOCK_PROFILE_DATA);
	});

	it('initialProfilePromise fetches the fallback demo profile when localStorage is empty', async () => {
		localStorage.removeItem('profile.data'); // Clear the default populated in beforeEach
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => MOCK_PROFILE_DATA,
		} as Response);
		await freshWorkflow();
		globalThis.dispatchEvent(new CustomEvent('cloud-sync-complete'));
		await (globalThis as any).initialProfilePromise;
		expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('[DE]Rebecca'));
	});
});
