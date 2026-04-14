/**
 * News card rendering
 *
 * Extracted from live.ts so it can be tested in isolation.
 * Depends on globals set by live.ts (formatActivation, sendNotification) and
 * worldState.
 */

import {addTooltip} from '../tooltip.js';
import {isFilterEnabled} from '../card-filters.js';
import {
	isNewsItemRead, markNewsItemAsRead, setNewsItemData, type NewsItem,
} from './news-mark-read.js';

let latestRenderedNewsTime = 0;
let newsNotifyAfter = 0;

// eslint-disable-next-line complexity
export function updateNewsTicker(forceRender = false): void {
	let highestTime = 0;
	const items: NewsItem[] = [];

	if ((window as any).worldState) {
		const languageCode = (localStorage.getItem('lang') ?? 'en');

		for (const event of (window as any).worldState.Events) {
			if (event.Date) {
				const time = Math.trunc(event.Date.$date.$numberLong / 1000);

				if (time > highestTime) {
					highestTime = time;
				}

				let message = event.Messages?.find((x: any) => x.LanguageCode === languageCode)?.Message;
				message ??= event.Msg;

				if (message && message !== '/Lotus/Language/CommunityMessages/JoinDiscord') {
					items.push({
						type: event.Community ? 'success' : 'primary',
						data: message,
						time,
						link: event.Prop,
					});
				}
			}
		}
	}

	items.sort((a, b) => b.time - a.time);

	// Handle case where API returned no items
	if (items.length === 0) {
		document.querySelector('#news-body')!.innerHTML = 'No news items available.';
		return;
	}

	// Skip re-render if data hasn't changed
	if (!forceRender && latestRenderedNewsTime === highestTime) {
		return;
	}

	latestRenderedNewsTime = highestTime;

	if (newsNotifyAfter && localStorage.getItem('live.notif.news')) {
		for (let i = items.length; i-- !== 0;) {
			// Only notify for items that pass the filter
			if (items[i].time > newsNotifyAfter && isFilterEnabled('news', items[i].type)) {
				window.sendNotification!(items[i].data);
			}
		}
	}

	if ((window as any).worldState) {
		newsNotifyAfter = highestTime;
	}

	// Filter items based on user preferences (mutate in place to minimize upstream changes)
	for (let i = items.length; i-- > 0;) {
		if (!isFilterEnabled('news', items[i].type)) {
			items.splice(i, 1);
		}
	}

	// Handle case where all items were filtered out
	if (items.length === 0) {
		document.querySelector('#news-body')!.innerHTML = 'No news items to display based on the current filters.';
		return;
	}

	document.querySelector('#news-body')!.innerHTML = '';

	for (let i = 0; i !== items.length; ++i) {
		const p = document.createElement('p');
		p.className = `card-text mb-1 news-item news-${items[i].type}`;

		if (items[i].type === 'primary' || items[i].type === 'success') {
			const diamond = document.createElement('span');
			diamond.className = 'news-diamond';
			const label = items[i].type === 'success' ? 'Community event' : 'Regular event';
			addTooltip(diamond, label);
			p.append(diamond);
		}

		{
			const span = document.createElement('span');
			span.className = 'badge text-bg-secondary';
			span.dataset.activation = (items[i].time * 1000).toString();
			span.textContent = window.formatActivation
				? window.formatActivation(items[i].time * 1000)
				: new Date(items[i].time * 1000).toLocaleString();
			p.append(span);
		}

		{
			const span = document.createElement('span');
			span.className = 'news-text';
			span.textContent = ' ';

			// Prop may be an empty string in upstream data; falsy check mirrors upstream behaviour
			if (items[i].link) {
				const a = document.createElement('a');
				a.textContent = items[i].data;
				a.href = items[i].link!;
				a.target = '_blank';
				a.addEventListener('click', () => {
					markNewsItemAsRead(items[i], p);
				});
				span.append(a);
			} else {
				span.textContent += items[i].data;
				span.addEventListener('click', () => {
					markNewsItemAsRead(items[i], p);
				});
			}

			p.append(span);
		}

		setNewsItemData(items[i], p);

		// Add read state class if already marked as read
		if (isNewsItemRead(items[i])) {
			p.classList.add('news-read');
		}

		document.querySelector('#news-body')!.append(p);
	}

	document.querySelector('#news-body > :last-child')!.classList.remove('mb-1');
}

/** Reset internal module state (useful for tests) */
export function resetNewsState(): void {
	latestRenderedNewsTime = 0;
	newsNotifyAfter = 0;
}

window.updateNewsTicker = updateNewsTicker;
