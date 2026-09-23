# Playwright From Manual Implementation Plan

**Goal:** Extend `web-testing from-manual` with manual-case ingestion, grounded
exploration, coverage expansion, Playwright generation, and bilingual guidance.

**Spec:** [Approved design](../specs/2026-09-23-playwright-from-manual-design.md).
The user authorized the full design and implementation, including documentation.
Proceed through implementation and review without additional design gates.

**Architecture:** Keep the existing skill as the entry point. Separate deterministic
parsing from agent-led exploration and generation. Use Node's standard library
for text inputs and a Python standard-library XLSX reader to avoid installing
spreadsheet dependencies in user projects.

## Shared contract

- Skill options: `--url`, `--sheet`, `--auth project|browser|manual`, `--output`,
  `--explore-only`, `--dry-run`, `--update`.
- Parser: `node scripts/parse-manual-tests.mjs <file>` or `--text <text>` or
  `--stdin --format markdown|csv|text`, optional `--sheet`. JSON to stdout;
  exit 0 when readable (diagnostics may still block individual cases), 1 when
  invalid input/options or unreadable/ambiguous workbook prevent parsing.
- Envelope: `{schemaVersion: 1, source: {kind, path?, sheet?}, cases, diagnostics}`.
- Case: `{id, title, source, preconditions: [], steps: [{action, data?, expected?}],
  data: [], expectedResults: [], priority, tags: [], automationStatus,
  automationReason, discovered: false, metadata: {}}`.
- Parser status is `Needs clarification` for missing essentials/conflicting IDs;
  otherwise `Blocked` pending live exploration. Only the workflow promotes to
  `Automate`; parsing is never evidence of execution or automation readiness.
- Diagnostics: `{code, severity, message, caseId?, row?}`. Preserve raw rows and
  field text in source/metadata; never invent expected behavior or silently merge
  duplicate IDs. Unknown formats are retained as unstructured text for review.
- Modes: dry-run means read-only analysis, no browsing side effects or repo
  writes; explore-only can browse within supplied scope and write QA reports,
  but creates no automation. Dry-run wins when both flags are present.

## Review focus

1. Quoted multiline CSV, Vietnamese headers, repeated export rows: preserve data.
2. Workbook selection/formulas: refuse ambiguity; never execute formulas.
3. App/expected-result disagreement: preserve expected behavior, report a defect.
4. Existing tests and duplicate IDs: avoid overwrite and false coverage claims.
5. Missing browser/auth: analysis remains useful but tests remain unverified.

## Task 1 — Input parser (delegated)

Files: `plugins/qa-kit/skills/web-testing/scripts/parse-manual-tests.mjs`,
`read-xlsx.py`, and `tests/` beside the scripts, including input fixtures.

- [x] Write CLI behavioral tests with literal expected IDs, actions, diagnostics,
  exit codes, and malformed-input outcomes; observe failures before implementation.
- [x] Implement Markdown tables/structured blocks, CSV, inline/pasted text, XLSX
  including sheet selection and source row provenance using the shared contract.
- [x] Run `node --test plugins/qa-kit/skills/web-testing/tests/*.test.mjs`.

## Task 2 — Workflow and Playwright guidance (main agent)

Files: `web-testing/SKILL.md`, four references specified in the design,
`e2e-testing-playwright.md`, `test-flakiness-mitigation.md` and routing references
in `scenario`, `test`, `agent-browser`, `agents/tester.md` where relevant.

- [x] Evaluate the existing skill on a realistic manual input and record gaps.
- [x] Add concise routing and workflow for all accepted modes and shared schema.
- [x] Define durable IDs, many-to-many assertion mapping, exploration evidence,
  generated manual cases, confidence, bounded repair, and honest run statuses.
- [x] Fix concrete invalid Playwright API examples in references consumed here.
- [x] Forward-test the workflow with an independent agent and address findings.

## Task 3 — Documentation and discovery (delegated)

Files: `README.md`, `docs/huong-dan-playwright-tu-test-case-thu-cong.md`,
both plugin manifests and Claude marketplace entry.

- [x] Explain both runtimes, prerequisites, input examples, all flags, auth,
  output artifacts, parser commands, updating automation, and troubleshooting.
- [x] Add a comprehensive Vietnamese guide linked from README.
- [x] Bump plugin versions from 0.1.0 to 0.2.0 consistently; expose from-manual
  in descriptions/default prompt while retaining the nine existing skills.

## Task 4 — Integration verification

- [x] Run the complete parser suite and read outputs against real fixtures.
- [x] Run plugin strict validation and skill validation where supported.
- [x] Check reference paths, documentation commands and manifests for consistency.
- [x] Test installation/discovery with isolated runtime configuration if the local
  CLI supports it; report limits without altering installed user plugins.
- [x] Obtain a fresh independent code/contract review, fix consequential issues,
  and rerun checks affected by those changes.
- [x] Hand off the implementation with usage, evidence and limits. No publish/push.

## Verification record

- Baseline evaluation: the existing skill lacked the mode, normalization contract,
  readiness states, duplicate-ID handling and persistent traceability. Its generic
  instructions did not force unsafe behavior, but left this workflow undefined.
- Forward evaluation: independent dry-run and normal-mode/browser-unavailable
  scenarios preserved source expectations, withheld unsupported mappings and
  runnable tests, and reported missing information and execution honestly.
- Parser: 46 behavioral CLI tests pass, including real generated XLSX archives.
  Regressions cover colon/list/fenced content, step-number columns, ambiguous
  identities, Vietnamese templates, formulas, cell errors and numeric display
  formats. Original failures were observed before the corresponding fixes.
- Native Claude strict validation passes for both marketplace and plugin
  manifests. This CLI returns empty content-validation results, so it does not
  establish skill behavior. Ruby YAML parsing checked all 13 skill/agent
  frontmatters; the generic Python skill checker could not run because PyYAML
  is absent. No dependency was installed just for that checker.
- Fresh isolated Codex installation reports version 0.2.0, discovers the updated
  `qa-kit:web-testing` trigger, and runs XLSX parsing from the installed cache.
  Both installed parser files match the repository bytes. Real user configuration
  was not changed and no model-backed `codex exec` was required.
- Six guide input examples parse successfully; changed Markdown links resolve;
  Node syntax and `git diff --check` pass. Independent final review found no
  remaining actionable issues after rerunning 46 tests and five extra repros.
- No target application or credentials were supplied. Live exploration and
  generated Playwright execution against a real application were not performed.
  The deliverable is the skill workflow, parser, regression suite and documentation.
