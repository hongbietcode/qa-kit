# qa-kit

A QA and problem-clarifying plugin for **Claude Code** and **Codex**, served from one
marketplace repo. It bundles nine skills and four agents: clarify a fuzzy problem and
compare approaches, generate test cases and edge cases, write Playwright/Vitest/k6
automation, run and audit test suites, explore an app in a browser, and debug failures
to their root cause.

## What's inside

### Skills — clarify and solve

| Skill | Use it to | Claude Code | Codex |
| --- | --- | --- | --- |
| `grill-me` | Stress-test a plan or decision a round of questions at a time, each with a recommended answer (user-invoked only) | `/qa-kit:grill-me` | `$qa-kit:grill-me` |
| `brainstorm` | Turn fuzzy intent into an outcome contract and compare approaches (`--html`, `--report`, `--advice`, `--ultra`, `--yagni`) | `/qa-kit:brainstorm` | `$qa-kit:brainstorm` |
| `problem-solving` | Reframe a stuck problem: simplification cascades, inversion, scale game, collision-zone, meta-patterns | `/qa-kit:problem-solving` | `$qa-kit:problem-solving` |
| `predict` | Five expert personas debate a risky change and return GO / CAUTION / STOP (`--chain reason\|probe`) | `/qa-kit:predict` | `$qa-kit:predict` |

### Skills — test

| Skill | Use it to | Claude Code | Codex |
| --- | --- | --- | --- |
| `scenario` | Generate test cases and edge cases across 12 dimensions (one-shot, `--iterations N`, `--saturation`) | `/qa-kit:scenario` | `$qa-kit:scenario` |
| `test` | Run tests and coverage; `create`, `optimize`, or `audit` a suite; `ui <url>` for UI testing | `/qa-kit:test` | `$qa-kit:test` |
| `web-testing` | Write Playwright E2E, Vitest unit/integration, API, k6 load, visual, and a11y tests | `/qa-kit:web-testing` | `$qa-kit:web-testing` |
| `agent-browser` | Exploratory QA and bug hunts with the `agent-browser` CLI | `/qa-kit:agent-browser` | `$qa-kit:agent-browser` |
| `debug` | Prove the root cause of a failing test, CI run, or bug before fixing it | `/qa-kit:debug` | `$qa-kit:debug` |

### Agents

| Agent | Role | Claude Code | Codex |
| --- | --- | --- | --- |
| `brainstormer` | Challenges assumptions and compares 2-3 approaches before any code is written | `qa-kit:brainstormer` | `brainstormer` |
| `tester` | Runs suites, checks coverage, reports gaps (diff-aware by default) | `qa-kit:tester` | `tester` |
| `debugger` | Root-cause analysis across logs, CI, databases, and tests | `qa-kit:debugger` | `debugger` |
| `code-reviewer` | Production-readiness review after tests pass; never edits code | `qa-kit:code-reviewer` | `code_reviewer` (read-only sandbox) |

Codex names use underscores because Codex's custom-agent examples all use that form.

## Typical flow

```text
 clarify                     solve                      test
┌──────────┐   ┌────────────┐   ┌─────────┐   ┌──────────┐   ┌─────────────┐   ┌──────┐
│ grill-me │──►│ brainstorm │──►│ predict │──►│ scenario │──►│ web-testing │──►│ test │
└──────────┘   └─────┬──────┘   └─────────┘   └──────────┘   └─────────────┘   └──┬───┘
                     │ stuck                                          fails        │
               ┌─────▼───────────┐                               ┌────────┐       │
               │ problem-solving │                               │ debug  │◄──────┘
               └─────────────────┘                               └───┬────┘
                                                                     ▼
                                                             code-reviewer agent
```

```text
/qa-kit:grill-me "rewrite checkout so guest users can pay with saved cards"
/qa-kit:brainstorm the settled checkout plan --report
/qa-kit:predict "store saved cards for guest users" --chain probe
/qa-kit:scenario src/api/payment.ts --format test-scenarios
/qa-kit:web-testing e2e checkout flow from the scenario table above
/qa-kit:test
/qa-kit:debug "checkout.spec.ts fails on CI only"
```

In Codex, use the same arguments with `$qa-kit:<skill>`.

## Install

### Claude Code

```bash
claude plugin marketplace add ~/code/qa-kit
claude plugin install qa-kit@qa-kit
```

Or inside a session: `/plugin marketplace add ~/code/qa-kit`, then
`/plugin install qa-kit@qa-kit`. Restart Claude Code after installing.

### Codex

```bash
codex plugin marketplace add ~/code/qa-kit
codex plugin add qa-kit@qa-kit
node scripts/install-codex-agents.mjs      # agents → ~/.codex/agents
```

Codex plugins cannot ship agents, so `install-codex-agents.mjs` converts
`plugins/qa-kit/agents/*.md` into Codex TOML agent files. It drops the
Claude-only sections (agent memory, team mode), refuses to overwrite a file it did
not write, and supports `--project` (writes `./.codex/agents`), `--dest DIR`,
`--dry-run`, and `--uninstall`.

## Update after editing

Bump `version` in both `plugins/qa-kit/.claude-plugin/plugin.json` and
`plugins/qa-kit/.codex-plugin/plugin.json` (and the entry in
`.claude-plugin/marketplace.json`), then:

```bash
# Claude Code
claude plugin marketplace update qa-kit
claude plugin update qa-kit@qa-kit

# Codex: re-adding refreshes the cached copy from the local marketplace
codex plugin add qa-kit@qa-kit
node scripts/install-codex-agents.mjs
```

## Layout

```text
qa-kit/
├── .claude-plugin/marketplace.json      Claude Code marketplace
├── .agents/plugins/marketplace.json     Codex marketplace
├── plugins/qa-kit/
│   ├── .claude-plugin/plugin.json       Claude Code manifest
│   ├── .codex-plugin/plugin.json        Codex manifest
│   ├── skills/                          shared by both runtimes
│   │   ├── grill-me/  brainstorm/  problem-solving/  predict/
│   │   └── scenario/  test/  web-testing/  agent-browser/  debug/
│   └── agents/                          Claude Code agents (source for Codex agents)
│       └── brainstormer.md  tester.md  debugger.md  code-reviewer.md
└── scripts/install-codex-agents.mjs     agents → Codex TOML
```

## Conventions

- Skills refer to each other by bare name (`debug`, `scenario`); both runtimes
  namespace them as `qa-kit:<skill>`.
- `--ultra` mechanics live in one file,
  `skills/brainstorm/references/ultra-verifier-mode.md`, shared by `brainstorm`,
  `problem-solving`, `test`, and `debug`.
- `--advice` uses a read-only subagent on the strongest model the runtime offers.
- Reports go to the project's existing reports folder (for example `plans/reports/`)
  or to `qa-reports/`, named `{skill-or-agent}-{YYMMDD-HHmm}-{slug}.md`.

## Validate

```bash
claude plugin validate --strict .
claude plugin validate --strict plugins/qa-kit
node scripts/install-codex-agents.mjs --dry-run
```

## License

Internal use. See [NOTICE.md](NOTICE.md) for third-party attributions.
