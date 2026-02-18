import { test } from '@playwright/test';
import { setupMockRoutes } from '../helpers/api-mocks';

test.describe('Live Page - 1999 Calendar Card', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/live.php');
    await page.waitForSelector('#arby-what:not(:has-text("Loading..."))', { timeout: 10000 });
  });

  test.describe('Card Structure', () => {
    test.skip();
    // card header shows "1999 Calendar"
    // collapse toggle is present in header
    // completion toggle checkbox is present in header
    // card body is visible initially
    // card is in the col-xl-4 column (above Baro)
  });

  test.describe('Collapse', () => {
    test.skip();
    // clicking collapse toggle hides card body
    // clicking collapse toggle again shows card body
  });

  test.describe('Completion Toggle', () => {
    test.skip();
    // completion toggle is clickable
    // clicking marks it as completed (bi-check-square icon)
    // clicking again unmarks it (bi-square icon)
    // state persists in localStorage
  });

  test.describe('Day Rows', () => {
    test.skip();
    // renders at least one day row
    // days with no events are not rendered
    // date column shows emoji prefix (📋, 🎁, or 🔧) followed by a date
    // date is formatted as a 1999 calendar date (e.g. "Oct 6")
    // date uses text-primary-emphasis class
    // on xl viewport, date column is inline (d-xl-flex row)
    // on smaller viewports, date column stacks above events
  });

  test.describe('Challenge Events', () => {
    test.skip();
    // challenge rows show an icon image
    // icon src uses content.warframe.com URL
    // falls back to browse.wf URL when content.warframe.com fails
    // challenge description text includes the required count (e.g. "Kill 250 Enemies")
    // challengeData.name is NOT rendered
  });

  test.describe('Reward Events', () => {
    test.skip();
    // reward rows show an icon image when one is available
    // reward name is shown (from dict lookup or camelCase fallback)
    // icon src uses content.warframe.com URL
    // falls back to browse.wf URL when content.warframe.com fails
  });

  test.describe('Upgrade Events', () => {
    test.skip();
    // upgrade rows show ✨ prefix
    // upgrade name is derived from camelCase path tail
  });
});
