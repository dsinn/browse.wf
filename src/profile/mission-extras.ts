/**
 Extras for the Missions tab rows: a high score column, and teletype for tags without a known node
 (such as the old raid keys).

 Called via (window as any).augmentMissionRow() for each row rendered by profile.ts.
 */

import {renderInternalName, enableInternalNameTooltips} from './internal-name.js';

let highScoreCache: {source: unknown; scores: Map<string, number>} | undefined;

function getHighScores(): Map<string, number> {
	const missions = window.profile?.Stats?.Missions;
	if (highScoreCache && highScoreCache.source === missions) {
		return highScoreCache.scores;
	}

	const scores = new Map<string, number>();
	for (const mission of missions ?? []) {
		if (mission.highScore > 0) {
			scores.set(mission.type, mission.highScore);
		}
	}

	highScoreCache = {source: missions, scores};
	return scores;
}

/**
 Inserts a high score cell before the last (note) cell of an upstream-rendered mission row.
 */
export function augmentMissionRow(tr: HTMLTableRowElement, mission: {Tag: string}): void {
	const highScoreCell = document.createElement('td');
	const highScore = getHighScores().get(mission.Tag);
	if (highScore !== undefined) {
		highScoreCell.textContent = highScore.toLocaleString();
	}

	tr.cells[tr.cells.length - 1].before(highScoreCell);

	const regions: Record<string, unknown> = (window as any).ExportRegions ?? {};
	if (Object.hasOwn(regions, mission.Tag)) {
		return;
	}

	renderInternalName(tr.cells[0], mission.Tag);
	enableInternalNameTooltips(document.querySelector('#missions tbody') ?? undefined);
}

window.augmentMissionRow = augmentMissionRow;
