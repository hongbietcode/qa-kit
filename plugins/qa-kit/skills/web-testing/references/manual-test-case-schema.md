# Manual case input and normalized schema

## Parser interface

Requires Node 18+. XLSX additionally requires `python3` (3.9+) with its standard
library; no packages are installed. Run the script through Node from the skill
directory or use its absolute installed path. Inputs remain in the target repo.

```bash
node scripts/parse-manual-tests.mjs cases.md
node scripts/parse-manual-tests.mjs cases.csv
node scripts/parse-manual-tests.mjs cases.xlsx --sheet Checkout
node scripts/parse-manual-tests.mjs --text 'TC01: Guest checkout'
node scripts/parse-manual-tests.mjs --stdin --format csv
```

The last command consumes standard input. `--help` lists supported parser flags.
Skill flags such as `--url`, `--auth`, `--dry-run`, `--update`, and `--output` are
handled by the agent, never forwarded to the parser. Successful extraction emits
JSON to stdout and saves no artifacts. Exit 0 means extraction succeeded, not
that cases are automation-ready. Exit 1 means input/options could not be
processed; fatal diagnostics are JSON on stderr and stdout remains empty.

## Supported shapes

CSV and XLSX use a header row and one case per subsequent row. Markdown accepts
a pipe table or labeled fields under a case heading. Columns use common English
or Vietnamese aliases; retain unmapped columns under metadata. Prefer these:

| Meaning | English | Vietnamese |
| --- | --- | --- |
| Identity | ID, Test Case ID | Mã TC |
| Behavior | Title, Test Case | Tiêu đề |
| Setup | Preconditions | Điều kiện tiên quyết |
| Actions | Steps | Các bước |
| Inputs | Test Data, Data | Dữ liệu |
| Outcomes | Expected Result, Expected Results | Kết quả mong đợi |
| Risk | Priority | Ưu tiên |

Example table (literal `<br>` separates actions within a Markdown cell):

```markdown
| ID | Title | Preconditions | Steps | Test Data | Expected Result |
| --- | --- | --- | --- | --- | --- |
| TC-CART-01 | Remove last item | Cart contains one seeded item | Open cart<br>Remove item | Single seeded product | Empty cart message<br>Checkout disabled |
```

Use quoted CSV fields for commas, quotes or newlines. Store numbers, product
codes, leading zeros, Unicode and multiline expectations as text when their exact
representation matters. The XLSX reader preserves stored cell values, not Excel's
formatted display: numeric `12` formatted as `00012` stays `12`, and a numeric
date may remain a serial number. Review typed/style diagnostics; use text cells
or a verified CSV export for display-sensitive values. Do not split arbitrary
punctuation inside test data. Formula cells require review; the reader
does not calculate formulas or treat a cached result as trusted input. Multiple
populated worksheets require `--sheet`. Old `.xls`, macros, encrypted workbooks,
merged-cell layouts, multi-row export schemas and arbitrary proprietary exports
are not promised interchangeable support: inspect diagnostics and source data,
normalize explicitly or request a simple tabular export. No input is executed.

Pasted plain text may lack a recognizable structure. The parser preserves it in
an unresolved record. The agent can extract explicit facts into the same schema,
but must retain source linkage and flag omitted/ambiguous fields.

## JSON contract (schemaVersion 1)

```json
{
  "schemaVersion": 1,
  "source": {"kind": "csv", "path": "cases.csv"},
  "cases": [
    {
      "id": "TC-CART-01",
      "title": "Remove last item",
      "source": {"kind": "csv", "path": "cases.csv", "row": 2},
      "preconditions": ["Cart contains one seeded item"],
      "steps": [{"action": "Open cart"}, {"action": "Remove item"}],
      "data": ["Single seeded product"],
      "expectedResults": ["Empty cart message", "Checkout disabled"],
      "priority": "",
      "tags": [],
      "automationStatus": "Blocked",
      "automationReason": "Pending live exploration and automation assessment",
      "discovered": false,
      "metadata": {}
    }
  ],
  "diagnostics": []
}
```

`source` additionally preserves raw text or tabular `headers`/`values` and may
contain `sheet`. `metadata.unknownColumns` retains unmapped header/value pairs,
including repeated headers. Steps can carry `data` and `expected` for per-step
outcomes; when refining a tabular export, preserve the relationship, not just the
flat list of outcomes. Diagnostics carry `code`, `severity`, `message`, and
optional `caseId`/`row`. Inspect their exact messages; codes are machine-readable
reasons, not executable instructions.

Missing essentials and conflicting source IDs become `Needs clarification`.
Complete parsed cases start `Blocked` pending exploration. The parser cannot
decide whether business expectations are sufficiently precise, classify CAPTCHA,
or claim selectors are verified; those decisions belong to the agent.

Semicolons in steps/data/outcomes are preserved by the parser. During semantic
review, the agent may split a composite expectation into separately mapped
outcomes while retaining the original text and its source. Splitting must not
introduce a new requirement.

## Identity and provenance

Preserve source IDs, casing, row and sheet. Repeated IDs are diagnostics, not an
instruction to drop rows or merge distinct outcomes. Until resolved, refer to a
case by `(source path, sheet, row, id)` in reports.

For absent IDs the parser allocates collision-free `LOCAL-...` identifiers. These
are extraction-local: row reordering can change them. Persist the resolved IDs
and source mapping in the case artifact; subsequent `--update` runs reconcile by
source and intent before reusing them. Do not silently renumber persisted IDs.

The agent may add `parentId`, `expectationSource`, `evidence`, and a stable
`DISC-...` ID to discovered cases. Keep each proposed expectation's source explicit:
manual specification, linked requirement, or unresolved proposal. Observation
and inference are recorded separately from normative expected results.

## Quality review

For each case, check whether a different implementation could pass its assertions
while violating the manual intent. Clarify broad claims such as "successful" or
"correct" into concrete supported outcomes. Keep completeness checks separate
from risk priority and runtime status. Missing preconditions may be discoverable
from the repository; missing product rules may require a user answer.

Raw parser data can contain credentials or personal information. Use it in memory
to normalize cases, then redact source text/values and test-data secrets before
persisting `normalized-cases.json`, manual-case documents or reports. Reference
environment variable names/fixture keys instead. Never write over the source file.
