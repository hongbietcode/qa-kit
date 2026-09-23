# agent-browser and Browser MCP

Guidance for choosing between `agent-browser` and MCP-based browser diagnostics.

## Use Case Decision Tree

```
Need browser automation?
|
+-- Needs the user's real Chrome profile, cookies, tenant, or Google account?
|   +-- YES --> real-profile browser tool (Claude in Chrome, Chrome DevTools MCP, Codex Chrome plugin)
|   +-- NO --> Continue
|
+-- Long autonomous AI session?
|   +-- YES --> agent-browser (better context efficiency)
|   +-- NO --> Continue
|
+-- Need video recording?
|   +-- YES --> agent-browser (built-in)
|   +-- NO --> Continue
|
+-- Cloud browser (CI/CD)?
|   +-- YES --> agent-browser (Browserbase native)
|   +-- NO --> Continue
|
+-- Low-level Chrome DevTools Protocol inspection?
|   +-- YES --> configured chrome-devtools-mcp bridge/client
|   +-- NO --> Continue
|
+-- Ad-hoc page driving, snapshots, screenshots, forms?
|   +-- YES --> agent-browser
+-- Otherwise --> web-testing skill for test strategy/runners
```

## Primary Patterns

```bash
# Long autonomous session
agent-browser --session test1 open https://example.com
agent-browser snapshot -i
agent-browser click @e1
agent-browser close
```

## MCP Pattern

Use the configured `chrome-devtools-mcp` bridge or MCP client when the task specifically needs MCP/CDP tools. Availability is environment-specific; do not assume a slash command wrapper is installed.

## Real Chrome Profile Pattern

Use this only after the decision tree says real profile state is required.
Drive the user's Chrome through the runtime's real-profile browser tool:

1. Open a new tab for the task instead of taking over a tab the user is using.
2. Confirm the tab's URL and the signed-in account before acting.
3. Capture snapshots, screenshots, and console output through that same tool.

Raw Chrome DevTools MCP navigation targets whichever profile and page the bridge
currently selected, so verify the target tab before every profile-scoped action.
For generic/profile-independent diagnostics, Chrome DevTools MCP can use its
normal navigation tools.

## Migration Notes

| Old local script habit | Current route |
|------------------------|---------------|
| `node navigate.js --url X` | `agent-browser open X` |
| `node aria-snapshot.js --url X` | `agent-browser open X && agent-browser snapshot -i` |
| `node select-ref.js --ref e5 --action click` | `agent-browser click @e5` |
| `node fill.js --selector "#email" --value "X"` | `agent-browser fill @e1 "X"` |
| `node screenshot.js --output X.png` | `agent-browser screenshot -o X.png` |
| `node console.js --types error` | Configured MCP browser console tools, or a project-local Playwright test |
| `node network.js` | Configured MCP network tools, or a project-local Playwright test |
