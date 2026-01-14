# Live Page Tests

Automated tests for the `/live` page using Vitest and Testing Library.

## Setup

Install dependencies:
```bash
npm install
```

## Running Tests

```bash
# Run all tests
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
```

## Test Structure

```
test/
├── __mocks__/              # Real API responses (captured 2026-01-10)
│   ├── min.json
│   ├── bounty-cycle.json
│   ├── weekly.json
│   └── ...
│
├── helpers/                # Shared test utilities
│   ├── api-mocks.ts       # Mock fetch setup & data loading
│   ├── dom-helpers.ts     # DOM setup & query helpers
│   ├── time-helpers.ts    # Time-freezing utilities
│   └── ...
│
├── live/                   # Live page test suite
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
├── setup.ts               # Global test setup
├── README.md              # This file
├── SUMMARY.md             # Test coverage details
├── QUICK_START.md         # Quick reference
└── update-mocks.sh        # Refresh mock data script
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

## Writing New Tests

### Card Test Example
```typescript
// test/live/cards/my-card.test.ts
import { describe, test, expect } from 'vitest';
import { loadMock } from '../../helpers/api-mocks';
import { getById } from '../../helpers/dom-helpers';

describe('My Card', () => {
  test('renders data correctly', () => {
    const data = loadMock('worldState.json');
    const element = getById('my-element');

    element.textContent = data.someValue;

    expect(element.textContent).toBe('Expected Value');
  });
});
```

### Integration Test Example
```typescript
// test/live/integration/collapse.test.ts
import { describe, test, expect } from 'vitest';
import { getById } from '../../helpers/dom-helpers';

describe('Card Collapse', () => {
  test('clicking collapse button hides card', () => {
    const button = getById('collapse-button');
    const card = getById('card-body');

    button.click();

    expect(card.classList.contains('d-none')).toBe(true);
  });
});
```

## Testing Fork-Specific JavaScript

**Principle:** Test the real compiled code from `typestripped/`, not mocked duplicates. This prevents test drift where tests pass but production is broken.

**For fork code** (`src/` modules): Load the compiled version using `loadScript()` helper. See `test/live/card-filters-factory.ts` for example.

**For upstream code** (`live.ts`, `index.ts`): Don't test behavior in unit tests - test integration points only. Use E2E tests for full behavior verification.

## Updating Mock Data

To refresh mock data with current game state:
```bash
./test/update-mocks.sh
```

Or manually:
```bash
curl -s "https://oracle.browse.wf/min" > test/__mocks__/min.json
curl -s "https://oracle.browse.wf/bounty-cycle" > test/__mocks__/bounty-cycle.json
curl -s "https://oracle.browse.wf/weekly" > test/__mocks__/weekly.json
curl -s "https://oracle.browse.wf/worldState.json" > test/__mocks__/worldState.json
curl -s "https://oracle.browse.wf/invasions" > test/__mocks__/invasions.json
curl -s "https://browse.wf/arbys.txt" > test/__mocks__/arbys.txt
```

## CI/CD Integration

Tests can be run in CI with:

```yaml
- run: npm ci
- run: npm test -- --run
```

PHP fixtures are auto-generated before tests run (via `global-setup.ts`), so no separate fixture generation step is needed. The `--run` flag ensures tests run once and exit (no watch mode).

## Test Coverage

Tests verify:
- ✅ API responses have correct structure
- ✅ Data is parsed correctly from API responses
- ✅ DOM elements are populated with expected values
- ✅ Card-specific logic works (rotations, tiers, rewards, etc.)
- ✅ Time-dependent calculations use frozen timestamps

## Benefits of This Structure

- **Easy to navigate** - Tests organized by feature/card
- **Selective testing** - Run specific test suites
- **Reusable helpers** - Shared utilities for common tasks
- **Clear responsibility** - Each file has a single focus
