# From-manual artifacts and reporting

Use the target project's report convention (`plans/reports/` when established,
otherwise `qa-reports/`). Put each run's detailed artifacts in a uniquely named
`web-testing-{YYMMDD-HHmm}-{slug}/` directory, with the summary named
`web-testing-{YYMMDD-HHmm}-{slug}.md` beside it. Avoid overwriting an earlier run;
add a suffix for collisions. `--output` affects tests, not the report location.

| Artifact | Contents |
| --- | --- |
| `normalized-cases.json` | Redacted schemaVersion 1 extraction, refined classifications, diagnostics and provenance |
| `manual-cases.md` | Original cases plus newly written cases, steps, data, expected results and expectation sources |
| `exploration.md` | Environment/role, observed flows, locator evidence, expected/actual differences and blockers |
| `traceability.json` | Case-to-test-to-assertion mappings and real execution evidence |
| screenshots / traces | Task-scoped evidence, redacted before sharing |

Explore-only writes these artifacts with no generated specs and execution `Not
run`. Dry-run prints the proposed cases/mappings/file changes in chat; it writes
none of these artifacts. Never include credentials or persisted authentication
state in report attachments.

## Traceability structure

```json
{
  "schemaVersion": 1,
  "cases": [{
    "caseId": "TC-CART-01",
    "source": {"path": "cases.csv", "row": 2},
    "classification": "Automate",
    "tests": [{
      "file": "tests/e2e/cart.spec.ts",
      "title": "Cart [TC-CART-01] removes last item",
      "project": "chromium",
      "variant": "single-product",
      "assertions": [
        {"expectedResult": 1, "check": "empty-cart status text"},
        {"expectedResult": 2, "check": "checkout disabled"}
      ],
      "execution": "Not run",
      "attempts": [],
      "evidence": []
    }],
    "uncoveredExpectedResults": [],
    "reason": "Prepared; execution pending"
  }]
}
```

The example is intentionally unexecuted. Replace it with actual titles, projects,
observations and attempts. Cases without specs have `tests: []` and a reason.
Duplicate IDs retain source row/sheet identity until resolved. A test can appear
under several cases only if its explicit assertions cover each cited result.

Execution vocabulary: `Passed`, `Failed`, `Flaky`, `Skipped`, `Not run`, `Blocked`,
`Expected failure`. Track failure kind separately: `test`, `product`, `environment`,
or `unresolved`. Include command, environment, timestamp, project and exit code
for each actual run; evidence links must refer to files or captured tool output
that really exist. Report all attempts and original failures, including reruns.

## Summary shape

1. Outcome: what was automated and verified; what remains outstanding.
2. Inputs and scope: source files/sheet, application origin, role, selected mode.
3. Quality review: missing details, duplicate cases/IDs, preserved ambiguities.
4. Manual cases: added IDs and why they protect distinct behavior.
5. Mapping table: source ID/location, classification, test/variant, outcomes
   covered, run result, evidence or blocker.
6. Validation: exact commands, attempts, selected projects, actual result counts.
7. Defects/blockers: expected vs observed, reproduction and next action.
8. Changed files and commands the user can run again.

State separate counts for source cases, discovered cases, automated cases,
fully asserted cases and execution results. Fully verified coverage requires
all expected outcomes and required variants/projects to pass. Failed, flaky,
skipped, partial and unexecuted cases cannot increase that count. Do not substitute
source-line coverage, test count or a synthetic score for manual-case coverage.
