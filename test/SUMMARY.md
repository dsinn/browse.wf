# Test Suite Summary

## What Was Created

A comprehensive, well-organized test suite for the `/live` page with real API mock data and a scalable structure.

## PHP Fixture Integration

Tests use actual PHP-rendered HTML instead of manual DOM duplication. The `render-php.js` script generates HTML fixtures from PHP files, and `global-setup.ts` ensures fixtures are up-to-date before tests run. In watch mode, PHP file changes automatically trigger fixture regeneration, then Vitest re-runs tests with the fresh HTML. This prevents test HTML from drifting away from production PHP output.

**Note:** Fixtures are not committed to the repo. They're auto-generated before tests run.

## Test Structure

### Directory Organization

```
test/
├── __mocks__/              # API mock data
├── helpers/                # Shared utilities
├── live/
│   ├── cards/             # Card smoke tests
│   └── integration/       # API validation, time-freezing, and user interactions
├── setup.ts               # Global test configuration
└── *.md                   # Documentation
```

### Test Organization

- **Card Tests** (`live/cards/`) - Verify each card renders correctly with mock data
- **Integration Tests** (`live/integration/`) - API validation, time-freezing, and user interactions

## Shared Helper Utilities

### `helpers/api-mocks.ts`
- `loadMock(filename)` - Load mock data from files
- `setupMockFetch()` - Mock all API endpoints
- `mockEndpoint(url, data)` - Mock specific endpoint
- `mockEndpointError(url, status)` - Mock failed response

### `helpers/fixture-loader.ts`
- `loadFixture(name)` - Load pre-rendered PHP HTML for tests
- Fixtures auto-regenerate via `global-setup.ts`

### `helpers/dom-helpers.ts`
- `mockBootstrapTooltip()` - Mock Bootstrap tooltip for testing
- `getById<T>(id)` - Type-safe element query
- `elementExists(id)` - Check element presence

### `helpers/render-php.js`
- Renders PHP to HTML fixtures (runs automatically before tests)
- Uses shared `/helpers/php-server.js` module (also used by build script)

### `helpers/time-helpers.ts`
- `freezeTime(timestamp)` - Freeze time for tests
- `advanceTime(ms)` - Move frozen time forward
- `MOCK_TIMESTAMP` - Constant for mock data time

## Mock Data Files

Captured on **2026-01-10 ~12:00 UTC**:

| File | Description |
|------|-------------|
| `min.json` | Game state metadata |
| `bounty-cycle.json` | Current bounty rotations |
| `worldState.json` | Complete world state |
| `invasions.json` | Invasion conflicts |
| `arbys.txt` | Arbitration schedule |


## Adding New Tests

### Adding New Card Tests
1. Create `test/live/cards/my-card.test.ts`
2. Import helpers: `loadMock`, `getById`
3. Write tests following existing patterns
4. Tests automatically run with suite

### Adding Integration Tests
1. Create `test/live/integration/feature.test.ts`
2. Import helpers: `getById`
3. Simulate user actions (clicks, input)
4. Verify DOM updates correctly

### Updating Mock Data

**Warning:** Mock data is tied to the world state at capture time. A full replacement will break tests expecting specific values.

Recommended approach:
1. Run `./test/update-mocks.sh` to fetch current data
2. Copy only the data you need from the new mocks
3. Revert the changes (`git checkout -- test/__mocks__/`)
4. Paste the copied data into the appropriate place
5. Run `npm test` to verify

Alternatively, update all test expectations to match the new data, and update the timestamp in the "Mock Data Files" section above.

