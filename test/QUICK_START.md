# Quick Start Guide - /live Page Tests

## Installation

```bash
npm install
```

## Run Tests

```bash
npm test
```

Expected output:
```
✓ test/live/cards/darvo.test.ts
✓ test/live/cards/arbitration.test.ts
✓ test/live/cards/sortie.test.ts
✓ test/live/cards/archon-hunt.test.ts
✓ test/live/cards/bounties.test.ts
✓ test/live/cards/invasions.test.ts
✓ test/live/cards/archimedea.test.ts
✓ test/live/integration/time-freezing.test.ts
✓ test/live/integration/api-integration.test.ts

Test Files  passed
     Tests  passed
```

## Visual Test UI

```bash
npm run test:ui
```

Opens browser with visual test interface for interactive development.

## Test Structure

```
test/
├── __mocks__/              # Real API responses (captured 2026-01-10)
│   ├── bounty-cycle.json
│   ├── worldState.json
│   └── arbys.txt
├── live/
│   ├── cards/             # Card smoke tests
│   └── integration/       # API validation, time-freezing, and user interactions
├── helpers/               # Shared test utilities
├── setup.ts               # Global test setup
└── update-mocks.sh        # Refresh mock data script
```

## What's Tested

- **Card Tests** - Darvo, Arbitration, Sortie, Archon Hunt, Bounties, Invasions, Archimedea
- **Integration Tests** - API structure, time-freezing

## Update Mock Data

When oracle.browse.wf data changes:

```bash
./test/update-mocks.sh
npm test  # Verify still passing
```

## Common Commands

```bash
# Watch mode (auto-rerun)
npm test -- --watch

# Single test file
npm test -- live.test.ts

# Specific test pattern
npm test -- -t "Darvo"

# Coverage report
npm run test:coverage
```

## Troubleshooting

**Tests fail after mock update?**
- Check if API response structure changed
- Update test expectations accordingly

**"Cannot find module" error?**
```bash
npm install
```

**Tests timeout?**
- Mock data might be loading slowly
- Check test/setup.ts fetch mocks

## Next Steps

Consider adding to CI/CD (.github/workflows/check.yml) or expand coverage with interaction tests.
