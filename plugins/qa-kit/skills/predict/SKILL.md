---
name: predict
description: "5 expert personas debate a proposed change before implementation. Catches architectural, security, performance, and UX issues early. Use before major features, risky changes, or when choosing between competing approaches."
when_to_use: "Invoke before high-risk changes that need persona debate."
argument-hint: "<feature description or change proposal> [--files <glob>] [--chain reason|probe]"
license: MIT
metadata:
  kit: qa-kit
  version: "1.1.0"
  attribution: "Multi-persona prediction pattern adapted from autoresearch by Udit Goenka (MIT)"
---

# predict — Multi-Persona Pre-Analysis

Five expert personas independently analyze a proposed change, then debate conflicts to produce a consensus verdict before a single line of code is written.

## When to Use

- Before implementing a major or high-risk feature
- Before a significant refactor or architecture change
- Evaluating competing technical approaches
- Stress-testing assumptions in a proposed design

## When NOT to Use

- Trivial or low-risk changes (use `debug` for bugs; go straight to planning for already-decided tasks)
- Already-approved work with no open design questions
- Pure dependency upgrades with no API changes

---

## The 5 Personas

| Persona | Focus | Core Questions |
|---------|-------|----------------|
| **Architect** | System design, scalability, coupling | Does this fit the architecture? Will it scale? What new coupling does it introduce? |
| **Security** | Attack surface, data protection, auth | What can be abused? Where is data exposed? Are auth boundaries respected? |
| **Performance** | Latency, memory, queries, bundle size | What is the latency impact? N+1 queries? Memory leaks? Bundle bloat? |
| **UX** | User experience, accessibility, error states | Is this intuitive? What does the error state look like? Accessible on mobile? |
| **Devil's Advocate** | Hidden assumptions, simpler alternatives | Why not do nothing? What is the simplest alternative? Which load-bearing assumption — one the proposal fails without — could be wrong, and what does it cost to reverse course once it is? |

---

## Debate Protocol

1. **Read** the proposed change/feature description from the argument
2. **Read relevant code** if file paths are provided (grep for affected areas)
3. **Each persona analyzes independently** — do not let personas influence each other during this phase
4. **Identify agreements** — points where all (or 4+) personas align
5. **Identify conflicts** — points where personas meaningfully disagree
6. **Weigh tradeoffs** — for each conflict, evaluate which concern has higher impact, comparing the options on their worst plausible case, not only their expected one
7. **Produce verdict** — GO / CAUTION / STOP with actionable recommendations

---

## Output Format

```
## Prediction Report: [proposal title]

## Verdict: GO | CAUTION | STOP

### Agreements (all personas align)
- [Point 1 — what they all agree on]
- [Point 2]

### Conflicts & Resolutions

| Topic | Architect | Security | Performance | UX | Devil's Advocate | Resolution |
|-------|-----------|----------|-------------|-----|-----------------|------------|
| [Issue] | [View] | [View] | [View] | [View] | [View] | [Recommendation] |

### Risk Summary

| Risk | Severity | Early signal | Mitigation |
|------|----------|--------------|------------|
| [Risk description] | Critical/High/Medium/Low | [Observable sign this risk is materializing — omit when the risk is already certain] | [Concrete action] |

### Recommendations
1. [Action item — rationale]
2. [Action item — rationale]
3. [Action item — rationale]
```

---

## Verdict Levels

| Verdict | Meaning |
|---------|---------|
| **GO** | All personas aligned, no critical risks, proceed with confidence |
| **CAUTION** | Concerns exist but are manageable — mitigations identified, proceed carefully |
| **STOP** | Critical unresolved issue found — needs redesign or more information before proceeding |

### STOP Triggers (any one is sufficient)
- Security persona identifies auth bypass or data exposure with no viable mitigation
- Architect identifies fundamental design incompatibility requiring significant rework
- Performance persona identifies unacceptable latency or query explosion with no workaround
- Devil's Advocate exposes a false assumption that invalidates the entire approach

