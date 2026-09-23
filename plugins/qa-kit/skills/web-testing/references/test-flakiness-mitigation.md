# Test Flakiness Mitigation

## Root Causes

- Timing mismatches (hard waits)
- Non-isolated tests (shared state)
- Network instability
- Animation timing

## Explicit Waits (Not Hard Waits)

```javascript
// BAD: Hard wait
await new Promise(r => setTimeout(r, 500));

// GOOD: Wait for condition
await page.waitForSelector('.success', { timeout: 10000 });
await expect(page.locator('.count')).toContainText('5');

// BEST: Playwright auto-wait
await page.getByRole('button', { name: /submit/i }).click();
```

## Wait Timeout Guidelines

| Scenario | Timeout |
|----------|---------|
| Page load | 10-15s |
| Element visibility | 5-10s |
| API responses | 30-60s |

## Retry Strategies

Diagnose the original failure before changing retries. Use the repository's
normal retry policy for CI; initial verification of new tests should use zero
retries so a failure stays visible. Per-group configuration is supported:

```javascript
test.describe('Transient external integration', () => {
  test.describe.configure({ retries: 1 });
  test('loads the integration status', async ({ page }) => {
    await page.goto('/integrations');
    await expect(page.getByRole('status')).toHaveText('Connected');
  });
});
```

This example needs the application's actual route/state. A pass after retry is
flaky, not an initial pass. Never retry a payment, creation or deletion blindly
inside a helper; repeated side effects can corrupt the test's evidence. See
[Playwright retries](https://playwright.dev/docs/test-retries).

## Test Isolation

```javascript
// BAD: Dependent tests
let userId;
test('create', async () => { userId = await createUser(); });
test('load', async () => { await loadUser(userId); }); // Depends on previous!

// GOOD: Independent
test('create and load', async ({ page }) => {
  const userId = await createUser(page);
  await loadUser(page, userId);
});
```

## Disable Animations

```css
* { animation-duration: 0s !important; transition-duration: 0s !important; }
```

## Network Stability

```javascript
await page.route('**/external-api/**', route =>
  route.fulfill({ status: 200, body: '{}' })
);
```

## Flakiness Detection

```bash
npx playwright test --repeat-each=3 --retries=0
```

Use a scoped file/project and isolated data. Record first failures and all
attempts; stop when missing environment/data or a confirmed product defect
prevents useful reruns.
