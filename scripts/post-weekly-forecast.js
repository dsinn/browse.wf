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

import {createRequire} from 'node:module';
import process from 'node:process';
import {
	dict_en as dictEn,
	ExportMissionTypes,
	ExportChallenges,
	ExportResources,
	ExportBundles,
	ExportBoosterPacks,
	ExportBoosters,
} from 'warframe-public-export-plus';
import {resolveCalendarSeasonDays, getSeasonLabel} from '../typestripped/src/calendar-seasons-data.js';
// eslint-disable-next-line import-x/order
import {resolveDescentChallenges} from '../typestripped/src/descendia-data.js';

const require = createRequire(import.meta.url);
const osdict = require('../test/__mocks__/dicts/en.json');

const camelToWords = s => s.replaceAll(/(?<=.)(?=[A-Z])/gu, ' ');

const PROXY_BASE_URL
	= process.env.WARFRAME_API_FRONT_PROXY_BASE_URL
		|| 'https://warframe-api-front-proxy.dsinn69.workers.dev';
const PROXY_TOKEN = process.env.WARFRAME_API_FRONT_PROXY_TOKEN || '';

async function fetchJson(url, options = {}) {
	const response = await fetch(url, options);
	if (!response.ok) {
		throw new Error(`HTTP ${response.status} for ${url}`);
	}

	return response.json();
}

async function fetchWorldState() {
	const headers = {
		Origin: 'http://localhost',
	};
	if (PROXY_TOKEN) {
		headers['X-Warframe-API-Front-Proxy-Token'] = PROXY_TOKEN;
	}

	return fetchJson(`${PROXY_BASE_URL}/worldState`, {headers});
}

function mongoMs(d) {
	return Number.parseInt(d.$date.$numberLong, 10);
}

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Returns the entry whose Activation is in the future and within one week, or null.
function findWeekly(items) {
	const now = Date.now();
	return items.find(x => {
		const ms = mongoMs(x.Activation);
		return ms > now && ms <= now + ONE_WEEK_MS;
	}) ?? null;
}

