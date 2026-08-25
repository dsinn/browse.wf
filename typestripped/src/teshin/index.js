/**
 * Steel Path Honors (Teshin) forecast table for the /weekly-forecast page.
 *
 * The EPOCH, week math, and teshinOffer item list below are copied verbatim
 * from updateTeshin() in live.ts — that is upstream code we don't touch, so
 * this list is intentionally duplicated (including its formatting, via the
 * eslint-disable below) rather than restructured or shared. If upstream ever
 * changes the offer rotation, this list must be updated to match by hand.
 */
// Bootstrap breakpoint class per appearance column beyond the first (always-visible) one.
// This table lives inside <div class="container"> > .card > .card-body. At each breakpoint,
// .container has a fixed max-width AND its own 24px gutter (12px each side); .card-body adds
// another 32px of padding (16px each side). So usable width = containerMaxWidth - 24 - 32,
// not the raw viewport width or container max-width alone. Each date column is ~80px wide
// (including its left-padding gap) and the offer column is ~180px, so the number of columns
// that fit is floor((containerMaxWidth - 24 - 32 - 180) / 80):
//   sm (container 540px) -> (540-24-32-180)/80 = 3 columns
//   md (container 720px) -> (720-24-32-180)/80 = 6+ -> capped at the max of 6
// lg/xl/xxl clear the threshold even further, so no further reveals are needed past md.
// Base (<576px, fluid container, can shrink arbitrarily) only guarantees 1.
const APPEARANCE_COLUMN_BREAKPOINT_CLASSES = [
    'd-none d-sm-table-cell',
    'd-none d-sm-table-cell',
    'd-none d-md-table-cell',
    'd-none d-md-table-cell',
    'd-none d-md-table-cell',
];
const ALWAYS_VISIBLE_APPEARANCES = 1;
const MAX_APPEARANCES = ALWAYS_VISIBLE_APPEARANCES + APPEARANCE_COLUMN_BREAKPOINT_CLASSES.length;
function getTeshinOfferSchedule() {
    /* eslint-disable -- verbatim copy of updateTeshin() in live.ts */
    const EPOCH = 1736121600 * 1000;
    const week = Math.trunc((Date.now() - EPOCH) / 604800000);
    const teshinOffer = [
        "Umbra Forma Blueprint",
        "50,000x Kuva",
        "Kitgun Riven Mod",
        "3x Forma",
        "Zaw Riven Mod",
        "30,000x Endo",
        "Rifle Riven Mod",
        "Shotgun Riven Mod"
    ];
    /* eslint-enable */
    return { epoch: EPOCH, week, teshinOffer };
}
function formatWeekStart(epoch, week) {
    const weekStartMs = epoch + (week * 604_800_000);
    return new Date(weekStartMs).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}
export function renderTeshinForecastHeader(theadRow) {
    theadRow.innerHTML = '';
    const offerTh = document.createElement('th');
    offerTh.textContent = 'Offer';
    theadRow.append(offerTh);
    for (let appearance = 0; appearance < MAX_APPEARANCES; appearance++) {
        const th = document.createElement('th');
        th.textContent = appearance === 0 ? 'Next' : `+${appearance}`;
        if (appearance >= ALWAYS_VISIBLE_APPEARANCES) {
            th.className = APPEARANCE_COLUMN_BREAKPOINT_CLASSES[appearance - ALWAYS_VISIBLE_APPEARANCES];
        }
        theadRow.append(th);
    }
}
export function renderTeshinForecastTable(tbody) {
    const { epoch, week, teshinOffer } = getTeshinOfferSchedule();
    tbody.innerHTML = '';
    // Start the row order at this week's active offer so it's always the top row.
    const activeOfferIndex = ((week % teshinOffer.length) + teshinOffer.length) % teshinOffer.length;
    for (let i = 0; i < teshinOffer.length; i++) {
        const offerIndex = (activeOfferIndex + i) % teshinOffer.length;
        const offerName = teshinOffer[offerIndex];
        const tr = document.createElement('tr');
        const offerTd = document.createElement('td');
        offerTd.textContent = offerName;
        tr.append(offerTd);
        // Find the next `MAX_APPEARANCES` weeks (from the current week onward) where this offer appears.
        let offerWeek = week;
        while (offerWeek % teshinOffer.length !== offerIndex) {
            offerWeek++;
        }
        for (let appearance = 0; appearance < MAX_APPEARANCES; appearance++) {
            const td = document.createElement('td');
            td.textContent = formatWeekStart(epoch, offerWeek);
            if (appearance >= ALWAYS_VISIBLE_APPEARANCES) {
                td.className = APPEARANCE_COLUMN_BREAKPOINT_CLASSES[appearance - ALWAYS_VISIBLE_APPEARANCES];
            }
            tr.append(td);
            offerWeek += teshinOffer.length;
        }
        tbody.append(tr);
    }
}
//# sourceMappingURL=index.js.map