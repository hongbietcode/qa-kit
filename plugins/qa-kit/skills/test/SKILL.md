---
name: test
description: "Run unit, integration, e2e, and UI tests, and create, optimize, or audit test suites. Use for test execution, coverage analysis, build verification, visual regression, and QA reports."
when_to_use: "Invoke for running or designing validation suites."
argument-hint: "[context] OR ui [url] OR create|optimize|audit [scope] [--advice] [--ultra] [--interview]"
metadata:
  kit: qa-kit
  version: "1.1.1"
---

# Testing & Quality Assurance

Comprehensive testing framework covering code-level testing (unit, integration, e2e), UI/visual testing via browser automation, coverage analysis, and structured QA reporting.

## Default (No Arguments)

If invoked with context (test scope), proceed with testing. If invoked WITHOUT arguments, ask the user which operation to run (use the runtime's question tool when it has one, otherwise ask in chat):

| Operation | Description |
|-----------|-------------|
| `(default)` | Run unit/integration/e2e tests |
| `ui` | Run UI tests on a website |
| `create` | Scout the codebase + docs, then create a covering test suite |
| `optimize` | Parallel-scout CI/CD, git history, codebase + docs, then cut test cost/time safely |
| `audit` | Parallel-scout the suite + CI, detect deceptive/weak tests, then repair |

Present them as options with header "Test Operation" and question "What would you like to do?".

## Core Principle

**NEVER IGNORE FAILING TESTS.** Fix root causes, not symptoms. No mocks/cheats/tricks to pass builds.

## When to Use

- **After implementation**: Validate new features or bug fixes
- **Coverage checks**: Ensure coverage meets project thresholds (80%+)
- **UI verification**: Visual regression, responsive layout, accessibility
- **Build validation**: Verify build process, dependencies, CI/CD compatibility
- **Pre-commit/push**: Final quality gate

## Workflows

### 1. Code Testing (`references/test-execution-workflow.md`)

Execute test suites, analyze results, generate coverage. Supports JS/TS (Jest/Vitest/Mocha), Python (pytest), Go, Rust, Flutter. Includes working process, quality standards, and tool commands.

**Load when:** Running unit/integration/e2e tests, checking coverage, validating builds

### 2. UI Testing (`references/ui-testing-workflow.md`)

Browser-based visual testing via the `agent-browser` skill, a browser tool attached to the user's real Chrome profile, the `web-testing` skill, or project-native Playwright/Vitest/k6 commands. Covers screenshots, responsive checks, accessibility audits, form automation, and console error collection.

**Load when:** Visual regression testing, UI bugs, responsive layout checks, accessibility audits

### 3. Report Format (`references/report-format.md`)

Structured QA report template: test results overview, coverage metrics, failed tests, performance, build status, recommendations.

**Load when:** Generating test summary reports

### 4. Suite Creation (`references/create-suite-workflow.md`)

`create`: scout the codebase and docs with read-only search (parallel Explore
subagents when the runtime supports them), map features and workflows to a
coverage matrix, then design and implement a test suite that covers them. A
scenario table from the `scenario` skill is a valid coverage input.

**Load when:** `create` argument — bootstrapping or extending a test suite

### 5. Suite Optimization (`references/optimize-suite-workflow.md`)

`optimize`: multiple parallel read-only scout subagents analyze CI/CD workflows,
git history, codebase, and docs, then restructure tests for speed at equal
safety — parallel lanes, change-based test selection, docs-only skips. Goal:
lower CI cost, faster ships, no lost coverage.

**Load when:** `optimize` argument — CI too slow/expensive, suite growth pains

### 6. Suite Audit (`references/audit-suite-workflow.md`)

`audit`: multiple parallel read-only scout subagents analyze the test suite and
CI/CD workflows, detect deceptive or weak tests (tests written only to pass,
commented-out/skipped tests, unfinished tests, redundant or outdated tests,
security gaps), then fix and apply the improvements.

**Load when:** `audit` argument — trust or quality concerns about the suite

## Quick Reference

```
Code tests     → test-execution-workflow.md
  npm test / pytest / go test / cargo test / flutter test
  Coverage: npm run test:coverage / pytest --cov

UI tests       → ui-testing-workflow.md
  Screenshots, responsive, a11y, forms, console errors
  Auth: real-Chrome-profile browser tool for user login/cookies, or project-native test setup

Reports        → report-format.md
  Structured QA summary with metrics & recommendations
```

## Working Process

1. Identify testing scope from recent changes or requirements
2. Run typecheck/analyze commands to catch syntax errors first
3. Execute appropriate test suites
4. Analyze results — focus on failures
5. Generate coverage reports if applicable
6. For frontend: run UI tests via `agent-browser`, a real-Chrome-profile browser tool, `web-testing`, or project-native browser tests
7. Produce structured summary report

## Tools Integration

- **Test runners**: Jest, Vitest, Mocha, pytest, go test, cargo test, flutter test
- **Coverage**: Istanbul/c8/nyc, pytest-cov, go cover
- **Browser**: the `agent-browser` skill for live browser interaction without real user cookies; a browser tool attached to the user's real Chrome profile (Claude in Chrome, Chrome DevTools MCP, or the Codex Chrome plugin) when the test needs their login state; the `web-testing` skill or project-native Playwright/Vitest/k6 for repeatable UI tests
- **Analysis**: read screenshots with the runtime's image-capable file reader
- **Debugging**: the `debug` skill (or the `debugger` agent) when tests reveal bugs requiring investigation
- **Thinking**: break complex test failures into explicit sequential steps, revising earlier steps when new evidence contradicts them

## Quality Standards

- All critical paths must have test coverage
- Validate happy path AND error scenarios
- Ensure test isolation — no interdependencies
- Tests must be deterministic and reproducible
- Clean up test data after execution
- Never ignore failing tests to pass the build

## Report Output

Save reports in the project's existing reports folder (for example
`plans/reports/`); when none exists, use `qa-reports/` at the repository root.
Name files `test-{YYMMDD-HHmm}-{slug}.md` and keep screenshots beside the report.

