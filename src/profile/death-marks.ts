/**
 Shows which enemies currently have a death mark on the player, under the clan line in the profile header:
 the Stalker, the Zanuka Hunter, and the Grustrag Three.

 The profile stores these as three separate fields:
 - DeathMarks: the bosses whose deaths marked the player for the Stalker. The Stalker is shown if there are any.
 - Harvestable: true while the Zanuka Hunter (sent by Alad V after Corpus invasion work) is after the player.
 - DeathSquadable: true while the Grustrag Three (sent by Vay Hek after Grineer invasion work) are after the player.
 A Zanuka or Grustrag value of false means they have marked the player before but aren't after them now.

 Called via (window as any).renderDeathMarks() from the profile extras hook in profile.ts.
 */

import {addTooltip} from '../tooltip.js';
import {lastPathSegment} from '../helpers/path-helpers.js';

type DeathMark = {name: string; icon: string; tooltip?: string};

// The sigil of each hunter, which is also the emblem used in the game for the mark itself
const STALKER_ICON = '/Lotus/Interface/Icons/MarkedForDeathStalker.png';
const ZANUKA_ICON = '/Lotus/Interface/Icons/MarkedForDeathZanuka.png';
const GRUSTRAG_ICON = '/Lotus/Interface/Icons/MarkedForDeathGrustrag.png';

const GAME_LANGUAGE_PREFIX = '/Lotus/Language/Game/';

// Bosses whose name in the dictionary isn't under the DeathMarks key or the key with its "Boss" prefix removed
const BOSS_NAME_KEYS: Record<string, string> = {
	BossAmbulas: 'BossAmbulas',
	BossGeneralSargasRuk: 'SargasRuk',
	BossHyenaElectric: 'HyenaElecName',
	BossHyenaFire: 'HyenaFireName',
	BossHyenaGun: 'HyenaGunName',
	BossHyenaIce: 'HyenaIceName',
	BossJ3Golem: 'JuniorGolemName',
	BossLephantis: 'GolemBossFull',
	BossTheJackal: 'QuadRobot',
};

/**
 Names a boss from a DeathMarks entry such as "/Lotus/Language/Bosses/BossHyenaFire" (which the game shows as
 "Hyena NG"). The names are filed in the dictionary under a few different keys: the entry itself, a key by the same
 name in the game's own strings with the "Boss" prefix removed, or one of those listed above. If none are found, the
 name is made by splitting the key into words ("Hyena Fire").
 */
export function describeMarkingBoss(key: string, dict?: Record<string, string>): string {
	const segment = lastPathSegment(key);
	const alias = BOSS_NAME_KEYS[segment];
	const candidates = [
		key,
		...alias ? [GAME_LANGUAGE_PREFIX + alias] : [],
		GAME_LANGUAGE_PREFIX + segment.replace(/^Boss/u, ''),
	];
	const name = candidates.map(candidate => dict?.[candidate]).find(Boolean);
	if (name) {
		return name;
	}

	const words = segment
		.replace(/^Boss/u, '')
		.replaceAll(/(?<=[\da-z])(?=[A-Z])/gu, ' ');
	return words || key;
}

// Boss names sort without a leading "The", so "The Raptor" is listed under R
const sortableName = (name: string): string => name.replace(/^the\s+/iu, '');

export function getDeathMarks(result: any, dict?: Record<string, string>): DeathMark[] {
	const marks: DeathMark[] = [];

	if (Array.isArray(result?.DeathMarks) && result.DeathMarks.length > 0) {
		const bosses = result.DeathMarks
			.map((key: string) => describeMarkingBoss(key, dict))
			.sort((a: string, b: string) => sortableName(a).localeCompare(sortableName(b)))
			.join(', ');
		marks.push({
			name: dict?.['/Lotus/Language/Game/Stalker'] ?? 'Stalker',
			icon: STALKER_ICON,
			tooltip: `Marked by killing: ${bosses}`,
		});
	}

	if (result?.Harvestable === true) {
		marks.push({name: dict?.['/Lotus/Language/Game/ZanukaHunter'] ?? 'Zanuka Hunter', icon: ZANUKA_ICON});
	}

	if (result?.DeathSquadable === true) {
		marks.push({name: 'The Grustrag Three', icon: GRUSTRAG_ICON});
	}

	return marks;
}

export function renderDeathMarks(profile: any): void {
	const paragraph = document.querySelector<HTMLElement>('#marks');
	const span = paragraph?.querySelector<HTMLElement>('span');
	if (!paragraph || !span) {
		return;
	}

	const {dict} = (globalThis as any);
	const marks = getDeathMarks(profile?.Results?.[0], dict);
	paragraph.classList.toggle('d-none', marks.length === 0);

	const parts: Array<string | HTMLElement> = [];
	for (const [index, mark] of marks.entries()) {
		if (index > 0) {
			parts.push(', ');
		}

		const element = document.createElement('span');
		const icon = document.createElement('img');
		icon.className = 'mark-icon';
		icon.alt = '';
		window.setImageSource?.(icon, mark.icon);
		element.append(icon, mark.name);
		if (mark.tooltip) {
			element.classList.add('has-tooltip');
			addTooltip(element, mark.tooltip);
		}

		parts.push(element);
	}

	span.replaceChildren(...parts);
}

window.renderDeathMarks = renderDeathMarks;
