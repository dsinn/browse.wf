/**
 * Fork-specific profile workflow: step indicators, EE.log parsing,
 * cloud-sync gating, rate-limit handling, and localStorage persistence.
 *
 * Exposes cloudSyncEvent and initialProfilePromise on globalThis so that
 * the non-module profile.ts script can include them in its Promise.all.
 * Also exposes all onclick handlers and profileWorkflowReady/updateProfileAge.
 */

// `alert()` is used intentionally for user-facing error messages
/* eslint-disable no-alert */
import {WarframeApiFrontProxyClient} from '../warframe-api-proxy-client.js';

// Keep in sync with VALID_PLAYER_ID_REGEX in warframe-api-front-proxy/profile.js
const VALID_PLAYER_ID_REGEX = /^[\da-f]{24}$/u;

const PLATFORM_STORAGE_KEY = 'profile.platform';
const ACCOUNT_ID_STORAGE_KEY = 'profile.accountId';
const PROFILE_DATA_STORAGE_KEY = 'profile.data';
const PROFILE_TIMESTAMP_STORAGE_KEY = 'profile.dataFetchedAt';
const NEXT_FETCH_AVAILABLE_AT_STORAGE_KEY = 'profile.nextFetchAvailableAt';

const platformSelect = document.querySelector<HTMLSelectElement>('#platform-select')!;

let currentAccountId = '';

// Wait for cloud sync to emit one of its events (or timeout)
const cloudSyncEvent = new Promise<string>(resolve => {
	for (const type of ['cloud-sync-complete', 'cloud-sync-unavailable', 'cloud-sync-unauthenticated', 'cloud-sync-error']) {
		globalThis.addEventListener(type, () => {
			resolve(type.replace('cloud-sync-', ''));
		}, {once: true});
	}

	setTimeout(() => {
		resolve('timeout');
	}, 3000);
});

// Get initial profile (from localStorage or fallback).
// `.then()` is used instead of `await` because this is a non-module script — top-level await is unavailable.
const initialProfilePromise = cloudSyncEvent.then(async () => { // eslint-disable-line unicorn/prefer-top-level-await
	const profileJson = localStorage.getItem(PROFILE_DATA_STORAGE_KEY);
	if (profileJson) {
		return JSON.parse(profileJson);
	}

	return fetch('supplemental-data/profile-[DE]Rebecca.json').then(async response => response.json());
});

// Expose promises so profile.ts can include them in its Promise.all
(globalThis as any).cloudSyncEvent = cloudSyncEvent;
(globalThis as any).initialProfilePromise = initialProfilePromise;

let profileLoadedManually = false;

function updateStepStatus(selector: string, completed: boolean): void {
	document.querySelector(selector)?.classList.toggle('complete', completed);
}

function refreshAllStepIndicators(): void {
	updateStepStatus('#step1-container', Boolean(platformSelect.value));
	// Step 2 (account ID) and beyond are updated by their respective handlers
}

function copyWarframePath(event: Event): void {
	navigator.clipboard.writeText('%localappdata%\\Warframe\\').then(() => {
		const button = event.target as HTMLButtonElement;
		const originalText = button.textContent;
		button.textContent = 'Copied!';
		setTimeout(() => {
			button.textContent = originalText;
		}, 5000);
	}).catch((error: unknown) => {
		console.error('Failed to copy:', error);
		alert('Failed to copy to clipboard');
	});
}

function onPlatformChange(): void {
	profileLoadedManually = false;
	updateStepStatus('#step1-container', Boolean(platformSelect.value));
}

function validateAccountId(accountId: string): boolean {
	return VALID_PLAYER_ID_REGEX.test(accountId);
}

function updateRefreshAlert(): void {
	document.querySelector('#refresh-alert')?.classList.toggle('d-none', !currentAccountId);
}

function showRateLimitNotice(epochMs: number): void {
	const countdown = document.querySelector('#rate-limit-countdown');
	if (countdown) {
		countdown.replaceChildren((globalThis as any).createShortTimerBadge(Math.floor(epochMs / 1000), 'Pending Refresh'));
	}

	document.querySelector('#rate-limit-notice')?.classList.remove('d-none');
}

function showStatusError(message: string): void {
	const statusElement = document.querySelector('#status');
	const spanElement = document.querySelector('#status span');
	if (spanElement) {
		spanElement.textContent = message;
	}

	statusElement?.classList.remove('d-none');
	setTimeout(() => {
		statusElement?.classList.add('d-none');
	}, 5000);
}

