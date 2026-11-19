/**
 Fork-specific profile workflow: step indicators, cloud-sync gating,
 rate-limit handling, and localStorage persistence.

 Exposes cloudSyncEvent and loadInitialProfile on globalThis so that
 the non-module profile.ts script can include them in its Promise.all.
 Also exposes all onclick handlers and profileWorkflowReady/updateProfileAge.
 */

/* eslint-disable no-alert -- `alert()` is used intentionally for user-facing error messages */
import {MILLIS_PER_DAY, MILLIS_PER_HOUR} from '../helpers/time-helpers.js';
import {WarframeApiFrontProxyClient} from '../warframe-api-proxy-client.js';
import {waitForCloudSync} from '../cloud-sync/trigger.js';
import {PROFILE_TIMESTAMP_STORAGE_KEY} from './profile-freshness.js';

// Keep in sync with VALID_PLAYER_ID_REGEX in warframe-api-front-proxy/profile.js
const VALID_PLAYER_ID_REGEX = /^[\da-f]{24}$/u;

const PLATFORM_STORAGE_KEY = 'profile.platform';
const ACCOUNT_ID_STORAGE_KEY = 'profile.accountId';
const PROFILE_DATA_STORAGE_KEY = 'profile.data';
const NEXT_FETCH_AVAILABLE_AT_STORAGE_KEY = 'profile.nextFetchAvailableAt';

const platformSelect = document.querySelector<HTMLSelectElement>('#platform-select')!;

let currentAccountId = '';

// Wait for cloud sync to emit one of its events (or timeout)
const cloudSyncEvent = waitForCloudSync();

// Expose the promise so profile.ts can include it in its Promise.all
window.cloudSyncEvent = cloudSyncEvent;

/**
 Called by profile.ts as the profile page initializes. Resolves to the cached profile (once cloud sync has had a
 chance to restore it), or to the demo profile when nothing is cached.
 */
async function loadInitialProfile(): Promise<unknown> {
	await cloudSyncEvent;
	const profileJson = localStorage.getItem(PROFILE_DATA_STORAGE_KEY);
	if (profileJson) {
		return JSON.parse(profileJson);
	}

	const response = await fetch('supplemental-data/profile-[DE]Rebecca.json');
	return response.json();
}

let wasProfileLoadedManually = false;

function updateStepStatus(selector: string, isCompleted: boolean): void {
	document.querySelector(selector)?.classList.toggle('complete', isCompleted);
}

function refreshAllStepIndicators(): void {
	updateStepStatus('#step1-container', Boolean(platformSelect.value));
	// Step 2 (account ID) and beyond are updated by their respective handlers
}

function onPlatformChange(): void {
	wasProfileLoadedManually = false;
	updateStepStatus('#step1-container', Boolean(platformSelect.value));
}

function isValidAccountId(accountId: string): boolean {
	return VALID_PLAYER_ID_REGEX.test(accountId);
}

function updateRefreshAlert(): void {
	document.querySelector('#refresh-alert')?.classList.toggle('d-none', !currentAccountId);
}

