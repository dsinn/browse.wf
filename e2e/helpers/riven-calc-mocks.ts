import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import {type Page} from '@playwright/test';

const EXPORT_PLUS_DIR = path.join(process.cwd(), 'node_modules', 'warframe-public-export-plus');

/** Weapons the Riven calculator tests pick, one per Riven type they use. */
const WEAPON_NAMES = new Set([
	'Braton', // Rifle
	'Lex', // Pistol
	'Skana', // Melee
	'Convectrix', // Shotgun
	'Catchmoon', // Kitgun
]);

function readExport(name: string): any {
	return JSON.parse(fs.readFileSync(path.join(EXPORT_PLUS_DIR, `${name}.json`), 'utf8'));
}

let cachedData: {weapons: string; upgrades: string; dict: string; textIcons: string} | undefined;

/**
 * Trims the (multi-megabyte) game data down to what the Riven calculator tests need, keeping the real
 * values. Trimming happens at test time, so the mocks cannot drift from warframe-public-export-plus.
 */
function getTrimmedData() {
	if (cachedData) {
		return cachedData;
	}

	const fullDict = readExport('dict.en');
	const allWeapons = readExport('ExportWeapons');
	const weapons: Record<string, any> = {};
	for (const [uniqueName, weapon] of Object.entries<any>(allWeapons)) {
		if (WEAPON_NAMES.has(fullDict[weapon.name] ?? weapon.name)) {
			weapons[uniqueName] = weapon;
		}
	}

	const weaponNameKeys = new Set(Object.values(weapons).map(weapon => weapon.name));
	const dict: Record<string, string> = {};
	for (const [key, value] of Object.entries<string>(fullDict)) {
		if (key.startsWith('/Lotus/Language/Upgrades/') || weaponNameKeys.has(key)) {
			dict[key] = value;
		}
	}

	const allUpgrades = readExport('ExportUpgrades');
	const upgrades = Object.fromEntries(Object.entries(allUpgrades)
		.filter(([key]) => key.startsWith('/Lotus/Upgrades/Mods/Randomized/') && !key.includes('/Raw')));

	cachedData = {
		weapons: JSON.stringify(weapons),
		upgrades: JSON.stringify(upgrades),
		dict: JSON.stringify(dict),
		textIcons: JSON.stringify(readExport('ExportTextIcons')),
	};
	return cachedData;
}

/**
 * Serves the Riven calculator a small slice of the real game data instead of ~7 MB of JSON, which makes the
 * page load quickly and keeps the tests from being flaky under CI load. Call after setupMockRoutes.
 */
export async function mockRivenCalcData(page: Page): Promise<void> {
	const data = getTrimmedData();
	const files: Record<string, string> = {
		ExportWeapons: data.weapons,
		ExportUpgrades: data.upgrades,
		'dict.en': data.dict,
		ExportTextIcons: data.textIcons,
	};
	for (const [file, body] of Object.entries(files)) {
		await page.route(`**/warframe-public-export-plus/${file}.json`, route => {
			void route.fulfill({status: 200, contentType: 'application/json', body});
		});
	}
}
