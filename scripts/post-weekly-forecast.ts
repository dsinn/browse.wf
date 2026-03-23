/**
 * Post-weekly-forecast.js
 *
 * Fetches the weekly forecast data and posts a summary to Discord via webhook.
 * Designed to run in Node.js (no DOM) on a weekly schedule.
 *
 * Required environment variables:
 *   WEEKLY_FORECAST_DISCORD_WEBHOOK_URL  — the Discord webhook URL to POST to
 *
 * Optional environment variables:
 *   WARFRAME_API_FRONT_PROXY_BASE_URL  — override the proxy base URL
 *   WARFRAME_API_FRONT_PROXY_TOKEN     — auth token for the proxy
 */

import process from 'node:process';
import {dict_en as dictEn} from 'warframe-public-export-plus';
import {resolveCalendarSeasonDays, getSeasonLabel} from '../src/calendar-seasons-data.js';
import {resolveDescentChallenges} from '../src/descendia-data.js';
import {resolveConquest} from '../src/archimedea-data.js';
import osdict from '../test/__mocks__/dicts/en.json' with {type: 'json'};

type AnyRecord = Record<string, any>;

const PROXY_BASE_URL
	= process.env.WARFRAME_API_FRONT_PROXY_BASE_URL
		|| 'https://warframe-api-front-proxy.dsinn69.workers.dev';
const PROXY_TOKEN = process.env.WARFRAME_API_FRONT_PROXY_TOKEN || '';

async function fetchJson(url: string, options: RequestInit = {}) {
	const response = await fetch(url, options);
	if (!response.ok) {
		throw new Error(`HTTP ${response.status} for ${url}`);
	}

	return response.json();
}

async function fetchWorldState() {
	const headers: Record<string, string> = {
		Origin: 'http://localhost',
	};
	if (PROXY_TOKEN) {
		headers['X-Warframe-API-Front-Proxy-Token'] = PROXY_TOKEN;
	}

	return fetchJson(`${PROXY_BASE_URL}/worldState`, {headers});
}

function mongoMs(d: AnyRecord) {
	return Number.parseInt(d.$date.$numberLong, 10);
}

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Returns the entry whose Activation is in the future and within one week, or null.
function findWeekly(items: AnyRecord[]) {
	const now = Date.now();
	return items.find(x => {
		const ms = mongoMs(x.Activation);
		return ms > now && ms <= now + ONE_WEEK_MS;
	});
}

// Returns the entry with Activation closest to now (used as --force fallback).
function findClosest(items: AnyRecord[]) {
	if (items.length === 0) {
		return undefined;
	}

	const now = Date.now();
	let best = items[0];
	for (const x of items.slice(1)) {
		if (Math.abs(mongoMs(x.Activation) - now) < Math.abs(mongoMs(best.Activation) - now)) {
			best = x;
		}
	}

	return best;
}

function discordTimestamp(ms: number) {
	return `<t:${Math.floor(ms / 1000)}:D>`;
}