function showRateLimitNotice(expiryMs: number): void {
	const countdown = document.querySelector('#rate-limit-countdown');
	if (countdown) {
		countdown.replaceChildren(window.createShortTimerBadge!(Math.floor(expiryMs / 1000), 'Pending Refresh'));
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
	if (!downloadLink || !platformSelect.value || !isValidAccountId(accountId)) {
		return;
	}

	const platformSuffix = platformSelect.value === 'pc' ? '' : `-${platformSelect.value}`;
	downloadLink.href = `https://api${platformSuffix}.warframe.com/cdn/getProfileViewingData.php?playerId=${encodeURIComponent(accountId)}`;
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

	const fetchDate = new Date(Number(fetchedAt));
	const diffMs = Date.now() - fetchDate.getTime();
	const diffMins = Math.floor(diffMs / 60_000);
	const diffHours = Math.floor(diffMs / MILLIS_PER_HOUR);
	const diffDays = Math.floor(diffMs / MILLIS_PER_DAY);

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
		nextUpdateMs = MILLIS_PER_HOUR - (diffMs % MILLIS_PER_HOUR);
	} else {
		timeAgo = `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
		nextUpdateMs = MILLIS_PER_DAY - (diffMs % MILLIS_PER_DAY);
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

function fetchAndRenderProfile(platform: string, accountId: string): void {
	const parameters = window.__profileParams!;
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

		window.profile = data;
		// Saved before rendering, since the render uses it to decide whether daily values are still current
		localStorage.setItem(PROFILE_TIMESTAMP_STORAGE_KEY, Date.now().toString());
		document.querySelector('#profile-nav')?.classList.remove('d-none');
		window.activateTab!(parameters.has('tab') ? parameters.get('tab')! : 'fashion');
		if (!parameters.has('tab')) {
			location.hash = 'tab=fashion';
		}

		window.renderProfile!();
		document.querySelector('#profile-name')?.scrollIntoView({behavior: 'smooth'});

		wasProfileLoadedManually = true;
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
		updateProfileAge();

		window.triggerCloudSync?.();

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

async function loadProfile(file?: File): Promise<void> {
	if (!file) {
		return;
	}

	const parameters = window.__profileParams!;

	try {
		const data = JSON.parse(await file.text());
		window.profile = data;
		// The file's age is when it was downloaded, which can be well before it is loaded here. Saved before
		// rendering, since the render uses it to decide whether daily values are still current.
		localStorage.setItem(PROFILE_TIMESTAMP_STORAGE_KEY, (file.lastModified || Date.now()).toString());
		document.querySelector('#profile-nav')?.classList.remove('d-none');
		window.activateTab!(parameters.has('tab') ? parameters.get('tab')! : 'fashion');
		window.renderProfile!();
		document.querySelector('#profile-name')?.scrollIntoView({behavior: 'smooth'});

		wasProfileLoadedManually = true;
		updateStepStatus('#step4-container', true);
		localStorage.setItem(PLATFORM_STORAGE_KEY, platformSelect.value);
		localStorage.setItem(PROFILE_DATA_STORAGE_KEY, JSON.stringify(data));
		updateProfileAge();

		window.triggerCloudSync?.();
	} catch (error) {
		console.error(error);
		alert('Failed to parse profile file: ' + (error as Error).message);
	}
}

let hasInvalidCharsMinTimeElapsed = false;
let invalidCharsHideTimer: ReturnType<typeof setTimeout> | undefined;

function onAccountIdManualInput(): void {
	const input = document.querySelector<HTMLInputElement>('#account-id');
	if (!input) {
		return;
	}

	const raw = input.value;
	const cleaned = raw.toLowerCase().replaceAll(/[^\da-f]/gu, '');
	const hasInvalidChars = cleaned.length !== raw.length;
	if (cleaned !== raw) {
		const selectionStart = input.selectionStart ?? cleaned.length;
		const removed = raw.length - cleaned.length;
		input.value = cleaned;
		input.setSelectionRange(Math.max(0, selectionStart - removed), Math.max(0, selectionStart - removed));
	}

	const notice = document.querySelector('#account-id-invalid-chars');
	if (hasInvalidChars) {
		hasInvalidCharsMinTimeElapsed = false;
		notice?.classList.remove('d-none');
		clearTimeout(invalidCharsHideTimer);
		invalidCharsHideTimer = setTimeout(() => {
			hasInvalidCharsMinTimeElapsed = true;
			invalidCharsHideTimer = undefined;
		}, 3000);
	} else if (hasInvalidCharsMinTimeElapsed && notice) {
		notice.classList.add('d-none');
		hasInvalidCharsMinTimeElapsed = false;
	}

	const accountId = cleaned.trim();
	const charCount = document.querySelector('#account-id-char-count');
	if (charCount) {
		charCount.textContent = accountId.length.toString();
	}

	const feedback = document.querySelector('#account-id-feedback');
	if (isValidAccountId(accountId)) {
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
	fetchAndRenderProfile(platformSelect.value, currentAccountId);
}

function updateFormFromLocalStorage(): void {
	const savedPlatform = localStorage.getItem(PLATFORM_STORAGE_KEY);
	const savedAccountId = localStorage.getItem(ACCOUNT_ID_STORAGE_KEY);

	if (savedPlatform) {
		platformSelect.value = savedPlatform;
	}

	if (!savedAccountId || !isValidAccountId(savedAccountId)) {
		return;
	}

	currentAccountId = savedAccountId;
	const accountIdInput = document.querySelector<HTMLInputElement>('#account-id');
	if (accountIdInput) {
		accountIdInput.value = savedAccountId;
	}

	updateStepStatus('#step2-container', true);
	updateDownloadLink();
	updateRefreshAlert();
}

/**
 Called from profile.ts Promise.all callback after exports are loaded.
 Handles rate-limit check, step UI reveal, and form restoration.
 */
function profileWorkflowReady(syncResult: string, shouldShowAutoFetchFlow: boolean): void {
	const stepsElement = document.querySelector('#steps');
	stepsElement?.classList.remove('d-none');
	stepsElement?.classList.toggle('manual-flow', !shouldShowAutoFetchFlow);

	const storedNextFetch = Number(localStorage.getItem(NEXT_FETCH_AVAILABLE_AT_STORAGE_KEY) ?? '0');
	if (syncResult === 'complete' && storedNextFetch > Date.now()) {
		showRateLimitNotice(storedNextFetch);
	}

	window.__showAutoFetchFlow = shouldShowAutoFetchFlow;

	wasProfileLoadedManually = false;

	updateFormFromLocalStorage();
	refreshAllStepIndicators();

	if (platformSelect.value) {
		onPlatformChange();
	}
}

window.fetchProfile = fetchProfile;
window.loadInitialProfile = loadInitialProfile;
window.loadProfile = loadProfile;
window.onAccountIdManualInput = onAccountIdManualInput;
window.onDownloadLinkLeftClick = onDownloadLinkLeftClick;
window.onDownloadLinkRightClick = onDownloadLinkRightClick;
window.onPlatformChange = onPlatformChange;
window.profileWorkflowReady = profileWorkflowReady;
window.updateProfileAge = updateProfileAge;
