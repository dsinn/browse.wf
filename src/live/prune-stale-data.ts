/**
 * Stale data pruning for localStorage.
 *
 * Runs periodically, a few seconds after a successful worldState fetch.
 */

import {MILLIS_PER_DAY} from '../helpers/time-helpers.js';
import {pruneStaleNewsRead} from './news-mark-read.js';

const PRUNE_DELAY_MS = 5000;
const PRUNE_INTERVAL_MS = MILLIS_PER_DAY;
let lastPruneTime = 0;

export function pruneStaleOids(): void {
	const oidsValue = localStorage.getItem('oids_completed');
	if (!oidsValue) {
		return;
	}

	let allOids: string[];
	try {
		allOids = JSON.parse(oidsValue);
	} catch {
		localStorage.removeItem('oids_completed');
		return;
	}

	const now = Date.now();

	// MongoDB OID cards: only prune when all required cards have loaded
	const sortieOids = document.querySelectorAll('#sortie-header [data-oid]');
	const litesortieOids = document.querySelectorAll('#litesortie-header [data-oid]');
	const invasionOids = document.querySelectorAll('#invasions-table [data-oid]');
	const alertsBody = document.querySelector('#alerts-body');
	const alertsLoaded = alertsBody !== null && !alertsBody.textContent?.startsWith('Loading');
	const mongoCardsLoaded = sortieOids.length > 0 && litesortieOids.length > 0 && invasionOids.length > 0 && alertsLoaded;

	const validMongoOids = new Set<string>();
	if (mongoCardsLoaded) {
		for (const element of [...sortieOids, ...litesortieOids, ...invasionOids]) {
			const {oid} = (element as HTMLElement).dataset;
			if (oid) {
				validMongoOids.add(oid);
			}
		}

		if (alertsBody) {
			for (const element of alertsBody.querySelectorAll<HTMLElement>('[data-oid]')) {
				if (element.dataset.oid) {
					validMongoOids.add(element.dataset.oid);
				}
			}
		}
	}

	const cleaned = allOids.filter((oid: string) => {
		// Millisecond-timestamp OIDs (weekly missions, vendors, daily syndicates, Archimedea, calendar season)
		// eslint-disable-next-line @stylistic/max-len
		const m = /^(?:calendarseason|circuit-(?:normal|hard)|clem|descent[1-2]|EntratiLabSyndicate-check|hexconquest|HexSyndicate-check|ironwake|kahl(?:b[1-6])?|labconquest|maroo|netracell[1-5]|teshin)-(\d+)$/u.exec(oid);
		if (m) {
			return Number.parseInt(m[1], 10) >= now;
		}

		// MongoDB ObjectIDs (sortie, archon hunt, invasions, alerts)
		if (/^[0-9a-f]{24}$/u.test(oid)) {
			return !mongoCardsLoaded || validMongoOids.has(oid);
		}

		// Unknown format — keep
		return true;
	});

	if (cleaned.length > 0) {
		localStorage.setItem('oids_completed', JSON.stringify(cleaned));
	} else {
		localStorage.removeItem('oids_completed');
	}

	lastPruneTime = now;
}

function schedulePruneOnWorldState(): void {
	globalThis.addEventListener('worldstate-updated', () => {
		if (Date.now() - lastPruneTime < PRUNE_INTERVAL_MS) {
			return;
		}

		setTimeout(() => {
			pruneStaleOids();
			pruneStaleNewsRead();
		}, PRUNE_DELAY_MS);
	}, {once: true});
}

schedulePruneOnWorldState();
