/**
 * Fork-specific helpers for profile.php / profile.ts.
 *
 * Pure functions are exported for unit testing; window registration
 * makes them available to the non-module profile.ts script at runtime.
 */

/**
 * Returns the filled percentage (0–100) of a syndicate standing progress bar
 * for the player's current rank.
 *
 * For positive ranks the bar fills left-to-right as standing increases toward
 * the rank ceiling.  For negative ranks the bar fills red from the left as
 * standing falls toward the rank floor (most negative value).
 */
export function calcSyndicateRankPct(standing: number, rankMin: number, rankMax: number, level: number): number {
	if (level < 0) {
		return Math.min(100, Math.max(0, Math.round(standing / rankMin * 100)));
	}

	return Math.min(100, Math.max(0, Math.round((standing - rankMin) / (rankMax - rankMin) * 100)));
}

/**
 * Appends a standing progress bar to a syndicate card body element.
 * No-op for KahlSyndicate (Garrison), whose token-based titles are meaningless as standing progress.
 */
export function appendSyndicateProgressBar(body: HTMLElement, tag: string, standing: number, level: number, title: {minStanding: number; maxStanding: number}): void {
	if (tag === 'KahlSyndicate') {
		return;
	}

	const pct = calcSyndicateRankPct(standing, title.minStanding, title.maxStanding, level);
	const progressOuter = document.createElement('div');
	progressOuter.className = 'progress mt-1';
	progressOuter.style.height = '6px';
	const progressInner = document.createElement('div');
	progressInner.className = level < 0 ? 'progress-bar bg-danger' : 'progress-bar';
	progressInner.style.width = `${pct}%`;
	progressOuter.append(progressInner);
	body.append(progressOuter);
}

(globalThis as any).appendSyndicateProgressBar = appendSyndicateProgressBar;
