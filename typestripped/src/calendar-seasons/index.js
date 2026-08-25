/**
 * Calendar Seasons rendering for the live page and weekly-forecast page.
 * Displays the 1999 in-game calendar days with challenges, rewards, and upgrades.
 */
import { formatSeasonDay, resolveCalendarSeasonDays } from './data.js';
function makeIcon(iconPath) {
    const img = document.createElement('img');
    img.style.height = '24px';
    img.style.width = '24px';
    img.style.objectFit = 'contain';
    img.alt = '';
    setImageSource(img, iconPath);
    return img;
}
/**
 * Renders the content pane for a single calendar season.
 * Returns a div containing day rows for each day with events.
 */
export async function renderCalendarSeasonPane(season) {
    const dict = await getDictPromise();
    const resolvedDays = await resolveCalendarSeasonDays(season, dict);
    const container = document.createElement('div');
    for (const dayData of resolvedDays) {
        // Two-column layout on md+: date label on left, events stacked on right
        const row = document.createElement('div');
        row.className = 'd-md-flex mb-3 calendar-season-event';
        row.dataset.eventType = dayData.events[0].type;
        const dateCol = document.createElement('div');
        dateCol.className = 'fw-bold small me-3 calendar-season-date';
        dateCol.textContent = `${dayData.events[0]?.emoji ?? ''} ${formatSeasonDay(dayData.day)}`;
        row.append(dateCol);
        const eventsCol = document.createElement('div');
        eventsCol.className = 'flex-grow-1';
        for (const event of dayData.events) {
            const eventRow = document.createElement('div');
            eventRow.className = 'd-flex align-items-start gap-2 mb-1';
            if (event.iconPath) {
                eventRow.append(makeIcon(event.iconPath));
            }
            else if (event.type === 'CET_UPGRADE') {
                const icon = document.createElement('span');
                icon.textContent = '✨';
                eventRow.append(icon);
            }
            const span = document.createElement('span');
            span.textContent = event.text;
            eventRow.append(span);
            eventsCol.append(eventRow);
        }
        row.append(eventsCol);
        container.append(row);
    }
    return container;
}
window.renderCalendarSeasonPane = renderCalendarSeasonPane;
//# sourceMappingURL=index.js.map