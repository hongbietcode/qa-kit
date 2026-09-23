---
name: agent-browser
description: Browser and desktop automation through the agent-browser CLI. Use for exploratory QA, bug hunts, login/test flows without real Chrome profile state, compact page snapshots, screenshots, form filling, scraping, long autonomous browsing, cloud browsers, Electron apps, and Slack automation.
when_to_use: "Invoke for browser/app automation that needs snapshots or clicks and does not require the user's real Chrome profile state."
argument-hint: "[url or task]"
allowed-tools: Bash(agent-browser:*), Bash(npx agent-browser:*)
license: Apache-2.0
metadata:
  kit: qa-kit
  version: "2.0.1"
  upstream: "vercel-labs/agent-browser"
---

# agent-browser Skill

Fast browser automation CLI for AI agents. Chrome/Chromium via CDP with accessibility-tree snapshots and compact `@eN` element refs (~280 chars/snapshot vs 8K+ for Playwright MCP).

Use `agent-browser` for browser testing, screenshots, form fills, scraping, exploratory QA, bug hunts, cloud browsers, Electron apps, Slack automation, and flows where a fresh or tool-managed browser is fine. Prefer it over generic browser tools for profile-independent browser work.

Use a browser tool attached to the user's real Chrome profile instead (Claude in Chrome, Chrome DevTools MCP, or the Codex Chrome plugin) when the task needs the user's actual Chrome profile: existing cookies, logged-in sessions, a specific Google account, a tenant/workspace already open in daily Chrome, or deterministic targeting across multiple Chrome profiles.

## Install / Upgrade

```bash
npm install -g agent-browser     # install (or upgrade) to latest
agent-browser install            # download Chromium (one-time)
agent-browser install --with-deps  # Linux: include system deps
agent-browser upgrade            # self-upgrade the binary
agent-browser --version          # verify
```

Re-run `npm install -g agent-browser` (or `agent-browser upgrade`) periodically — new commands and skills ship with the binary.

## Start here — load live workflow content

This file is a discovery stub, not the usage guide. Before running any `agent-browser` command, load workflow content from the installed CLI:

```bash
agent-browser skills get core             # start here: workflows, common patterns, troubleshooting
agent-browser skills get core --full      # include full command reference and templates
```

The CLI serves skill content from the installed binary, so instructions always match the installed version. This stub stays intentionally small and points at `skills get core` instead of duplicating command details that can change between releases.

## Specialized skills

Load a specialized skill when the task falls outside browser web pages:

```bash
agent-browser skills get electron          # Electron apps (VS Code, Slack, Discord, Figma, ...)
agent-browser skills get slack             # Slack workspace automation
agent-browser skills get dogfood           # Exploratory testing / QA / bug hunts
agent-browser skills get vercel-sandbox    # agent-browser inside Vercel Sandbox microVMs
agent-browser skills get agentcore         # AWS Bedrock AgentCore cloud browsers
```

Run `agent-browser skills list` to see everything available on the installed version.

## When to use

For `web-testing from-manual`, explore only the supplied case scope and return
route/state, account role, locator names/uniqueness, expected-vs-observed behavior
and evidence per case. Refresh snapshot handles after page changes; they cannot
serve as Playwright locators. The owning workflow decides coverage and writes
tests. In its `--dry-run` mode, do not start or interact with a browser.

Default for browser automation that does not depend on the user's real Chrome login state: autonomous sessions, ad-hoc navigation, screenshots, form fills, scraping, multi-tab work, self-verifying build loops, Electron desktop apps, Slack automation, and Browserbase/cloud browsers.

For low-level Chrome DevTools Protocol diagnostics, use the configured `chrome-devtools-mcp` bridge or client when one is available. Reason first: if the task does not need a specific real Chrome profile, Chrome DevTools MCP may use its normal navigation tools. If it does need profile/cookie/account state, use the real-profile browser tool: open a new tab for the task and confirm its URL and account before using MCP inspection tools. See `references/agent-browser-vs-chrome-devtools.md` for the trade-off.

## Why agent-browser

- Native Rust CLI rather than a Node.js wrapper
- Works across AI agents such as Claude Code, Codex, Cursor, Continue, and Windsurf
- Chrome/Chromium via CDP without a Playwright or Puppeteer dependency
- Accessibility-tree snapshots with stable element refs for reliable interaction
- Sessions, authentication vault, state persistence, and video recording
- Specialized workflows for Electron apps, Slack, exploratory testing, and cloud browsers

## Cloud browsers

For CI/CD or environments without a local browser:

```bash
export BROWSERBASE_API_KEY="..."
export BROWSERBASE_PROJECT_ID="..."
agent-browser -p browserbase open https://example.com
```

See `references/browserbase-cloud-setup.md` for detailed setup. For AWS Bedrock AgentCore or Vercel Sandbox, run `agent-browser skills get agentcore` / `agent-browser skills get vercel-sandbox`.

## Observability dashboard

Agent Browser exposes an observability dashboard independently of browser sessions on port 4848. It can also be opened through a proxied or forwarded URL such as `https://dashboard.agent-browser.localhost`. Stay on the dashboard origin; session tabs, status, and stream traffic are proxied internally, so individual session ports do not need to be exposed.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Command not found | `npm install -g agent-browser` |
| Chromium missing | `agent-browser install` |
| Linux deps missing | `agent-browser install --with-deps` |
| Stale commands / missing flags | `npm install -g agent-browser` then `agent-browser skills get core --full` |
| Session stale | `agent-browser close` |
| Element not found | Re-run `agent-browser snapshot -i` after page changes |

## Resources

- Upstream: https://github.com/vercel-labs/agent-browser
- Browserbase: https://docs.browserbase.com/
