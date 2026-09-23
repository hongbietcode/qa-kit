# Mapping manual intent to Playwright

Load after normalizing cases and exploring the application. Reuse the project's
installed Playwright version, TypeScript/JavaScript conventions, test project and
fixture imports. A source case becomes runnable only when its required behavior,
setup, observed locators and assertion targets are known.

## Mapping contract

For each automated case, record test file, full title (including describe titles),
project, data variant and the expected-result indexes each assertion verifies.
Include the stable case ID in the test title, e.g. `[TC-CART-01] removes last item`.
For parameterization, give each variant a unique title and track it separately.
Map both IDs when an existing test truly covers two cases. A test merely visiting
the same page is not evidence of equivalent coverage.

Keep partial mappings explicit. A case expecting "error message, unchanged total,
no order created" needs all three outcomes; a visible toast alone is insufficient.
For an unobservable backend result, use an existing supported API/data helper or
leave that outcome uncovered. Do not invent an endpoint to make a check possible.

## Generation decisions

- Use existing fixtures and test accounts. A fresh Playwright context per test
  isolates browser state; shared backend data still needs independent setup and
  cleanup. Mutating tests often need separate accounts or per-test records.
- Prefer roles/labels with accessible names and scoped containers. Existing
  test-ID contracts are valid. Use `getByPlaceholder`, not `getByPlaceholderText`.
  Verify uniqueness; do not silence ambiguous matches with `.first()` or
  `nth()` unless the position itself is the tested contract.
- Translate exploration handles (`@eN`) to durable Playwright locators. Keep
  locator evidence in the report; never paste browser handles into specs.
- Use awaited web assertions for expected states. Register event/response waits
  before the action that triggers them. Avoid sleep-based synchronization and
  broad `networkidle` waits for readiness.
- Keep one coherent business behavior per test and useful `test.step` labels
  linking the manual actions. Split independent outcomes into separate tests
  when this improves isolation, while preserving their source ID mapping.
- Use page objects for reused interaction surfaces or existing project patterns;
  simple flows can stay inline. Keep business assertions visible in tests.
- Mock agreed external boundaries for deterministic failure cases. Do not mock
  the core application response that the E2E case is supposed to verify.
- Reuse an auth setup project/storage state if safe for the data model. A user's
  browser session alone does not establish a repeatable CI authentication path.
  Test the UI login itself in login cases, even if other tests reuse auth state.

See official [locators](https://playwright.dev/docs/locators),
[authentication](https://playwright.dev/docs/auth), and
[best practices](https://playwright.dev/docs/best-practices) for API details.

## Worked mapping example

Suppose exploration of the target fixture established `/cart`, one seeded product,
a unique Remove button, a status message "Your cart is empty", and a Checkout
button. The repository already exposes a `cartWithOneItem` fixture that provisions
and cleans up that cart for this test's account. Adapt names only from real evidence.

```typescript
import { test, expect } from './fixtures/cart';

test('[TC-CART-01] removing the last item prevents checkout', async ({
  page, cartWithOneItem,
}) => {
  await test.step('Open the seeded cart', async () => {
    await page.goto('/cart');
    await expect(page.getByRole('button', { name: 'Remove', exact: true }))
      .toHaveCount(1);
  });

  await test.step('Remove the item and verify the empty state', async () => {
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Your cart is empty');
    await expect(page.getByRole('button', { name: 'Checkout', exact: true }))
      .toBeDisabled();
  });
});
```

This is an illustrative repository-specific fixture, not a bundled implementation.
Resolve a real fixture before emitting imports. Traceability connects expected
result 1 to the status assertion and expected result 2 to the disabled button.

## Updating and verifying

With `--update`, inspect existing assertions, source IDs and parameterized cases.
Preserve customized setup and unrelated tests. Match missing-ID cases by the
persisted mapping and intent. Preview conflicts instead of overwriting a different
test with a matching name. Without `--update`, reuse equivalent coverage and report
any existing spec changes required rather than generating a duplicate.

Run the target repository's typecheck if configured, then Playwright discovery
(`playwright test <file> --list`) and a focused run using installed scripts or
binary. Initial checks should disable retries and retain a trace. A test runner
passing does not mean all mapped cases ran: reconcile project, full title,
parameter variant, skip state and every attempt from the actual results.

Record pass-after-retry as `Flaky`. Unexpected pass on a test marked expected-to-
fail remains a runner failure requiring review. An expected failure remains a
known defect, not verified coverage. Skipped and not-run cases remain outstanding.