// Returns the entry with Activation closest to now (used as --force fallback).
function findClosest(items) {
	if (items.length === 0) {
		return null;
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

function discordTimestamp(ms) {
	return `<t:${Math.floor(ms / 1000)}:D>`;
}

function toTitleCase(s) {
	return s.replaceAll(/\w+/gu, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

// Conquest (Deep / Temporal Archimedea)

const CONQUEST_RISK_REMAP = {EMPBlackHole: 'MagneticHounds'};
const CONQUEST_VARIABLE_REMAP = {DullBlades: 'ComboCountChance', Undersupplied: 'MaxAmmo'};

const FRAME_VARIABLE_VALUE_MAP = {
	ShieldDelay: '500',
	TimeDilation: '50',
};

function conquestLabel(osdict, keyPrefix, raw) {
	const text = osdict[keyPrefix + raw];
	return text ?? raw;
}

export function formatConquest(worldState, conquestType, variantKeyPrefix, sectionTitle, osdict, dict, ExportMissionTypes, find = findWeekly, showTimestamp = false) {
	const conquests = (worldState.Conquests ?? []).filter(c => c.Type === conquestType);
	const next = find(conquests);
	if (!next) {
		return null;
	}

	const heading = showTimestamp
		? `## ${sectionTitle} ${discordTimestamp(mongoMs(next.Activation))}`
		: `## ${sectionTitle}`;
	const lines = [heading];

	for (const mission of next.Missions) {
		let hardDiff = mission.difficulties?.find(d => d.type === 'CD_HARD');
		if (!hardDiff && mission.difficulties && mission.difficulties.length > 0) {
			hardDiff = mission.difficulties[0];
			for (const d of mission.difficulties.slice(1)) {
				if (d.risks.length > hardDiff.risks.length) {
					hardDiff = d;
				}
			}
		}

		if (!hardDiff) {
			continue;
		}

		let type = ExportMissionTypes[mission.missionType]?.name?.split('MissionName_')[1] ?? mission.missionType;
		if (conquestType === 'CT_LAB' && type === 'Defense') {
			type = 'DualDefense';
		}

		const rawTypeName = dict['/Lotus/Language/Missions/MissionName_' + type] ?? camelToWords(type);
		const typeName = toTitleCase(rawTypeName);

		const variantName = conquestLabel(osdict, variantKeyPrefix, hardDiff.deviation);
		const variantDesc = osdict[variantKeyPrefix + hardDiff.deviation + '_Desc'];

		lines.push(
			`**${typeName}**`,
			variantDesc
				? `- **${variantName}**: ${variantDesc.replaceAll(/<[^>]+>/gu, '').trim()}`
				: `- **${variantName}**`,
		);

		for (const r of hardDiff.risks.slice(0, 2)) {
			const condKey = '/Lotus/Language/Conquest/Condition_' + (CONQUEST_RISK_REMAP[r] ?? r);
			const condName = osdict[condKey] ?? r;
			const condDesc = osdict[condKey + '_Desc'];
			lines.push(condDesc
				? `- **${condName}**: ${condDesc.replaceAll(/<[^>]+>/gu, '').trim()}`
				: `- **${condName}**`);
		}
	}

	if (next.Variables && next.Variables.length > 0) {
		lines.push('> **Frame Variables**');
		for (const fv of next.Variables) {
			const canonical = CONQUEST_VARIABLE_REMAP[fv] ?? fv;
			const key = '/Lotus/Language/Conquest/PersonalMod_' + canonical;
			const name = osdict[key] ?? fv;
			const desc = osdict[key + '_Desc'];
			let line = `> - **${name}**`;
			if (desc) {
				const value = FRAME_VARIABLE_VALUE_MAP[fv];
				const descText = desc.replaceAll(/<[^>]+>/gu, '').replaceAll('|val|', value ?? '').trim();
				line += `: ${descText}`;
			}

			lines.push(line);
		}
	}

	return lines.join('\n');
}

export function formatDescendia(worldState, dict, find = findWeekly, showTimestamp = false) {
	const next = find(worldState.Descents ?? []);
	if (!next) {
		return null;
	}

	const heading = showTimestamp
		? `## Descendia ${discordTimestamp(mongoMs(next.Activation))}`
		: '## Descendia';
	const lines = [heading];

	for (const row of resolveDescentChallenges(next, dict)) {
		const arena = row.arenaEmoji ?? row.arenaFallback;
		const parts = [row.challenge];
		if (row.specs.length > 0) {
			parts.push(row.specs.join(', '));
		}

		if (row.auras.length > 0) {
			parts.push(row.auras.join(', '));
		}

		const content = `**${row.typeLabel}** · ${parts.join(' · ')}`;
		const formatted = row.type === 'DT_PROTOFRAME' ? `__${content}__` : content;
		lines.push(`${row.index}. ${arena} ${formatted}`);
	}

	return lines.join('\n');
}

export function formatCalendarSeason(worldState, dict, ExportChallenges, ExportResources, ExportBundles, ExportBoosterPacks, ExportBoosters, find = findWeekly, showTimestamp = false) {
	const next = find(worldState.KnownCalendarSeasons ?? []);
	if (!next) {
		return null;
	}

	const seasonLabel = getSeasonLabel(next.Season);
	const heading = showTimestamp
		? `## 1999 Calendar: ${seasonLabel} ${discordTimestamp(mongoMs(next.Activation))}`
		: `## 1999 Calendar: ${seasonLabel}`;
	const lines = [heading];

	for (const dayData of resolveCalendarSeasonDays(next, dict, ExportChallenges, ExportResources, ExportBundles, ExportBoosterPacks, ExportBoosters)) {
		// Group consecutive events by (type, dateStr) — rewards and upgrades on the same day merge into one line
		let groupEmoji = null;
		let groupDate = null;
		let groupType = null;
		let groupTexts = [];
		const flushGroup = () => {
			if (groupTexts.length > 0) {
				lines.push(`${groupEmoji} **${groupDate}** ${groupTexts.join(' · ')}`);
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

async function postToDiscord(content, webhookUrl) {
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
export function chunkMessage(first, rest, limit = 2000) {
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
	const dict = dictEn;

	// Resolve which entry each section will use before formatting.
	// Missing weekly entries fall back to closest when --force is active.
	const entries = {
		Descendia: findWeekly(worldState.Descents ?? []),
		'1999 Calendar': findWeekly(worldState.KnownCalendarSeasons ?? []),
		'Deep Archimedea': findWeekly((worldState.Conquests ?? []).filter(c => c.Type === 'CT_LAB')),
		'Temporal Archimedea': findWeekly((worldState.Conquests ?? []).filter(c => c.Type === 'CT_HEX')),
	};

	const missing = Object.keys(entries).filter(k => entries[k] === null);
	if (missing.length > 0) {
		const message = `No upcoming entry (within one week) found for: ${missing.join(', ')}`;
		if (!force) {
			console.error(`Error: ${message}`);
			console.error('Use --force / -f to post anyway.');
			// eslint-disable-next-line unicorn/no-process-exit
			process.exit(1);
		}

		console.warn(`Warning: ${message}`);
		if (entries.Descendia === null) {
			entries.Descendia = findClosest(worldState.Descents ?? []);
		}

		if (entries['1999 Calendar'] === null) {
			entries['1999 Calendar'] = findClosest(worldState.KnownCalendarSeasons ?? []);
		}

		if (entries['Deep Archimedea'] === null) {
			entries['Deep Archimedea'] = findClosest((worldState.Conquests ?? []).filter(c => c.Type === 'CT_LAB'));
		}

		if (entries['Temporal Archimedea'] === null) {
			entries['Temporal Archimedea'] = findClosest((worldState.Conquests ?? []).filter(c => c.Type === 'CT_HEX'));
		}
	}

	// If all found entries share the same activation, show the timestamp once at the top.
	// Otherwise each section heading carries its own timestamp.
	const foundActivations = Object.values(entries).filter(Boolean).map(x => mongoMs(x.Activation));
	const allSame = foundActivations.length > 0 && foundActivations.every(ms => ms === foundActivations[0]);
	const showTimestamp = !allSame;
	const headerTs = allSame ? foundActivations[0] : null;

	// Build a find function that returns the pre-resolved entry for each section.
	const findResolved = sectionKey => _items => entries[sectionKey];

	const descendia = entries.Descendia ? formatDescendia(worldState, dict, findResolved('Descendia'), showTimestamp) : null;
	const calendar = entries['1999 Calendar'] ? formatCalendarSeason(worldState, dict, ExportChallenges, ExportResources, ExportBundles, ExportBoosterPacks, ExportBoosters, findResolved('1999 Calendar'), showTimestamp) : null;
	const deepArchimedea = entries['Deep Archimedea'] ? formatConquest(worldState, 'CT_LAB', '/Lotus/Language/Conquest/MissionVariant_LabConquest_', 'Deep Archimedea', osdict, dict, ExportMissionTypes, findResolved('Deep Archimedea'), showTimestamp) : null;
	const temporalArchimedea = entries['Temporal Archimedea'] ? formatConquest(worldState, 'CT_HEX', '/Lotus/Language/Conquest/MissionVariant_HexConquest_', 'Temporal Archimedea', osdict, dict, ExportMissionTypes, findResolved('Temporal Archimedea'), showTimestamp) : null;

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

	if (sections.length === 0) {
		console.log('No forecast data available. Nothing posted.');
		return;
	}

	const header = headerTs
		? `# Weekly Forecast ${discordTimestamp(headerTs)}\n\n`
		: '# Weekly Forecast\n\n';
	const chunks = chunkMessage(header + sections[0], sections.slice(1));

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
		await postToDiscord(chunk, process.env.WEEKLY_FORECAST_DISCORD_WEBHOOK_URL);
	}

	console.log('Done.');
}

// Only run when executed directly (not when imported by tests)
if (process.argv[1] === new URL(import.meta.url).pathname) {
	// eslint-disable-next-line unicorn/prefer-top-level-await
	main().catch(error => {
		console.error(error);
		// eslint-disable-next-line unicorn/no-process-exit
		process.exit(1);
	});
}
