# Frontend Verification

Visual verification of frontend implementations using the `agent-browser` skill, a browser tool attached to the user's real Chrome profile (Claude in Chrome, Chrome DevTools MCP, or the Codex Chrome plugin), or project-native browser tests.

Reason first: does this verification need real Chrome profile state? If no, `agent-browser` or Chrome MCP is safe for generic pages and low-level inspection. If yes, open a new tab through the real-profile browser tool and confirm its URL and signed-in account before inspecting it. Do not take over a tab the user is working in.

## Applicability Check

**Skip entirely if task is NOT frontend-related.** Frontend indicators:
- Files modified: `*.tsx`, `*.jsx`, `*.vue`, `*.svelte`, `*.html`, `*.css`, `*.scss`
- Changes to: components, layouts, pages, styles, DOM structure, UI behavior
- Keywords: render, display, layout, responsive, animation, visual, UI, UX

If none match, skip this technique.

## Step 1: Detect Browser Tool Availability

First decide whether the verification needs real user Chrome state.

- No real login/cookies needed: use `agent-browser`, Chrome MCP, or project-native browser tests (Step 2B).
- Real user login/cookies/profile needed: check that a real-profile browser tool is connected in this session (Step 2A). If none is connected, ask the user to connect one, or fall back to Step 2B with a test account.

## Step 2A: Real Chrome Profile — Direct Verification

Open the implementation in the user's actual browser profile. Ensure the dev server is running first.

### Navigate & Screenshot

```
1. Open a new tab at http://localhost:3000 through the real-profile browser tool
2. Confirm the tab URL and the signed-in account match the task
3. Capture a screenshot or accessibility snapshot through the same tool
4. Read the screenshot with the image-capable file reader to visually inspect
```

### Visual Inspection Checklist

After capturing screenshot, verify:
1. **Layout** — Elements positioned correctly, no overflow/overlap
2. **Content** — Text, images, data rendered as expected
3. **Responsiveness** — Resize the viewport if the tool supports it
4. **Interactions** — Click and type through the tool to test interactive elements
5. **Console errors** — Read the page's console messages through the tool

### Console Error Check

Read console messages through the tool's console reader, or evaluate:

```
JSON.stringify(window.__consoleErrors || [])
```

### Get Page Content

Extract the page text or DOM through the tool to verify rendered output matches expectations.

## Step 2B: Real Chrome Profile NOT Required — Generic Browser Fallback

```bash
# Screenshot + console error check
agent-browser open http://localhost:3000
agent-browser screenshot -o ./verification-screenshot.png
```

For repeatable test evidence, prefer the project's Playwright/Vitest/Cypress commands if present.

If no browser tool is available, skip visual verification and note in report:
> "Visual verification skipped — no real-profile browser tool, agent-browser, or project-native browser test available."

## Step 3: Analyze Results

After capture:
1. **Read screenshot** — Use the image-capable file reader on the PNG to visually inspect
2. **Check console output** — Zero errors = pass; errors = investigate before claiming done
3. **Compare with expected** — Match against design specs or user description
4. **Document findings** — Include screenshot path and any issues found in verification report

## Integration with Verification Protocol

This technique extends `verification.md`. After standard verification (tests pass, build succeeds), add frontend verification as final gate:

```
Standard verification → Tests pass → Build succeeds → Frontend visual verification → Claim complete
```

Report format:
```
## Frontend Verification
- Method: [agent-browser | real Chrome profile tool | Chrome MCP | project-native browser test | skipped]
- Screenshot: ./verification-screenshot.png
- Console errors: [none | list]
- Visual check: [pass | issues found]
- Responsive: [checked at X viewports | skipped]
```
