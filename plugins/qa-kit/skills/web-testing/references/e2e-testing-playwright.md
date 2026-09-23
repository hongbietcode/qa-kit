# E2E Testing with Playwright

## Setup

Inspect existing configuration and the installed Playwright version first. For
manual case conversion, follow [from-manual-workflow.md](from-manual-workflow.md).
Only initialize when the target has no setup and adding Playwright is in scope:

```bash
npm init playwright@latest
npx playwright install
```

## Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('User Login', () => {
  test('should login successfully', async ({ page }) => {
    await page.goto('/login');
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;
    if (!email || !password) throw new Error('Missing test account configuration');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL('/dashboard');
  });
});
```

## Selector Priority (Accessibility-First)

1. `getByRole('button', { name: 'Submit' })` - Most preferred
2. `getByLabel('Email')` - Form fields
3. `getByPlaceholder('Search')` - Inputs
4. `getByText('Welcome')` - Static text
5. `getByTestId('submit-btn')` - Explicit stable test contract when provided

Verify accessible names and uniqueness against the real page. Official
[locator API](https://playwright.dev/docs/locators).

## Advanced Fixtures

### Reuse authentication state with isolated pages

Prefer the repository's existing setup project. If it already provisions an
ignored state file, a fixture can consume its path without guessing an API or
cookie name. Each test still receives its own context and page:

```typescript
import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  storageState: async ({}, use) => {
    const statePath = process.env.PLAYWRIGHT_AUTH_STATE;
    if (!statePath) throw new Error('Set PLAYWRIGHT_AUTH_STATE to the setup output');
    await use(statePath);
  },
});
export { expect };
```

For mutating tests, allocate separate accounts/data when necessary. Do not share
a `Page` as a worker-scoped fixture or depend on the test-scoped `request` fixture
from a worker fixture. Follow the official
[authentication guide](https://playwright.dev/docs/auth) for account-per-worker
setup; redact auth state and keep it out of version control.

### Database Seeding Fixture

```typescript
// See ./database-testing.md for Testcontainers patterns
```

## Network Patterns

### Wait for API

```typescript
const responsePromise = page.waitForResponse('**/api/users');
await page.getByRole('button', { name: 'Load', exact: true }).click();
await responsePromise;
```

### Mock API

```typescript
await page.route('**/third-party/users', route =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
);
```

## Configuration

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  workers: process.env.CI ? 1 : undefined,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
});
```

## Sharding (CI)

```bash
npx playwright test --shard=1/4
npx playwright test --shard=2/4
```

## Commands

```bash
npx playwright test                    # Run all
npx playwright test --ui               # UI mode
npx playwright test --project=chromium # Specific browser
npx playwright codegen https://example.com  # Generate
npx playwright show-report             # View report
```

## Related

- `./playwright-component-testing.md` - CT patterns
- `./playwright-mapping.md` - Manual cases, fixtures and assertion traceability
- `./database-testing.md` - DB fixtures
