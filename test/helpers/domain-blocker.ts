/**
 * Domain blocking utilities to prevent tests from hitting production browse.wf
 *
 * This module provides safeguards to ensure tests never accidentally hit the
 * production oracle.browse.wf domain or other browse.wf subdomains.
 *
 * Rules:
 * - Image files (.png, .jpg, .webp): silently do nothing
 * - All other requests (especially fetch): throw an error
 */

const BLOCKED_DOMAINS = [
  'browse.wf',
  'oracle.browse.wf',
  'www.browse.wf',
];

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];

/**
 * Checks if a URL points to a blocked domain
 */
export function isBlockedDomain(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return BLOCKED_DOMAINS.some(domain =>
      urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
    );
  } catch {
    // Invalid URL, not blocked
    return false;
  }
}

/**
 * Checks if a URL points to an image file
 */
export function isImageRequest(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    return IMAGE_EXTENSIONS.some(ext => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

/**
 * Validates a request URL and throws if it's an unauthorized production request
 *
 * @param url - The URL being requested
 * @throws Error if the URL points to a blocked domain (non-image)
 */
export function validateTestRequest(url: string): void {
  if (!isBlockedDomain(url)) {
    return; // Not a blocked domain, allow
  }

  if (isImageRequest(url)) {
    // Image requests to blocked domains are silently ignored
    return;
  }

  // Non-image request to blocked domain - this is an error
  throw new Error(
    `TEST SAFEGUARD: Attempted to fetch from production domain: ${url}\n` +
    `Tests must never hit browse.wf domains. Use mocked data instead.\n` +
    `Check test/helpers/api-mocks.ts for proper mocking.`
  );
}
