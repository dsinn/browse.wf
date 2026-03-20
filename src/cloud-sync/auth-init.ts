/**
 * Cloud sync authentication initialization
 *
 * This module initializes the auth system on page load and sets up the UI.
 * Import this file in pages that need cloud sync functionality.
 */

import {AuthService} from './auth.js';
import {StorageSyncService} from './storage-sync.js';
import {db, isDatabaseConfigured} from './database.js';
import {registerSyncHandler} from './trigger.js';

// Initialize auth on page load
async function initializeAuth() {
	if (!isDatabaseConfigured()) {
		globalThis.dispatchEvent(new CustomEvent('cloud-sync-unavailable'));
		return;
	}

	const authService = AuthService.getInstance();
	await authService.initialize();

	// Update UI based on auth state
	updateAuthUI(authService.isAuthenticated(), authService.getCurrentUser());

	if (!authService.isAuthenticated()) {
		globalThis.dispatchEvent(new CustomEvent('cloud-sync-unauthenticated'));
	}

	// Clean up OAuth-related hashes from URL after redirect
	const {hash} = globalThis.location;
	if (hash && (hash.includes('access_token') || hash.includes('refresh_token') || hash === '#')) {
		// Check if we saved a legitimate hash before OAuth redirect
		const savedHash = sessionStorage.getItem('pre_auth_hash');
		sessionStorage.removeItem('pre_auth_hash');

		// Restore the original hash, or clean URL if there wasn't one
		const cleanUrl = globalThis.location.pathname + globalThis.location.search + (savedHash || '');
		history.replaceState(null, '', cleanUrl);
	}
}

// Call immediately or wait for DOMContentLoaded (module scripts are deferred, so DOM is usually already loaded)
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () => {
		void initializeAuth();
	});
} else {
	// eslint-disable-next-line unicorn/prefer-top-level-await
	void initializeAuth();
}

// Listen for auth state changes (e.g., after sign out)
globalThis.addEventListener('auth-state-changed', () => {
	const authService = AuthService.getInstance();
	updateAuthUI(authService.isAuthenticated(), authService.getCurrentUser());
});

// Flush pending changes before tab closes
window.addEventListener('beforeunload', () => {
	void StorageSyncService.getInstance().flushPendingChanges();
});

function updateAuthUI(isAuthenticated: boolean, user: any) {
	const authButton = document.querySelector<HTMLElement>('#auth-button');
	if (!authButton) {
		return;
	}

	// Hide auth button if database not configured
	if (!isDatabaseConfigured()) {
		authButton.style.display = 'none';
		return;
	}

	if (isAuthenticated) {
		// Show authenticated user with avatar only (no username text)
		const avatarUrl = user.user_metadata?.avatar_url || generateGenericAvatar();
		authButton.innerHTML = `
			<div class="dropdown">
				<button class="btn p-0 border-0" type="button" id="userDropdown" data-bs-toggle="dropdown" aria-expanded="false" style="background: none; text-decoration: none;">
					<img src="${avatarUrl}" class="rounded-circle" width="32" height="32" alt="User avatar">
				</button>
				<ul class="dropdown-menu dropdown-menu-end" aria-labelledby="userDropdown">
					<li><a class="dropdown-item" href="#" id="signout-link">Sign out</a></li>
				</ul>
			</div>
		`;

		// Add sign out handler
		const signoutLink = document.querySelector('#signout-link');
		if (signoutLink) {
			signoutLink.addEventListener('click', event => {
				event.preventDefault();
				void AuthService.getInstance().signOut().then(() => {
					showToast('Signed out successfully');
				});
			});
		}
	} else {
		// Show anonymous user with generic avatar and sign-in dropdown
		const genericAvatar = generateGenericAvatar();
		authButton.innerHTML = `
			<div class="dropdown">
				<button class="btn p-0 border-0" type="button" id="anonDropdown" data-bs-toggle="dropdown" aria-expanded="false" style="background: none; text-decoration: none;">
					<img src="${genericAvatar}" class="rounded-circle" width="32" height="32" alt="Anonymous user">
				</button>
				<ul class="dropdown-menu dropdown-menu-end" aria-labelledby="anonDropdown">
					<li><a class="dropdown-item" href="#" id="signin-link">Sign in with Discord</a></li>
				</ul>
			</div>
		`;

		// Add sign in handler
		const signinLink = document.querySelector('#signin-link');
		if (signinLink) {
			signinLink.addEventListener('click', event => {
				event.preventDefault();
				void AuthService.getInstance().signInWithDiscord();
			});
		}
	}
}

/**
 * Generate a generic avatar using a data URI
 * Creates a simple gray circle with a white user icon
 */
function generateGenericAvatar(): string {
	// SVG of a simple user icon in a circle
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
		<circle cx="16" cy="16" r="16" fill="#6c757d"/>
		<path d="M16 16c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="#fff"/>
	</svg>`;
	// eslint-disable-next-line no-restricted-globals
	return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Show a Bootstrap toast notification
 */
function showToast(message: string): void {
	const toast = document.createElement('div');
	toast.className = 'toast align-items-center text-bg-primary border-0';
	toast.setAttribute('role', 'alert');
	toast.setAttribute('aria-live', 'assertive');
	toast.setAttribute('aria-atomic', 'true');

	const div = document.createElement('div');
	div.className = 'd-flex';

	const body = document.createElement('div');
	body.className = 'toast-body';
	body.textContent = message;

	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'btn-close btn-close-white me-2 m-auto';
	button.dataset.bsDismiss = 'toast';
	button.setAttribute('aria-label', 'Close');

	div.append(body);
	div.append(button);
	toast.append(div);

	let container = document.querySelector('#toast-container');
	if (!container) {
		container = document.createElement('div');
		container.id = 'toast-container';
		container.className = 'toast-container position-fixed top-0 end-0 p-3';
		document.body.append(container);
	}

	container.append(toast);

	if (globalThis.bootstrap) {
		const bsToast = new globalThis.bootstrap.Toast(toast);
		bsToast.show();
		toast.addEventListener('hidden.bs.toast', () => {
			toast.remove();
		});
	}
}

// Wire triggerCloudSync (exported by trigger.ts, also exposed globally there) to the real handler
registerSyncHandler(() => {
	const userId = AuthService.getInstance().getUserId();
	if (userId) {
		const syncService = StorageSyncService.getInstance();
		(syncService as any).debouncedPush(userId);
	}
});

/**
 * Get the current Supabase access token for use by non-module scripts (e.g. warframe-api-proxy-client.ts)
 */
(globalThis as any).__getSupabaseAccessToken = async () => {
	if (!isDatabaseConfigured()) {
		return null;
	}

	const {data} = await db.auth.getSession();
	return data.session?.access_token ?? null;
};
