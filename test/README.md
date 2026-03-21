# Testing Documentation

This project uses two complementary testing approaches:

1. **Unit Tests** (Vitest + jsdom) - Fast, structural tests for the `/live` page
2. **E2E Tests** (Playwright) - Real browser tests for behavioral validation

**Quick Links:**
- [Playwright Documentation](https://playwright.dev/docs/intro) - E2E testing reference

## Setup

Install dependencies:
```bash
npm install
```

For E2E tests, Playwright browsers are installed automatically when running tests for the first time. To install manually:
```bash
npx playwright install chromium
```

## Running Tests

### Unit Tests (Vitest)

```bash
# Run all unit tests
npm test

# Run tests in watch mode (auto-rerun on changes)
npm test -- --watch

# Run tests with UI (visual browser interface)
npm run test:ui

# Run tests with coverage report
npm run test:coverage

# Run specific test suites
npm test -- test/live/cards          # Only card tests
npm test -- test/live/integration    # Only integration tests
npm test -- test/arbys               # Arbys page structural tests
```

### E2E Tests (Playwright)

```bash
# Run all E2E tests
npm run test:e2e

# Open Playwright UI (recommended for development)
npm run test:e2e:ui

# Debug tests with Playwright Inspector
npm run test:e2e:debug

# Run specific test file
npx playwright test e2e/arbys.spec.ts
```

### API Validation Tests (Vitest)

```bash
# Validate API structure (weekly/manual - hits real APIs)
npm run test:api-validation
```

## Test Structure

```
test/
├── __mocks__/              # Real API responses (captured 2026-01-10)
│   ├── bounty-cycle.json
│   ├── worldState.json
│   ├── worldState-invasions.json  # Minimal mock for invasion filter tests
│   ├── worldState-*.json          # Scenario-specific worldState variants
│   ├── dicts/
│   │   └── en.json        # Game text translations
│   └── ...
│
├── helpers/                # Shared test utilities
│   ├── api-mocks.ts       # Mock fetch setup & data loading
│   ├── domain-blocker.ts  # Production domain safeguards
│   ├── dom-helpers.ts     # DOM setup & query helpers
│   ├── fixture-loader.ts  # PHP fixture loading
│   ├── test-constants.ts  # Shared constants (MOCK_TIMESTAMP, etc.)
│   ├── time-helpers.ts    # Time-freezing utilities
│   └── ...
│
├── live/                   # Live page unit tests (Vitest)
│   ├── card-filters-factory.ts   # Test factory for card filter integration
│   ├── cards/             # Card-specific tests
│   └── integration/       # API validation, time-freezing, and user interactions
│
├── .../                    # Per-page unit test folders (arbys, cloud-sync, profile, etc.)
│
├── setup.ts               # Global unit test setup
├── global-setup.ts        # Global test environment setup
├── api-validation.test.ts # API structure validation (run weekly)
├── safeguards.test.ts     # Production domain blocking tests
├── README.md              # This file
└── update-mocks.sh        # Refresh mock data script

e2e/                        # E2E tests (Playwright)
├── helpers/               # E2E test utilities
│   └── api-mocks.ts       # Playwright route interception for API mocking
├── live/                  # Live page behavioral tests
├── profile/               # Profile page behavioral tests
└── *.spec.ts              # Top-level page tests (arbys, invigorations, weekly-forecast, etc.)
```

## Test Categories

- **Test Factories** (`live/`) - Reusable test generators
  - `card-filters-factory.ts` - Factory function that tests generic filter functionality for any card
  - Imports fork modules directly as TypeScript (no compiled output needed)
  - Cards with filters import and call `testCardFilters(cardName)` to verify correct integration
- **Card Tests** (`live/cards/`) - Verify each card renders correctly with mock data
  - `news.test.ts` - Calls `testCardFilters('news')` for filter integration
  - Other card tests - Smoke tests for specific game features (Bounties, Invasions, etc.)
- **Integration Tests** (`live/integration/`) - API validation, time-freezing, and user interactions
- **Structural Tests** (`arbys/`) - HTML structure and data file validation
- **E2E Tests** (`e2e/`) - Real browser behavioral tests with Playwright
  - Use mocked APIs for fast, deterministic testing
  - Verify user interactions, UI state, and localStorage persistence
- **API Validation Tests** (`test/api-validation.test.ts`) - Weekly structure validation (Vitest)
  - Hit real oracle.browse.wf APIs (not mocked)
  - Verify API response structure matches mock files
  - Detect "mock drift" when upstream APIs change
  - Run via `npm run test:api-validation` (not part of regular test suite)

## Production Domain Safeguards

Tests have built-in safeguards to prevent accidentally hitting production `browse.wf` domains:

**Protected domains:**
- `oracle.browse.wf` - Production API
- `browse.wf` - Main production domain
- `www.browse.wf` - WWW subdomain

**How it works:**
1. ✅ **Mocked endpoints** - Explicitly mocked URLs return mock data (defined in `test/helpers/api-mocks.ts` and `e2e/helpers/api-mocks.ts`)
2. ✅ **Image files** - Requests to `.png`, `.jpg`, `.webp`, etc. silently return empty responses (don't break tests)
3. ❌ **Other requests** - Non-image requests to production domains throw clear errors:
   ```
   TEST SAFEGUARD: Attempted to fetch from production domain: https://oracle.browse.wf/unknown
   Tests must never hit browse.wf domains. Use mocked data instead.
   ```

**Why this matters:**
- Prevents accidental production API calls
- Catches typos in URLs early
- Ensures tests work offline
- Makes tests fast and deterministic
- Prevents side effects on production

**Adding new mocked endpoints:**

For Vitest, edit `test/helpers/api-mocks.ts`:
```typescript
const mocks = {
  'https://oracle.browse.wf/new-endpoint': loadMock('new-mock.json'),
  // ... other mocks
};
```

For Playwright E2E, edit `e2e/helpers/api-mocks.ts`:
```typescript
// Load mock data
const mockData = JSON.parse(fs.readFileSync(path.join(mocksDir, 'new-mock.json'), 'utf8'));

// Register route
await page.route('**/oracle.browse.wf/new-endpoint', route => {
  route.fulfill({ status: 200, body: JSON.stringify(mockData) });
});
```

**Implementation:**
- `test/helpers/domain-blocker.ts` - Core validation logic
- `test/helpers/domain-blocker.test.ts` - Unit tests (17 tests)
- `test/safeguards.test.ts` - Integration tests (20 tests)

## Testing Fork-Specific JavaScript

**Principle:** Test the real production code, not mocked duplicates. This prevents test drift where tests pass but production is broken.

**For fork code** (`src/` modules): Import directly from the `.ts` source files. Vitest handles TypeScript natively — no compilation step needed. All fork modules are also bundled into a single IIFE (`src/bundle-entry.ts`) via esbuild for browser use, but tests import the `.ts` sources directly.

**For upstream code** (`live.ts`, `index.ts`): Don't test behavior in unit tests - test integration points only. Use E2E tests for full behavior verification.

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
- `loadCommonJsFunctions(names)` - Load upstream `common.js` functions into window scope

### `helpers/render-php.js`
- Renders PHP to HTML fixtures (runs automatically before tests)
- Uses shared `/helpers/php-server.js` module (also used by build script)

### `helpers/test-constants.ts`
- `MOCK_TIMESTAMP` - Constant for mock data time (re-exported from `time-helpers.ts`)
- `TEST_FRONT_PROXY_BASE_URL` - Front proxy URL for API validation tests

### `helpers/time-helpers.ts`
- `freezeTime(timestamp)` - Freeze time for tests
- `advanceTime(ms)` - Move frozen time forward
- `MOCK_TIMESTAMP` - Constant for mock data time

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

## Updating Mock Data

To refresh mock data with current game state:
```bash
./test/update-mocks.sh
```

This requires `WARFRAME_API_FRONT_PROXY_TOKEN` to be set (for worldState). It updates `bounty-cycle.json`, `worldState.json`, and `dicts/en.json`.

**Warning:** Mock data is tied to the world state at capture time. A full replacement will break tests expecting specific values.

Recommended approach:
1. Run `./test/update-mocks.sh` to fetch current data
2. Copy only the data you need from the new mocks
3. Revert the changes (`git checkout -- test/__mocks__/`)
4. Paste the copied data into the appropriate place
5. Run `npm test` to verify

Alternatively, update all test expectations to match the new data, and update the capture date in the `__mocks__` directory comment above.

## CI/CD Integration

### Unit Tests
```yaml
- run: npm ci
- run: npm test -- --run
```

### E2E Tests
```yaml
- run: npm ci
- run: npx playwright install --with-deps chromium
- run: npm run test:e2e
```

### API Validation (Weekly)
```yaml
# Runs weekly via .github/workflows/api-validation.yml
- run: npm ci
- run: npm run test:api-validation
```

**Notes:**
- PHP fixtures are auto-generated before unit tests run (via `global-setup.ts`), so no separate fixture generation step is needed
- The `--run` flag ensures tests run once and exit (no watch mode)
- E2E tests use mocks for fast, deterministic testing
- API validation tests hit real APIs to detect mock drift - run weekly, not on every commit
- Playwright automatically starts a PHP development server on port 61969 before running tests and stops it when done (configured in `playwright.config.ts`)