## Team Mode

When operating as teammate:
1. Discover the live task-management surface and the live team-coordination surface
2. Claim the assigned or next unblocked item when supported; otherwise read and update the active plan
3. Read the full work description before starting and wait for implementation prerequisites
4. Respect file ownership — only create/edit test files assigned
5. When done, record completion and report results through the live team surface

Plan files are the durable source of truth when runtime task tracking is absent
or session-scoped.

## Workflow Position

**Typically follows:** `scenario` (test targets from edge cases), implementation work, or a bug fix
**Typically precedes:** code review — the `code-reviewer` agent reviews after tests pass
**Related:** `web-testing` (write automation), `agent-browser` (exploratory QA), `debug` (diagnose failures)

## Flags (create / optimize / audit)

- `--advice` — run under advisory supervision (see below).
- `--ultra` — run the analysis/design step as a best-of-5 verifier pass (see
  Ultra Verifier Mode).
- `--interview` — before applying any change, list every proposed change
  (tests added/removed/rewritten, CI workflow edits) with a one-line reason and
  interview the user — one decision per change group;
  apply only the approved changes. Without `--interview`, apply directly but
  still report the full change list.

## Advisory supervision (`--advice`)

When `--advice` is present, run this skill under an advisory supervisor: one
read-only subagent on the strongest model the runtime offers (in Claude Code,
set the subagent model to the top tier; in Codex, use the highest reasoning
effort). The supervisor returns counsel, never code, and the main agent stays
responsible for every decision, edit, and gate.

Consult the supervisor at these checkpoints: after the scout/analysis phase
(pass the coverage matrix or findings and ask for a go/no-go plus the top risk);
before applying suite or CI workflow changes (pass the proposed change list);
and when stuck. Each prompt carries the task, the evidence, approaches tried,
and the exact question. If the runtime cannot spawn subagents, say so and
continue without `--advice`. `--advice` never bypasses the failing-test rules or
CI safety gates.

## Ultra Verifier Mode (`--ultra`)

When `--ultra` is present with `create`, `optimize`, or `audit`, run the
analysis/design step as a best-of-5 verifier pass: one immutable evidence
packet (scout reports, CI timings, git history summary), exactly five
independent read-only candidates in one parallel wave, one strongest-model
verifier.

- `create`/`optimize`: the verifier selects the single winning suite design or
  optimization plan unchanged (or rejects all); implementation runs once from
  the winner.
- `audit`: the verifier returns the
  evidence-validated, deduplicated union of audit findings across the five
  candidates — a real deceptive test may be caught by only one candidate;
  repairs run once on the union.

Full mechanics are in `../brainstorm/references/ultra-verifier-mode.md`. It
is a best-of-5 verifier mode inspired by LLM-as-a-Verifier, not the full
framework. `--ultra` composes with `--advice` and `--interview`.
