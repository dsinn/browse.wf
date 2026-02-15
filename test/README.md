# Testing Documentation

This project uses two complementary testing approaches:

1. **Unit Tests** (Vitest + jsdom) - Fast, structural tests for the `/live` page
2. **E2E Tests** (Playwright) - Real browser tests for behavioral validation

**Quick Links:**
- [Playwright Documentation](https://playwright.dev/docs/intro) - E2E testing reference
- [Quick Start Guide](QUICK_START.md) - Vitest quick reference
- [Test Coverage Summary](SUMMARY.md) - Detailed coverage information

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
│   ├── min.json
│   ├── bounty-cycle.json
│   ├── invasions.json
│   ├── arbys.txt
│   ├── dicts/
│   │   └── en.json        # Game text translations
│   └── ...
│
├── helpers/                # Shared test utilities
│   ├── api-mocks.ts       # Mock fetch setup & data loading
│   ├── domain-blocker.ts  # Production domain safeguards
│   ├── dom-helpers.ts     # DOM setup & query helpers
│   ├── time-helpers.ts    # Time-freezing utilities
│   └── ...
│
├── live/                   # Live page unit tests (Vitest)
│   ├── card-filters-factory.ts   # Test factory for card filter integration
│   │
│   ├── cards/             # Card-specific tests
│   │   ├── arbitration.test.ts
│   │   ├── bounties.test.ts
│   │   ├── invasions.test.ts
│   │   └── ...
│   │
│   └── integration/       # API validation, time-freezing, and user interactions
│       ├── api-integration.test.ts
│       ├── time-freezing.test.ts
│       └── ...
│
├── arbys/                  # Arbys page unit tests (Vitest)
│   └── arbys.test.ts      # Structural tests (HTML, data files)
│
├── setup.ts               # Global unit test setup
├── global-setup.ts        # Global test environment setup
├── api-validation.test.ts # API structure validation (run weekly)
├── safeguards.test.ts     # Production domain blocking tests
├── README.md              # This file
├── SUMMARY.md             # Test coverage details
├── QUICK_START.md         # Quick reference
└── update-mocks.sh        # Refresh mock data script

e2e/                        # E2E tests (Playwright)
├── helpers/               # E2E test utilities
│   └── api-mocks.ts       # Playwright route interception for API mocking
├── arbys.spec.ts          # Arbys page behavioral tests
└── live.spec.ts           # Live page behavioral tests
```

## Test Categories

- **Test Factories** (`live/`) - Reusable test generators
  - `card-filters-factory.ts` - Factory function that tests generic filter functionality for any card
  - Loads real compiled code from `typestripped/src/card-filters.js` (no test drift)
  - Cards with filters import and call `testCardFilters(cardName)` to verify correct integration
- **Card Tests** (`live/cards/`) - Verify each card renders correctly with mock data
  - `news.test.ts` - Calls `testCardFilters('news')` for filter integration
  - Other card tests - Smoke tests for specific game features (Arbitration, Bounties, Invasions, etc.)
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

**Principle:** Test the real compiled code from `typestripped/`, not mocked duplicates. This prevents test drift where tests pass but production is broken.

**For fork code** (`src/` modules): Load the compiled version using `loadScript()` helper. See `test/live/card-filters-factory.ts` for example.

**For upstream code** (`live.ts`, `index.ts`): Don't test behavior in unit tests - test integration points only. Use E2E tests for full behavior verification.

## Updating Mock Data

To refresh mock data with current game state:
```bash
./test/update-mocks.sh
```

This updates all mock files including the dictionary file (`dicts/en.json`), which contains game text translations used by E2E tests to properly display item names, mission types, and other localized content.

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
