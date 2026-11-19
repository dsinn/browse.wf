/**
 Entry point of the Riven calculator page (riven-calc.php): loads the game data, then starts the calculator.

 Uses globals exposed by common.js and the src bundle:
 - getDictPromise, withTranslationFallback
 */
import { fetchExport } from '../public-export-fetcher.js';
import { initRivenCalc } from './index.js';
/**
Adds the names that neither browse.wf nor warframe-public-export-plus provide (spliced traits).
*/
function withFallback(dict) {
    return window.withTranslationFallback?.(dict) ?? dict;
}
const [dict, exportWeapons, exportUpgrades, exportTextIcons] = await Promise.all([
    getDictPromise(),
    fetchExport('ExportWeapons'),
    fetchExport('ExportUpgrades'),
    fetchExport('ExportTextIcons'),
]);
window.dict = withFallback(dict);
const calculator = initRivenCalc({
    dict: window.dict, exportWeapons, exportUpgrades, exportTextIcons,
});
// Called by common.js after a language change, which replaces window.dict with the plain dictionary
window.onLanguageUpdate = () => {
    window.dict = withFallback(window.dict);
    calculator.setDict(window.dict);
};
//# sourceMappingURL=main.js.map