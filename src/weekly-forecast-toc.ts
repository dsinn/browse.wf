/**
 Weekly Forecast table of contents — highlights the entry for the section currently being read.

 Bootstrap's scrollspy can't be used here: it never activates the last section when that section
 is too short to reach the top of the viewport, so this does the (small) bookkeeping itself.

 Once started, it also keeps the URL's #fragment on the current section, so a reload (such as the one when the next
 forecast is published) comes back to the same place.
 */

/**
A section counts as "current" once its top edge is within this fraction of the viewport height.
*/
const ACTIVATION_FRACTION = 0.3;

/**
Returns the id of the section to highlight, given each section's top edge relative to the viewport.
*/
export function pickActiveSectionId(
	sections: ReadonlyArray<{id: string; top: number}>,
	viewportHeight: number,
	isAtPageBottom: boolean,
): string | undefined {
	if (sections.length === 0) {
		return undefined;
	}

	if (isAtPageBottom) {
		return sections[sections.length - 1].id;
	}

	let activeId = sections[0].id;
	for (const section of sections) {
		if (section.top <= viewportHeight * ACTIVATION_FRACTION) {
			activeId = section.id;
		}
	}

	return activeId;
}

/**
Returns the URL fragment for the current section, or '' while the reader is above the first section (e.g. reading the
notice at the top of the page), so that a reload there comes back to the top rather than to the first card.

A link to an earlier section is kept, rather than rewritten to a later current one, while the linked section still
starts on screen. That happens when the page can't scroll the linked section all the way up (near the bottom, or on a
tall viewport) and the sections after it are short enough to count as current.
*/
export function pickUrlHash(
	sections: ReadonlyArray<{id: string; top: number}>,
	viewportHeight: number,
	isAtPageBottom: boolean,
	currentHash = '',
): string {
	// 1px of slack for sub-pixel positions after scrolling a section to the top
	const isAboveFirstSection = sections.length === 0 || (!isAtPageBottom && sections[0].top > 1);
	if (isAboveFirstSection) {
		return '';
	}

	const activeId = pickActiveSectionId(sections, viewportHeight, isAtPageBottom)!;
	const linked = sections.findIndex(section => '#' + section.id === currentHash);
	const isLinkedBeforeActive = linked !== -1 && linked < sections.findIndex(section => section.id === activeId);
	const isLinkedStartOnScreen = linked !== -1 && sections[linked].top >= -1 && sections[linked].top < viewportHeight;
	return isLinkedBeforeActive && isLinkedStartOnScreen ? currentHash : '#' + activeId;
}

// How long scrolling must pause before the URL's #fragment is updated
const HASH_SYNC_DELAY_MS = 150;

let isHashSyncEnabled = false; // Start disabled so that after reload, the browser's scroll doesn't fight the update.

/**
Replaces the current history entry's fragment. Unlike assigning location.hash, this neither adds a history entry nor
scrolls.
*/
function replaceUrlHash(hash: string): void {
	if (location.hash === hash) {
		return;
	}

	history.replaceState(history.state, '', hash || location.pathname + location.search);
}

/**
Below the lg breakpoint the entries form a horizontally scrolling strip; keep the current one centred in it.
*/
function centreLinkInStrip(strip: HTMLElement, link: HTMLElement): void {
	if (strip.scrollWidth <= strip.clientWidth) {
		return;
	}

	const stripBox = strip.getBoundingClientRect();
	const linkBox = link.getBoundingClientRect();
	strip.scrollBy({left: (linkBox.left - stripBox.left) - ((stripBox.width - linkBox.width) / 2)});
}

/**
Marks which sides of the (horizontally scrolling) strip have entries hidden beyond the edge, for the CSS fades.
*/
function updateStripFades(strip: HTMLElement): void {
	strip.classList.toggle('has-more-left', strip.scrollLeft > 1);
	strip.classList.toggle('has-more-right', Math.ceil(strip.scrollLeft + strip.clientWidth) < strip.scrollWidth - 1);
}

export function initWeeklyForecastToc(): void {
	const links = [...document.querySelectorAll<HTMLAnchorElement>('#weekly-forecast-toc .nav-link[href^="#"]')];
	const sections = links
		.map(link => document.querySelector<HTMLElement>(link.hash))
		.filter((section): section is HTMLElement => section !== null);
	if (sections.length === 0) {
		return;
	}

	const strip = links[0].closest<HTMLElement>('.nav');
	let shownId: string | undefined;
	let frame = 0;
	let hashTimer: ReturnType<typeof setTimeout> | undefined;
	const measure = () => ({
		sectionTops: sections.map(section => ({id: section.id, top: section.getBoundingClientRect().top})),
		isAtPageBottom: Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 1,
	});

	const syncUrlHash = (): void => {
		if (!isHashSyncEnabled) {
			return;
		}

		const {sectionTops, isAtPageBottom} = measure();
		replaceUrlHash(pickUrlHash(sectionTops, window.innerHeight, isAtPageBottom, location.hash));
	};

	const update = (): void => {
		frame = 0;
		const {sectionTops, isAtPageBottom} = measure();
		const activeId = pickActiveSectionId(sectionTops, window.innerHeight, isAtPageBottom);
		for (const link of links) {
			const isActive = link.hash === '#' + activeId;
			link.classList.toggle('active', isActive);
			if (isActive) {
				link.setAttribute('aria-current', 'location');
			} else {
				link.removeAttribute('aria-current');
			}
		}

		if (strip && activeId !== shownId) {
			shownId = activeId;
			const activeLink = links.find(link => link.hash === '#' + activeId);
			if (activeLink) {
				centreLinkInStrip(strip, activeLink);
			}
		}

		if (strip) {
			updateStripFades(strip);
		}
	};

	const scheduleUpdate = (): void => {
		frame ||= requestAnimationFrame(update);
	};

	window.addEventListener('scroll', () => {
		scheduleUpdate();
		// The fragment moves only once scrolling settles: a smooth scroll to a link would otherwise rewrite it with each
		// section it passes, and layout shifts that don't scroll (e.g. images loading above) never rewrite it
		clearTimeout(hashTimer);
		hashTimer = setTimeout(syncUrlHash, HASH_SYNC_DELAY_MS);
	}, {passive: true});
	strip?.addEventListener('scroll', () => {
		updateStripFades(strip);
	}, {passive: true});
	window.addEventListener('resize', scheduleUpdate);
	// Cards change height as their content loads, which can move the current section without any scrolling
	new ResizeObserver(scheduleUpdate).observe(document.body);
	update();
}

/**
 Starts keeping the URL's #fragment on the current section as the reader scrolls, by replacing the current history
 entry in place. Call once the content is in place (after `scrollToHashedSection`).
 */
export function startSyncingUrlHash(): void {
	isHashSyncEnabled = true;
}

/**
 The cards fill in asynchronously, so the browser's own jump to a `#section` URL fragment can land on the position the
 section had before its content loaded (intermittent in every major engine, most often in Chromium and WebKit).
 Call this once the content is in place to jump again.
 */
export function scrollToHashedSection(): void {
	if (!location.hash) {
		return;
	}

	try {
		document.querySelector('.weekly-forecast-section' + location.hash)?.scrollIntoView({behavior: 'instant'});
	} catch {
		// Not a valid selector (e.g. a malformed fragment), so it can't be one of our sections
	}
}
