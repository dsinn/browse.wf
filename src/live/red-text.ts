/**
 * Red Text card
 *
 * Fetches and renders Warframe IRC WALLOPS messages into the dedicated
 * #red-text-body element, independent of the News card.
 */

import {SECONDS_PER_DAY} from '../helpers/time-helpers.js';

async function fetchRedText(): Promise<void> {
	(globalThis as any).redtext = []; // Sentinel: prevents duplicate fetches
	return fetch('https://oracle.browse.wf/redtext.json')
		.then(async response => response.json())
		.then((data: Array<{data: string; time: number}>) => {
			(globalThis as any).redtext = data;
		})
		.catch((error: unknown) => {
			console.error(error);
			(globalThis as any).redtext = undefined; // Allow retry on next trigger
		});
}

export function updateRedText(): void {
	if (localStorage.getItem('live.collapse.red-text')) {
		return;
	}

	if (!(globalThis as any).redtext) {
		void fetchRedText().then(() => {
			updateRedText();
		});
		return;
	}

	const cutoff = (Date.now() / 1000) - (30 * SECONDS_PER_DAY);
	const items = ((globalThis as any).redtext as Array<{data: string; time: number}>)
		.filter(item => item.time > cutoff)
		.map(item => ({data: item.data.split('WALLOPS :')[1], time: item.time}))
		.sort((a, b) => b.time - a.time);

	const body = document.querySelector<HTMLElement>('#red-text-body');
	if (!body) {
		return;
	}

	if (items.length === 0) {
		body.innerHTML = 'No red text in the past 30 days.';
		return;
	}

	body.innerHTML = '';
	for (const item of items) {
		const p = document.createElement('p');
		p.className = 'card-text mb-1';

		{
			const span = document.createElement('span');
			span.className = 'badge text-bg-secondary';
			span.dataset.activation = (item.time * 1000).toString();
			span.textContent = (globalThis as any).formatActivation
				? (globalThis as any).formatActivation(item.time * 1000)
				: new Date(item.time * 1000).toLocaleString();
			p.append(span);
		}

		{
			const span = document.createElement('span');
			span.className = 'text-danger-emphasis ms-1';
			span.textContent = item.data;
			p.append(span);
		}

		body.append(p);
	}

	body.lastElementChild!.classList.remove('mb-1');
}

(globalThis as any).updateRedText = updateRedText;

// When the red-text card is expanded, trigger a fetch/render if not yet loaded.
// Uses event delegation so the listener is active before DOMContentLoaded.
// The generic onclick in live.ts removes the collapse key first and replaces
// the toggle's inner span (detaching the original event.target from the DOM),
// so event.composedPath() is used instead of closest() — it captures the
// dispatch-time path and remains valid even after DOM mutations.
document.addEventListener('click', event => {
	const path = event.composedPath();
	const isToggle = path.some(element => (element as HTMLElement).dataset?.collapseToggle === 'red-text');
	if (isToggle && !localStorage.getItem('live.collapse.red-text')) {
		updateRedText();
	}
});
