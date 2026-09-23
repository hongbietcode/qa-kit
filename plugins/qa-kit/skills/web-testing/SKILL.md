---
name: web-testing
description: "Use when automating manual test cases with Playwright, exploring an application to identify test coverage, or writing and maintaining browser, API, unit, integration, load, visual, and accessibility tests with Playwright, Vitest, or k6. Also use for flaky tests and cross-browser coverage."
argument-hint: "from-manual <file or pasted cases> [options] OR [test-type] [target]"
license: Apache-2.0
metadata:
  kit: qa-kit
  version: "3.1.0"
---

# Web Testing Skill

Comprehensive web testing: unit, integration, E2E, load, security, visual regression, accessibility.

## Manual cases → exploration → Playwright

When the user supplies manual cases and wants automation, use `from-manual`,
even if they describe the intent without the literal mode name. Read
[from-manual-workflow.md](references/from-manual-workflow.md) first. It owns the
pipeline; use other qa-kit skills only for a specific supporting task.

```text
$qa-kit:web-testing from-manual tests/manual/checkout.csv --url http://localhost:3000
/qa-kit:web-testing from-manual cases.xlsx --sheet Checkout --update
```

Accept Markdown, CSV, XLSX, or pasted text. Normalize source IDs and expected
results, explore the scoped application, write missing manual cases, generate
Playwright tests, run them, and report case-to-assertion coverage with evidence.
The input parser only extracts cases; the agent performs exploration and coding.

| Option | Meaning |
| --- | --- |
| `--url <url>` | Target URL; otherwise inspect project configuration |
| `--sheet <name>` | XLSX worksheet; ambiguous selection requires a choice |
| `--auth project\|browser\|manual` | Project-native setup (default), connected browser, or interactive login |
| `--output <dir>` | Test directory; otherwise follow the repository |
| `--explore-only` | Explore and write cases/reports; no automation code |
| `--dry-run` | Read-only analysis and proposed changes in chat; takes precedence over explore-only |
| `--update` | Reconcile existing tests by case ID and intent |

Read the [case schema](references/manual-test-case-schema.md) for ingestion,
[Playwright mapping](references/playwright-mapping.md) before generating code,
and [traceability format](references/traceability-report.md) for artifacts.
Keep original expectations separate from observed behavior. An unavailable
browser, a drafted test, or a passing subset is not a verified full suite.

## Quick Start

```bash
npx vitest run                    # Unit tests
npx playwright test               # E2E tests
npx playwright test --ui          # E2E with UI
k6 run load-test.js               # Load tests
npx @axe-core/cli https://example.com  # Accessibility
npx lighthouse https://example.com     # Performance
```

## Testing Strategy (Choose Your Model)

| Model | Structure | Best For |
|-------|-----------|----------|
| Pyramid | Unit 70% > Integration 20% > E2E 10% | Monoliths |
| Trophy | Integration-heavy | Modern SPAs |
| Honeycomb | Contract-centric | Microservices |

→ `./references/testing-pyramid-strategy.md`

## Reference Documentation

### Core Testing
- `./references/unit-integration-testing.md` - Vitest, browser mode, AAA
- `./references/e2e-testing-playwright.md` - Fixtures, sharding, selectors
- `./references/playwright-component-testing.md` - CT patterns (production-ready)
- `./references/component-testing.md` - React/Vue/Angular patterns

### Test Infrastructure
- `./references/test-data-management.md` - Factories, fixtures, seeding
- `./references/database-testing.md` - Testcontainers, transactions
- `./references/ci-cd-testing-workflows.md` - GitHub Actions, sharding
- `./references/contract-testing.md` - Pact, MSW patterns

### Cross-Browser & Mobile
- `./references/cross-browser-checklist.md` - Browser/device matrix
- `./references/mobile-gesture-testing.md` - Touch, swipe, orientation

### Performance & Quality
- `./references/performance-core-web-vitals.md` - LCP/CLS/INP, Lighthouse CI
- `./references/visual-regression.md` - Screenshot comparison
- `./references/test-flakiness-mitigation.md` - Stability strategies

### Accessibility & Security
- `./references/accessibility-testing.md` - WCAG, axe-core
- `./references/security-testing-overview.md` - OWASP Top 10
- `./references/security-checklists.md` - Auth, API, headers

### API & Load
- `./references/api-testing.md` - Supertest, GraphQL
- `./references/load-testing-k6.md` - k6 patterns

### Checklists
- `./references/pre-release-checklist.md` - Complete release checklist
- `./references/functional-testing-checklist.md` - Feature testing

## Scripts

Resolve script paths relative to this installed skill's directory, not the
target application's current directory. Run `node scripts/parse-manual-tests.mjs
--help` from this skill directory for the parser CLI. It uses Node 18+; XLSX
also requires Python 3.9+ and uses only its standard library.

### Initialize Playwright Project
```bash
node ./scripts/init-playwright.js [--ct] [--dir <path>]
```
Creates example configuration, fixtures, and tests. Inspect and adapt these
examples before use: they contain sample endpoints and credentials. For
`from-manual`, reuse the target project or author minimal verified setup instead
of running this generic scaffold.

### Analyze Test Results
```bash
node ./scripts/analyze-test-results.js \
  --playwright test-results/results.json \
  --vitest coverage/vitest.json \
  --output markdown
```
Parses Playwright/Vitest/JUnit results into unified summary.

## CI/CD Integration

```yaml
jobs:
  test:
    steps:
      - run: npm run test:unit      # Gate 1: Fast fail
      - run: npm run test:e2e       # Gate 2: After unit pass
      - run: npm run test:a11y      # Accessibility
      - run: npx lhci autorun       # Performance
```
