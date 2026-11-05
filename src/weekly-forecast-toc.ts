/**
 * Weekly Forecast table of contents — highlights the entry for the section currently being read.
 *
 * Bootstrap's scrollspy can't be used here: it never activates the last section when that section
 * is too short to reach the top of the viewport, so this does the (small) bookkeeping itself.
 */

/** A section counts as "current" once its top edge is within this fraction of the viewport height. */
const ACTIVATION_FRACTION = 0.3;

/** Returns the id of the section to highlight, given each section's top edge relative to the viewport. */
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

/** Below the lg breakpoint the entries form a horizontally scrolling strip; keep the current one centred in it. */
function centreLinkInStrip(strip: HTMLElement, link: HTMLElement): void {
	if (strip.scrollWidth <= strip.clientWidth) {
		return;
	}

	const stripBox = strip.getBoundingClientRect();
	const linkBox = link.getBoundingClientRect();
	strip.scrollBy({left: (linkBox.left - stripBox.left) - ((stripBox.width - linkBox.width) / 2)});
}

/** Marks which sides of the (horizontally scrolling) strip have entries hidden beyond the edge, for the CSS fades. */
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
	const update = (): void => {
		frame = 0;
		const root = document.documentElement;
		const activeId = pickActiveSectionId(
			sections.map(section => ({id: section.id, top: section.getBoundingClientRect().top})),
			window.innerHeight,
			Math.ceil(window.scrollY + window.innerHeight) >= root.scrollHeight - 1,
		);
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

	window.addEventListener('scroll', scheduleUpdate, {passive: true});
	strip?.addEventListener('scroll', () => {
		updateStripFades(strip);
	}, {passive: true});
	window.addEventListener('resize', scheduleUpdate);
	// Cards change height as their content loads, which can move the current section without any scrolling
	new ResizeObserver(scheduleUpdate).observe(document.body);
	update();
}

/**
 * The cards fill in asynchronously, so the browser's own jump to a `#section` URL fragment can land on the position the
 * section had before its content loaded (intermittent in every major engine, most often in Chromium and WebKit).
 * Call this once the content is in place to jump again.
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