export function escapeMarkdown(s: string) {
	return s.replaceAll(/(?=[*_~`|>[\\\]])/gu, '\\');
}

// Conquest (Deep / Temporal Archimedea)

export async function formatConquest(worldState: AnyRecord, conquestType: string, variantKeyPrefix: string, sectionTitle: string, find = findWeekly, showTimestamp = false) {
	const conquests = (worldState.Conquests ?? []).filter((c: AnyRecord) => c.Type === conquestType);
	const next = find(conquests);
	if (!next) {
		return null;
	}

	const {missions, frameVariables} = await resolveConquest(next, conquestType, variantKeyPrefix, osdict, dictEn);

	const heading = showTimestamp
		? `## ${sectionTitle} ${discordTimestamp(mongoMs(next.Activation))}`
		: `## ${sectionTitle}`;
	const lines = [heading];

	for (const mission of missions) {
		lines.push(
			`**${mission.type}**`,
			mission.variantDesc
				? `- **${escapeMarkdown(mission.variant)}**: ${escapeMarkdown(mission.variantDesc)}`
				: `- **${escapeMarkdown(mission.variant)}**`,
		);
		for (const cond of mission.conditions) {
			lines.push(cond.desc ? `- **${escapeMarkdown(cond.name)}**: ${escapeMarkdown(cond.desc)}` : `- **${escapeMarkdown(cond.name)}**`);
		}
	}

	if (frameVariables.length > 0) {
		lines.push('> **Frame Variables**');
		for (const fv of frameVariables) {
			lines.push(fv.desc ? `> - **${escapeMarkdown(fv.name)}**: ${escapeMarkdown(fv.desc)}` : `> - **${escapeMarkdown(fv.name)}**`);
		}
	}

	return lines.join('\n');
}

export async function formatDescendia(worldState: AnyRecord, find = findWeekly, showTimestamp = false) {
	const next = find(worldState.Descents ?? []);
	if (!next) {
		return null;
	}

	const heading = showTimestamp
		? `## Descendia ${discordTimestamp(mongoMs(next.Activation))}`
		: '## Descendia';
	const lines = [heading];

	for (const row of resolveDescentChallenges(next as any, dictEn)) {
		const arena = row.arenaEmoji ?? row.arenaFallback;
		const parts = [row.challenge];
		if (row.specs.length > 0) {
			parts.push(row.specs.join(', '));
		}

		if (row.auras.length > 0) {
			parts.push(row.auras.join(', '));
		}

		const content = `**${escapeMarkdown(row.typeLabel)}** · ${parts.map(p => escapeMarkdown(p)).join(' · ')}`;
		const formatted = row.type === 'DT_PROTOFRAME' ? `__${content}__` : content;
		lines.push(`${row.index}. ${arena} ${formatted}`);
	}

	return lines.join('\n');
}

export async function formatCalendarSeason(worldState: AnyRecord, find = findWeekly, showTimestamp = false) {
	const next = find(worldState.KnownCalendarSeasons ?? []);
	if (!next) {
		return null;
	}

	const seasonLabel = getSeasonLabel(next.Season);
	const heading = showTimestamp
		? `## 1999 Calendar: ${seasonLabel} ${discordTimestamp(mongoMs(next.Activation))}`
		: `## 1999 Calendar: ${seasonLabel}`;
	const lines = [heading];

	for (const dayData of await resolveCalendarSeasonDays(next, dictEn)) {
		// Group consecutive events by (type, dateStr) — rewards and upgrades on the same day merge into one line
		let groupEmoji: string | undefined;
		let groupDate: string | undefined;
		let groupType: string | undefined;
		let groupTexts: string[] = [];
		const flushGroup = () => {
			if (groupTexts.length > 0) {
				lines.push(`${groupEmoji} **${groupDate}** ${groupTexts.map(t => escapeMarkdown(t)).join(' · ')}`);
			}
		};

		for (const event of dayData.events) {
			const groupable = event.type === 'CET_REWARD' || event.type === 'CET_UPGRADE';
			if (groupable && event.type === groupType && event.dateStr === groupDate) {
				groupTexts.push(event.text);
			} else {
				flushGroup();
				groupEmoji = event.emoji;
				groupDate = event.dateStr;
				groupType = event.type;
				groupTexts = [event.text];
			}
		}

		flushGroup();
	}

	return lines.join('\n');
}

async function postToDiscord(content: string, webhookUrl: string) {
	const response = await fetch(webhookUrl, {
		method: 'POST',
		headers: {'Content-Type': 'application/json'},
		body: JSON.stringify({content}),
	});
	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Discord webhook failed: HTTP ${response.status} — ${body}`);
	}
}

// Produces an array of Discord messages. The first section is included in the
// first message; remaining sections each get their own message (already split
// by the caller). Each message is further line-split if it exceeds 2000 chars.
export function chunkMessage(first: string, rest: string[], limit = 2000) {
	const messages = [first, ...rest];
	const chunks = [];
	for (const message of messages) {
		if (message.length <= limit) {
			chunks.push(message);
			continue;
		}

		const lines = message.split('\n');
		let current = '';
		for (const line of lines) {
			if (current.length + line.length + 1 > limit) {
				if (current) {
					chunks.push(current);
				}

				current = line;
			} else {
				current = current ? current + '\n' + line : line;
			}
		}

		if (current) {
			chunks.push(current);
		}
	}

	return chunks;
}

function resolveEntries(worldState: AnyRecord, force: boolean) {
	const entries: Record<string, AnyRecord | undefined> = {
		Descendia: findWeekly(worldState.Descents ?? []),
		'1999 Calendar': findWeekly(worldState.KnownCalendarSeasons ?? []),
		'Deep Archimedea': findWeekly((worldState.Conquests ?? []).filter((c: AnyRecord) => c.Type === 'CT_LAB')),
		'Temporal Archimedea': findWeekly((worldState.Conquests ?? []).filter((c: AnyRecord) => c.Type === 'CT_HEX')),
	};

	const missing = Object.keys(entries).filter(k => entries[k] === undefined);
	if (missing.length > 0) {
		const message = `No upcoming entry (within one week) found for: ${missing.join(', ')}`;
		if (!force) {
			console.error(`Error: ${message}`);
			console.error('Use --force / -f to post anyway.');
			// eslint-disable-next-line unicorn/no-process-exit
			process.exit(1);
		}

		console.warn(`Warning: ${message}`);
		const fallbackItems: Record<string, AnyRecord[]> = {
			Descendia: worldState.Descents ?? [],
			'1999 Calendar': worldState.KnownCalendarSeasons ?? [],
			'Deep Archimedea': (worldState.Conquests ?? []).filter((c: AnyRecord) => c.Type === 'CT_LAB'),
			'Temporal Archimedea': (worldState.Conquests ?? []).filter((c: AnyRecord) => c.Type === 'CT_HEX'),
		};
		for (const key of missing) {
			entries[key] = findClosest(fallbackItems[key]);
		}
	}

	return entries;
}

async function buildSections(worldState: AnyRecord, entries: Record<string, AnyRecord | undefined>, showTimestamp: boolean) {
	const findResolved = (sectionKey: string) => (_items: AnyRecord[]) => entries[sectionKey];

	const [descendia, calendar, deepArchimedea, temporalArchimedea] = await Promise.all([
		entries.Descendia
			? formatDescendia(worldState, findResolved('Descendia'), showTimestamp)
			: null,
		entries['1999 Calendar']
			? formatCalendarSeason(worldState, findResolved('1999 Calendar'), showTimestamp)
			: null,
		entries['Deep Archimedea']
			? formatConquest(worldState, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_', 'Deep Archimedea', findResolved('Deep Archimedea'), showTimestamp)
			: null,
		entries['Temporal Archimedea']
			? formatConquest(worldState, 'CT_HEX', '/Lotus/Language/Conquest/MissionVariant_HexConquest_', 'Temporal Archimedea', findResolved('Temporal Archimedea'), showTimestamp)
			: null,
	]);

	// Try to combine both Archimedeas into one message; split if too long
	const archimedeas = [deepArchimedea, temporalArchimedea].filter(Boolean);
	const archimedeaCombined = archimedeas.join('\n\n');

	const sections = [descendia, calendar].filter(Boolean);
	if (archimedeaCombined.length <= 2000) {
		if (archimedeaCombined) {
			sections.push(archimedeaCombined);
		}
	} else {
		sections.push(...archimedeas);
	}

	return sections;
}

export async function main() {
	const args = new Set(process.argv.slice(2));
	const dryRun = args.has('--dry-run');
	const force = args.has('--force') || args.has('-f');

	if (!dryRun && !process.env.WEEKLY_FORECAST_DISCORD_WEBHOOK_URL) {
		console.error('Error: WEEKLY_FORECAST_DISCORD_WEBHOOK_URL environment variable is required.');
		// eslint-disable-next-line unicorn/no-process-exit
		process.exit(1);
	}

	console.log('Fetching data...');

	const worldState = await fetchWorldState();

	// Resolve which entry each section will use before formatting.
	// Missing weekly entries fall back to closest when --force is active.
	const entries = resolveEntries(worldState, force);

	// If all found entries share the same activation, show the timestamp once at the top.
	// Otherwise each section heading carries its own timestamp.
	const foundActivations = Object.values(entries).filter(Boolean).map(x => mongoMs(x!.Activation));
	const allSame = foundActivations.length > 0 && foundActivations.every(ms => ms === foundActivations[0]);
	const showTimestamp = !allSame;
	const headerTs = allSame ? foundActivations[0] : null;

	const sections = await buildSections(worldState, entries, showTimestamp);

	if (sections.length === 0) {
		console.log('No forecast data available. Nothing posted.');
		return;
	}

	const header = headerTs
		? `# Weekly Forecast ${discordTimestamp(headerTs)}\n\n`
		: '# Weekly Forecast\n\n';
	const chunks = chunkMessage(header + sections[0]!, sections.slice(1) as string[]);

	if (dryRun) {
		for (const [i, chunk] of chunks.entries()) {
			if (chunks.length > 1) {
				console.log(`\n--- Message ${i + 1} ---`);
			}

			console.log(chunk);
		}

		return;
	}

	console.log(`Posting ${chunks.length} message(s) to Discord...`);
	for (const chunk of chunks) {
		// eslint-disable-next-line no-await-in-loop
		await postToDiscord(chunk, process.env.WEEKLY_FORECAST_DISCORD_WEBHOOK_URL!);
	}

	console.log('Done.');
}

// Only run when executed directly (not when imported by tests)
if (process.argv[1] === new URL(import.meta.url).pathname) {
	// eslint-disable-next-line unicorn/prefer-top-level-await
	main().catch((error: unknown) => {
		console.error(error);
		// eslint-disable-next-line unicorn/no-process-exit
		process.exit(1);
	});
}
