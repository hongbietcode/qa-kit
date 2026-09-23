# UI Testing Workflow

Use the `agent-browser` skill for live browser interaction when a fresh/tool-managed browser is enough. Use a browser tool attached to the user's real Chrome profile (Claude in Chrome, Chrome DevTools MCP, or the Codex Chrome plugin) only when the test needs the user's real cookies or already-logged-in state. Use the `web-testing` skill or project-native Playwright/Vitest/k6 commands for repeatable test runs.

## Purpose
Run comprehensive UI tests on a website and generate a detailed report.

## Arguments
- $1: URL - The URL of the website to test
- $2: OPTIONS - Optional test configuration (e.g., --headless, --mobile, --auth)

## Testing Protected Routes (Authentication)

### Step 1: User Manual Login
Instruct the user to:
1. Open the target site in their browser
2. Log in manually with their credentials
3. Open browser DevTools (F12) → Application tab → Cookies/Storage

### Step 2: Persist Auth State Or Use The Real Chrome Profile
Prefer project-native auth helpers for repeatable tests (for example a Playwright
`storageState` setup project from the `web-testing` skill).

If real user Chrome state is not needed, log in once inside `agent-browser` and
save its state with the CLI's state commands (`agent-browser skills get core`
lists them for the installed version).

If real user Chrome state is needed, drive the page through the runtime's
real-profile browser tool. Open a new tab for the test instead of taking over a
tab the user is working in, and confirm the tab's URL and account before
capturing anything.

### Step 3: Run Tests
After auth is available, run tests normally. With `agent-browser`:
```bash
agent-browser open https://example.com/dashboard
agent-browser screenshot -o profile.png
```

With a real-profile browser tool, navigate the tab you opened in Step 2 and
capture screenshots, accessibility snapshots, and console messages through that
tool.

## Workflow
- Write the test plan first (pages, flows, checks) in the report directory, then record results against it
- All screenshots saved in the same report directory
- Browse URL, discover all pages, components, endpoints
- Create test plan based on discovered structure
- Use multiple `tester` subagents in parallel for: pages, forms, navigation, user flows, accessibility, responsive layouts, performance, security, seo
- Read every screenshot with the runtime's image-capable file reader and note visual defects
- Generate comprehensive Markdown report
- Offer the user the report path so they can open it

## Output Requirements
- Clear, structured Markdown with headers, lists, code blocks
- Include test results summary, key findings, screenshot references
- Lead with the outcome. Keep reports short by being selective, not by compressing the writing into fragments or arrow chains; write complete sentences.

**Do not** start implementing fixes.