---

## Chain Modes

After producing the verdict, predict can chain into a follow-on workflow that always runs as part of a predict session (not as a standalone skill).

| Flag | Purpose | When to use |
|------|---------|-------------|
| `--chain reason` | Subjective refinement loop — generate → critique → synthesize → blind judge → repeat until convergence | Verdict is CAUTION with subjective tradeoffs (architecture polish, design coherence) |
| `--chain probe` | Requirement interrogation — saturation-driven harvest of missing constraints + assumptions | Verdict is CAUTION or STOP because of "missing constraint" or "unstated assumption" findings |

These chain modes absorb upstream `/autoresearch:reason` and `/autoresearch:probe` ([uditgoenka/autoresearch](https://github.com/uditgoenka/autoresearch), MIT). They're folded into predict — not shipped as standalone skills — because they always chain off a predict invocation.

### `--chain reason` protocol

Start from the verdict's open CAUTION tradeoffs.

1. **Generate** — write the current best resolution for each open tradeoff.
2. **Critique** — each persona critiques that resolution from its own focus.
3. **Synthesize** — write a revised resolution that answers every critique it
   accepts and states why it rejects the rest.
4. **Blind judge** — compare the previous and revised resolutions with their
   labels hidden and order randomized (a separate read-only subagent when the
   runtime supports it), and pick the stronger one against the persona concerns.
5. **Repeat** until the judge prefers the previous resolution twice in a row, or
   after 5 rounds.

Output the converged resolution, the round in which it converged, and the
critiques that remain unresolved.

### `--chain probe` protocol

Start from the verdict's "missing constraint" and "unstated assumption"
findings.

1. **Harvest** — each round, list every constraint or assumption the proposal
   silently depends on, tagged with the persona that surfaced it.
2. **Classify** each item as new, a variant of a kept item, or a duplicate;
   keep new items and variants.
3. **Resolve by evidence** — answer from code, docs, or config whatever can be
   looked up; never ask the user for a discoverable fact.
4. **Saturate** — stop when 2 consecutive rounds add no new items.
5. **Ask** the remaining items to the user as numbered questions, each with a
   recommended answer, then re-run the verdict with the answers applied.

Output the constraint and assumption list with its source (evidence or user),
and the updated verdict.

---

## Integration with Other Skills

| Workflow Step | Skill | How |
|---------------|-------|-----|
| Deepen risk scenarios into test cases | `scenario` | Feed Risk Summary rows as the feature description |
| Settle a STOP caused by unclear intent | `grill-me` | Grill the user on the invalidated assumption |
| Compare redesign options after STOP | `brainstorm` | Pass the STOP triggers as constraints |
| Create implementation plan | the project's plan file | Attach Recommendations as constraints |
| High-risk feature implementation | implementation + `test` | Reference CAUTION/STOP items as acceptance gates |

---

## Example Invocations

```
/qa-kit:predict "Add WebSocket support for real-time notifications"
/qa-kit:predict "Migrate authentication from JWT to session cookies"
/qa-kit:predict "Add multi-tenancy to the database layer"
/qa-kit:predict "Replace REST API with GraphQL" --files src/api/**/*.ts

# Chain modes
/qa-kit:predict "Pick auth library: Passport vs Better Auth" --chain reason
/qa-kit:predict "Move from REST to GraphQL" --chain probe
```

In Codex, mention the skill as `$qa-kit:predict` with the same arguments.

---

## Lineage

Faithful absorption (in scope) of upstream `/autoresearch:predict` ([uditgoenka/autoresearch](https://github.com/uditgoenka/autoresearch), MIT). The local version supports the 5-persona debate plus `--chain reason` (subjective refinement) and `--chain probe` (requirement interrogation), folding upstream's `/autoresearch:reason` and `/autoresearch:probe` sub-commands into chain modes rather than separate skills.