function updateDownloadLink(): void {
	const accountId = document.querySelector<HTMLInputElement>('#account-id')?.value ?? '';
	const downloadLink = document.querySelector<HTMLAnchorElement>('#download-link');
	if (downloadLink && platformSelect.value && validateAccountId(accountId)) {
		const platformSuffix = platformSelect.value === 'pc' ? '' : `-${platformSelect.value}`;
		downloadLink.href = `http://content${platformSuffix}.warframe.com/dynamic/getProfileViewingData.php?playerId=${encodeURIComponent(accountId)}`;
	}
}

function switchToManualFlow(message: string): void {
	document.querySelector('#steps')?.classList.add('manual-flow');
	updateDownloadLink();
	showStatusError(message);
}

let profileAgeUpdateTimer: ReturnType<typeof setTimeout> | undefined;

function updateProfileAge(): void {
	const fetchedAt = localStorage.getItem(PROFILE_TIMESTAMP_STORAGE_KEY);
	if (!fetchedAt) {
		return;
	}

	const fetchDate = new Date(Number.parseInt(fetchedAt, 10));
	const diffMs = Date.now() - fetchDate.getTime();
	const diffMins = Math.floor(diffMs / 60_000);
	const diffHours = Math.floor(diffMs / 3_600_000);
	const diffDays = Math.floor(diffMs / 86_400_000);

	let timeAgo: string;
	let nextUpdateMs: number;

	if (diffMins < 1) {
		timeAgo = 'just now';
		nextUpdateMs = 60_000 - (diffMs % 60_000);
	} else if (diffMins < 60) {
		timeAgo = `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
		nextUpdateMs = 60_000 - (diffMs % 60_000);
	} else if (diffHours < 24) {
		timeAgo = `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
		nextUpdateMs = 3_600_000 - (diffMs % 3_600_000);
	} else {
		timeAgo = `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
		nextUpdateMs = 86_400_000 - (diffMs % 86_400_000);
	}

	const absoluteTime = fetchDate.toLocaleString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	});

	const timeSpan = document.querySelector<HTMLSpanElement>('#profile-fetched span');
	if (timeSpan) {
		timeSpan.textContent = timeAgo;
		timeSpan.title = absoluteTime;
		timeSpan.style.cursor = 'help';
		timeSpan.style.textDecoration = 'underline dotted';
	}

	document.querySelector('#profile-fetched')?.classList.remove('d-none');

	clearTimeout(profileAgeUpdateTimer);
	profileAgeUpdateTimer = setTimeout(() => {
		updateProfileAge();
	}, nextUpdateMs);
}

function fetchAndRenderProfile(platform: string, accountId: string, fromEeLog: boolean): void {
	const parameters = (globalThis as any).__profileParams as URLSearchParams;
	const statusElement = document.querySelector('#status');
	const statusSpan = document.querySelector('#status span');
	if (statusSpan) {
		statusSpan.textContent = 'Fetching profile...';
	}

	statusElement?.classList.remove('d-none');

	const accountIdInput = document.querySelector<HTMLInputElement>('#account-id');
	if (accountIdInput) {
		accountIdInput.value = accountId;
	}

	void WarframeApiFrontProxyClient.fetchProfile(platform, accountId).then(({status, data, nextFetchAvailableAt}: {status: number; data: any; nextFetchAvailableAt: number | undefined}) => {
		if (status === 429) {
			if (nextFetchAvailableAt) {
				localStorage.setItem(NEXT_FETCH_AVAILABLE_AT_STORAGE_KEY, nextFetchAvailableAt.toString());
				showRateLimitNotice(nextFetchAvailableAt);
			}

			updateStepStatus('#step2-container', true);
			updateDownloadLink();
			document.querySelector('#steps')?.classList.add('manual-flow');
			statusElement?.classList.add('d-none');
			return;
		}

		if (status === 401) {
			switchToManualFlow('Sign-in session expired. Please log in again.');
			return;
		}

		if (!data) {
			showStatusError('Failed to fetch profile. Try downloading manually.');
			return;
		}

		if (nextFetchAvailableAt) {
			localStorage.setItem(NEXT_FETCH_AVAILABLE_AT_STORAGE_KEY, nextFetchAvailableAt.toString());
		}

		(globalThis as any).profile = data;
		if (fromEeLog) {
			document.querySelector('#profile-nav')?.classList.remove('d-none');
			(globalThis as any).activateTab(parameters.has('tab') ? parameters.get('tab') : 'fashion');
			if (!parameters.has('tab')) {
				location.hash = 'tab=fashion';
			}
		}

		(globalThis as any).renderProfile();

		profileLoadedManually = true;
		updateStepStatus('#step2-container', true);
		updateStepStatus('#step3-auto-container', true);
		const step3Btn = document.querySelector<HTMLButtonElement>('#step3-auto-container button');
		if (step3Btn) {
			step3Btn.disabled = true;
		}

		updateDownloadLink();
		localStorage.setItem(PLATFORM_STORAGE_KEY, platform);
		localStorage.setItem(ACCOUNT_ID_STORAGE_KEY, accountId);
		localStorage.setItem(PROFILE_DATA_STORAGE_KEY, JSON.stringify(data));
		localStorage.setItem(PROFILE_TIMESTAMP_STORAGE_KEY, Date.now().toString());
		updateProfileAge();

		(globalThis as any).triggerCloudSync?.();

		document.querySelector('#refresh-alert')?.classList.add('d-none');
		statusElement?.classList.add('d-none');
	}).catch((error: unknown) => {
		console.error(error);
		if (statusSpan) {
			statusSpan.textContent = 'Failed to fetch profile. Try downloading manually.';
		}

		setTimeout(() => {
			statusElement?.classList.add('d-none');
		}, 5000);
	});
}

async function loadEeLog(file?: File): Promise<void> {
	if (!file) {
		return;
	}

	profileLoadedManually = false;

	const statusElement = document.querySelector('#status');
	const statusSpan = document.querySelector('#status span');
	if (statusSpan) {
		statusSpan.textContent = 'Parsing EE.log...';
	}

	statusElement?.classList.remove('d-none');

	try {
		const content = await file.text();
		const logPattern = /(?:Logged|Player).*\b([\da-f]{24})\b/u;
		const match = logPattern.exec(content);

		if (match) {
			const accountId = match[1];
			currentAccountId = accountId;
			localStorage.setItem(ACCOUNT_ID_STORAGE_KEY, accountId);
			updateRefreshAlert();

			if ((globalThis as any).__showAutoFetchFlow) {
				fetchAndRenderProfile(platformSelect.value, accountId, true);
			} else {
				const accountIdInput = document.querySelector<HTMLInputElement>('#account-id');
				if (accountIdInput) {
					accountIdInput.value = accountId;
				}

				updateStepStatus('#step2-container', true);
				updateDownloadLink();
				statusElement?.classList.add('d-none');
			}
		} else {
			alert('Could not find account ID in EE.log. Make sure you\'ve logged in and the file contains a "Logged in" line.');
			statusElement?.classList.add('d-none');
		}
	} catch (error) {
		console.error(error);
		alert('Failed to parse EE.log file: ' + (error as Error).message);
		statusElement?.classList.add('d-none');
	}
}

async function loadProfile(file?: File): Promise<void> {
	const parameters = (globalThis as any).__profileParams as URLSearchParams;

	if (!file) {
		return;
	}

	try {
		const data = JSON.parse(await file.text());
		(globalThis as any).profile = data;
		document.querySelector('#profile-nav')?.classList.remove('d-none');
		(globalThis as any).activateTab(parameters.has('tab') ? parameters.get('tab') : 'fashion');
		(globalThis as any).renderProfile();

		profileLoadedManually = true;
		updateStepStatus('#step4-container', true);
		localStorage.setItem(PLATFORM_STORAGE_KEY, platformSelect.value);
		localStorage.setItem(PROFILE_DATA_STORAGE_KEY, JSON.stringify(data));
		localStorage.setItem(PROFILE_TIMESTAMP_STORAGE_KEY, Date.now().toString());
		updateProfileAge();

		(globalThis as any).triggerCloudSync?.();
	} catch (error) {
		console.error(error);
		alert('Failed to parse profile file: ' + (error as Error).message);
	}
}

let invalidCharsMinTimeElapsed = false;
let invalidCharsHideTimer: ReturnType<typeof setTimeout> | undefined;

function onAccountIdManualInput(): void {
	const input = document.querySelector<HTMLInputElement>('#account-id');
	if (!input) {
		return;
	}

	const raw = input.value;
	const cleaned = raw.toLowerCase().replaceAll(/[^\da-f]/gu, '');
	const hadInvalidChars = cleaned.length !== raw.length;
	if (cleaned !== raw) {
		const selectionStart = input.selectionStart ?? cleaned.length;
		const removed = raw.length - cleaned.length;
		input.value = cleaned;
		input.setSelectionRange(Math.max(0, selectionStart - removed), Math.max(0, selectionStart - removed));
	}

	const notice = document.querySelector('#account-id-invalid-chars');
	if (hadInvalidChars) {
		invalidCharsMinTimeElapsed = false;
		notice?.classList.remove('d-none');
		clearTimeout(invalidCharsHideTimer);
		invalidCharsHideTimer = setTimeout(() => {
			invalidCharsMinTimeElapsed = true;
			invalidCharsHideTimer = undefined;
		}, 3000);
	} else if (invalidCharsMinTimeElapsed && notice) {
		notice.classList.add('d-none');
		invalidCharsMinTimeElapsed = false;
	}

	const accountId = cleaned.trim();
	const charCount = document.querySelector('#account-id-char-count');
	if (charCount) {
		charCount.textContent = accountId.length.toString();
	}

	const feedback = document.querySelector('#account-id-feedback');
	if (validateAccountId(accountId)) {
		input.classList.remove('is-invalid');
		input.classList.add('is-valid');
		if (feedback) {
			feedback.classList.remove('invalid-feedback');
			feedback.classList.add('valid-feedback');
		}

		currentAccountId = accountId;
		localStorage.setItem(ACCOUNT_ID_STORAGE_KEY, accountId);
		updateStepStatus('#step2-container', true);
		updateDownloadLink();
	} else {
		input.classList.remove('is-valid');
		if (feedback) {
			feedback.classList.remove('valid-feedback');
			feedback.classList.add('invalid-feedback');
		}

		updateStepStatus('#step2-container', false);
		input.classList.toggle('is-invalid', accountId.length > 0);
	}
}

function onDownloadLinkLeftClick(event: Event): void {
	event.preventDefault();
	document.querySelector('#download-warning')?.classList.remove('d-none');
}

function onDownloadLinkRightClick(_event: Event): void {
	document.querySelector('#step3-manual-container')?.classList.add('complete');
	document.querySelector('#download-warning')?.classList.add('d-none');
}

function fetchProfile(): void {
	fetchAndRenderProfile(platformSelect.value, currentAccountId, false);
}

function updateFormFromLocalStorage(): void {
	const savedPlatform = localStorage.getItem(PLATFORM_STORAGE_KEY);
	const savedAccountId = localStorage.getItem(ACCOUNT_ID_STORAGE_KEY);

	if (savedPlatform) {
		platformSelect.value = savedPlatform;
	}

	if (savedAccountId && validateAccountId(savedAccountId)) {
		currentAccountId = savedAccountId;
		const accountIdInput = document.querySelector<HTMLInputElement>('#account-id');
		if (accountIdInput) {
			accountIdInput.value = savedAccountId;
		}

		updateStepStatus('#step2-container', true);
		updateDownloadLink();
		updateRefreshAlert();
	}
}

/**
 * Called from profile.ts Promise.all callback after exports are loaded.
 * Handles rate-limit check, step UI reveal, and form restoration.
 */
function profileWorkflowReady(syncResult: string, showAutoFetchFlow: boolean): void {
	const stepsElement = document.querySelector('#steps');
	stepsElement?.classList.remove('d-none');
	stepsElement?.classList.toggle('manual-flow', !showAutoFetchFlow);

	const storedNextFetch = Number.parseInt(localStorage.getItem(NEXT_FETCH_AVAILABLE_AT_STORAGE_KEY) ?? '0', 10);
	if (syncResult === 'complete' && storedNextFetch - Date.now() > 0) {
		showRateLimitNotice(storedNextFetch);
	}

	(globalThis as any).__showAutoFetchFlow = showAutoFetchFlow;

	profileLoadedManually = false;

	updateFormFromLocalStorage();
	refreshAllStepIndicators();

	if (platformSelect.value) {
		onPlatformChange();
	}
}

(globalThis as any).copyWarframePath = copyWarframePath;
(globalThis as any).fetchProfile = fetchProfile;
(globalThis as any).loadEELog = loadEeLog;
(globalThis as any).loadProfile = loadProfile;
(globalThis as any).onAccountIdManualInput = onAccountIdManualInput;
(globalThis as any).onDownloadLinkLeftClick = onDownloadLinkLeftClick;
(globalThis as any).onDownloadLinkRightClick = onDownloadLinkRightClick;
(globalThis as any).onPlatformChange = onPlatformChange;
(globalThis as any).profileWorkflowReady = profileWorkflowReady;
(globalThis as any).updateProfileAge = updateProfileAge;
