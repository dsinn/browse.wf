/**
 * Cloud sync authentication initialization
 *
 * This module initializes the auth system on page load and sets up the UI.
 * Import this file in pages that need cloud sync functionality.
 */

import { AuthService } from './auth.js'
import { StorageSyncService } from './storage-sync.js'
import { isDatabaseConfigured } from './database.js'

// Initialize auth on page load
document.addEventListener('DOMContentLoaded', async () => {
	const authService = AuthService.getInstance()
	await authService.initialize()

	// Update UI based on auth state
	updateAuthUI(authService.isAuthenticated(), authService.getCurrentUser())

	// Clean up OAuth-related hashes from URL after redirect
	const hash = window.location.hash
	if (hash && (hash.includes('access_token') || hash.includes('refresh_token') || hash === '#')) {
		// Check if we saved a legitimate hash before OAuth redirect
		const savedHash = sessionStorage.getItem('pre_auth_hash')
		sessionStorage.removeItem('pre_auth_hash')

		// Restore the original hash, or clean URL if there wasn't one
		const cleanUrl = window.location.pathname + window.location.search + (savedHash || '')
		history.replaceState(null, '', cleanUrl)
	}
})

// Listen for auth state changes (e.g., after sign out)
window.addEventListener('auth-state-changed', () => {
	const authService = AuthService.getInstance()
	updateAuthUI(authService.isAuthenticated(), authService.getCurrentUser())
})

// Flush pending changes before tab closes
window.addEventListener('beforeunload', async (event) => {
	const syncService = StorageSyncService.getInstance()
	await syncService.flushPendingChanges()
})

function updateAuthUI(isAuthenticated: boolean, user: any) {
	const authButton = document.getElementById('auth-button')
	if (!authButton) return

	// Hide auth button if database not configured
	if (!isDatabaseConfigured()) {
		authButton.style.display = 'none'
		return
	}

	if (isAuthenticated) {
		// Show authenticated user with avatar only (no username text)
		const avatarUrl = user.user_metadata?.avatar_url || generateGenericAvatar()
		authButton.innerHTML = `
			<div class="dropdown">
				<button class="btn p-0 border-0" type="button" id="userDropdown" data-bs-toggle="dropdown" aria-expanded="false" style="background: none; text-decoration: none;">
					<img src="${avatarUrl}" class="rounded-circle" width="32" height="32" alt="User avatar">
				</button>
				<ul class="dropdown-menu dropdown-menu-end" aria-labelledby="userDropdown">
					<li><a class="dropdown-item" href="#" id="signout-link">Sign out</a></li>
				</ul>
			</div>
		`

		// Add sign out handler
		const signoutLink = document.getElementById('signout-link')
		if (signoutLink) {
			signoutLink.addEventListener('click', async (e) => {
				e.preventDefault()
				await AuthService.getInstance().signOut()
				showToast('Signed out successfully')
			})
		}
	} else {
		// Show anonymous user with generic avatar and sign-in dropdown
		const genericAvatar = generateGenericAvatar()
		authButton.innerHTML = `
			<div class="dropdown">
				<button class="btn p-0 border-0" type="button" id="anonDropdown" data-bs-toggle="dropdown" aria-expanded="false" style="background: none; text-decoration: none;">
					<img src="${genericAvatar}" class="rounded-circle" width="32" height="32" alt="Anonymous user">
				</button>
				<ul class="dropdown-menu dropdown-menu-end" aria-labelledby="anonDropdown">
					<li><a class="dropdown-item" href="#" id="signin-link">Sign in with Discord</a></li>
				</ul>
			</div>
		`

		// Add sign in handler
		const signinLink = document.getElementById('signin-link')
		if (signinLink) {
			signinLink.addEventListener('click', (e) => {
				e.preventDefault()
				AuthService.getInstance().signInWithDiscord()
			})
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
	</svg>`
	return `data:image/svg+xml;base64,${btoa(svg)}`
}

/**
 * Show a Bootstrap toast notification
 */
function showToast(message: string): void {
	const toast = document.createElement('div')
	toast.className = 'toast align-items-center text-bg-primary border-0'
	toast.setAttribute('role', 'alert')
	toast.setAttribute('aria-live', 'assertive')
	toast.setAttribute('aria-atomic', 'true')

	const div = document.createElement('div')
	div.className = 'd-flex'

	const body = document.createElement('div')
	body.className = 'toast-body'
	body.textContent = message

	const button = document.createElement('button')
	button.type = 'button'
	button.className = 'btn-close btn-close-white me-2 m-auto'
	button.setAttribute('data-bs-dismiss', 'toast')
	button.setAttribute('aria-label', 'Close')

	div.appendChild(body)
	div.appendChild(button)
	toast.appendChild(div)

	let container = document.getElementById('toast-container')
	if (!container) {
		container = document.createElement('div')
		container.id = 'toast-container'
		container.className = 'toast-container position-fixed top-0 end-0 p-3'
		document.body.appendChild(container)
	}
	container.appendChild(toast)

	if (window.bootstrap) {
		const bsToast = new window.bootstrap.Toast(toast)
		bsToast.show()
		toast.addEventListener('hidden.bs.toast', () => toast.remove())
	}
}

/**
 * Trigger cloud sync after localStorage changes
 * This is exposed globally so non-module code can trigger syncs
 */
function triggerCloudSync() {
	const userId = AuthService.getInstance().getUserId()
	if (userId) {
		// Trigger debounced push
		const syncService = StorageSyncService.getInstance()
		;(syncService as any).debouncedPush(userId)
	}
}

// Expose globally for non-module code
;(window as any).triggerCloudSync = triggerCloudSync
