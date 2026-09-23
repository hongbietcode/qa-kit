---
name: grill-me
description: Grill the user relentlessly about a plan, decision, design, or test strategy until you reach a shared understanding. Use when the user wants to stress-test their thinking, clear up a fuzzy problem, or uses any "grill me" trigger phrase.
argument-hint: "[plan, idea, or decision to stress-test]"
disable-model-invocation: true
license: MIT
metadata:
  kit: qa-kit
  upstream: "mattpocock/skills (grill-me + grilling)"
---

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you haven't heard yet. Ask the whole frontier in one round: number each question and give your recommended answer. Then wait for the user's answers before the next round.

Format a round like so:

```
❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>

---

❓ **Q2** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>
```

Each round the user answers reshapes the tree: settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round. A question whose answer depends on another question still open in this round belongs to a _later_ round, not this one.

Finding _facts_ is your job, never the user's. When a frontier question needs a fact from the environment (filesystem, tools, etc.), dispatch a sub-agent to find it; don't ask the user for anything you could look up yourself. Don't block on it: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait for the sub-agent to report; ask the rest of the frontier now. The _decisions_ are the user's: put each to them and wait.

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Do not act on it until the user confirms you have reached a shared understanding.

## After the grilling

Once the user confirms the shared understanding, summarize the settled tree as
outcome, constraints, non-goals, and acceptance criteria, then offer the next
qa-kit step that fits: `brainstorm` to compare approaches, `predict` to debate
risks, or `scenario` to turn the settled behavior into test cases.

## Attribution

Adapted from the `grill-me` and `grilling` skills in
[mattpocock/skills](https://github.com/mattpocock/skills) (MIT, see
`LICENSE.txt`). The two upstream skills are merged here because `grill-me` only
delegated to `grilling`.
