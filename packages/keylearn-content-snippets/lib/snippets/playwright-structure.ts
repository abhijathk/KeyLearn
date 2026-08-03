import { type Snippet } from "../types.ts";

/**
 * How a suite is put together: tests, hooks, fixtures, page objects.
 *
 * This is the part that separates a test suite someone can still work on after
 * a year from one they rewrite. The snippets build up in that order — a plain
 * test, then shared setup, then a fixture that owns its own lifecycle, then a
 * page object that keeps selectors out of the test body.
 */
export const structure: readonly Snippet[] = [
  {
    id: "pw-str-first-test",
    title: "A whole test, start to finish",
    level: 1,
    tags: ["structure", "test"],
    code: `import { expect, test } from '@playwright/test';

// The title says what a user can do, not which function is being called —
// so a failure in CI reads as a broken promise rather than a broken symbol.
test('a visitor can read the pricing page', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.getByRole('heading', { name: 'Pricing' })).toBeVisible();
});`,
  },
  {
    id: "pw-str-describe",
    title: "Group related tests",
    level: 1,
    tags: ["structure", "test"],
    code: `// Grouping is for shared setup and for reading the report, not for
// sharing state: tests inside a describe still run independently.
test.describe('checkout', () => {
  test('shows the order total', async ({ page }) => {
    await page.goto('/checkout');
    await expect(page.getByTestId('total')).toHaveText('$129.99');
  });
});`,
  },
  {
    id: "pw-str-beforeeach",
    title: "Share setup between tests",
    level: 1,
    tags: ["structure", "hooks"],
    code: `// Assert the page arrived before handing over. Without this, a failure in
// setup surfaces as a confusing failure inside whichever test ran first.
test.beforeEach(async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
});`,
  },
  {
    id: "pw-str-hooks-all",
    title: "Set up and tear down once for the file",
    level: 2,
    tags: ["structure", "hooks"],
    code: `// Runs once per worker, not once per run, so whatever it creates has to
// be safe for several workers to hold at the same time.
test.beforeAll(async () => {
  await seedDatabase();
});

test.afterAll(async () => {
  await resetDatabase();
});`,
  },
  {
    id: "pw-str-step",
    title: "Name the phases of a long test",
    level: 2,
    tags: ["structure", "reporting"],
    code: `// Steps show up in the report and the trace, so a failure says which
// phase broke rather than only which line.
await test.step('sign in', async () => {
  await page.getByLabel('Email').fill('ada@example.com');
  await page.getByLabel('Password').fill('correct horse battery');
  await page.getByRole('button', { name: 'Sign in' }).click();
});

await test.step('open the latest invoice', async () => {
  await page.getByRole('link', { name: 'Invoices' }).click();
  await page.getByRole('row').first().getByRole('link').click();
});`,
  },
  {
    id: "pw-str-serial",
    title: "Run a group in order, stopping at the first failure",
    level: 3,
    tags: ["structure", "parallel"],
    code: `// A last resort: it gives up parallelism and makes every later test
// depend on every earlier one. Prefer making each test set up its own state.
test.describe.configure({ mode: 'serial' });`,
  },
  {
    id: "pw-str-parallel",
    title: "Let the tests in one file run at the same time",
    level: 3,
    tags: ["structure", "parallel"],
    code: `// Each test gets its own worker, so anything they share must be either
// read-only or unique per test.
test.describe.configure({ mode: 'parallel' });`,
  },
  {
    id: "pw-str-skip",
    title: "Skip a test under a condition",
    level: 2,
    tags: ["structure", "annotation"],
    code: `// The reason is the important argument. A skip with no explanation stays
// skipped for years because nobody dares delete it.
test('drag and drop reorders the list', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Drag events are unreliable on WebKit.');
  await page.goto('/board');
});`,
  },
  {
    id: "pw-str-fixme-fail",
    title: "Mark a known break, and a test that must fail",
    level: 3,
    tags: ["structure", "annotation"],
    code: `// fixme skips a test for a bug that is still open, and keeps it visible.
test.fixme('export respects the date filter', async ({ page }) => {
  await page.goto('/reports');
});

// fail asserts the test does not pass — so when the bug is fixed, this
// starts failing and tells you to delete it.
test('legacy import is rejected', async ({ page }) => {
  test.fail();
  await page.goto('/import/v1');
});`,
  },
  {
    id: "pw-str-slow",
    title: "Give a genuinely slow test more room",
    level: 2,
    tags: ["structure", "timeout"],
    code: `// Triples this test's timeout only, rather than making the whole suite
// patient with every future failure.
test('the nightly report generates', async ({ page }) => {
  test.slow();
  await page.goto('/reports/nightly');
});`,
  },
  {
    id: "pw-str-tag",
    title: "Tag tests so a subset can be run",
    level: 2,
    tags: ["structure", "annotation"],
    code: `// Tags are what let a pull request run the smoke set in two minutes and
// leave the full suite to the nightly build.
test(
  'the cart survives a reload',
  { tag: ['@smoke', '@cart'] },
  async ({ page }) => {
    await page.goto('/cart');
    await page.reload();
    await expect(page.getByRole('listitem')).toHaveCount(2);
  },
);`,
  },
  {
    id: "pw-str-annotate",
    title: "Link a test to the issue it covers",
    level: 2,
    tags: ["structure", "annotation"],
    code: `// Six months later this is the only way anyone will know why the test
// asserts something so specific.
test(
  'discount codes are case insensitive',
  {
    annotation: { type: 'issue', description: 'PROJ-1042' },
  },
  async ({ page }) => {
    await page.goto('/cart');
  },
);`,
  },
  {
    id: "pw-str-fixture",
    title: "A fixture that sets up and cleans up after itself",
    level: 4,
    tags: ["structure", "fixture"],
    code: `import { test as base } from '@playwright/test';

type Fixtures = {
  signedInPage: Page;
};

export const test = base.extend<Fixtures>({
  signedInPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('ada@example.com');
    await page.getByLabel('Password').fill('correct horse battery');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();

    // Everything before use is setup, everything after is teardown, and the
    // teardown runs even when the test fails. That is what a fixture buys
    // over a beforeEach with a matching afterEach that someone will delete.
    await use(page);

    await page.getByRole('button', { name: 'Sign out' }).click();
  },
});`,
  },
  {
    id: "pw-str-worker-fixture",
    title: "A fixture built once per worker, not per test",
    level: 5,
    tags: ["structure", "fixture"],
    code: `// Naming the database after the worker is what makes parallel runs safe:
// each worker owns its own and cannot see another's rows.
export const test = base.extend<{}, { seededDatabase: string }>({
  seededDatabase: [
    async ({}, use, workerInfo) => {
      const name = 'test_db_' + workerInfo.workerIndex;
      await createDatabase(name);
      await use(name);
      await dropDatabase(name);
    },
    { scope: 'worker' },
  ],
});`,
  },
  {
    id: "pw-str-page-object",
    title: "A page object that keeps selectors out of the tests",
    level: 4,
    tags: ["structure", "page-object"],
    code: `import { type Locator, type Page, expect } from '@playwright/test';

// Locators built once in the constructor, methods named for what a user
// does. When the markup changes, one file changes and no test does.
export class LoginPage {
  private readonly email: Locator;
  private readonly password: Locator;
  private readonly submit: Locator;

  constructor(private readonly page: Page) {
    this.email = page.getByLabel('Email');
    this.password = page.getByLabel('Password');
    this.submit = page.getByRole('button', { name: 'Sign in' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }

  async expectError(message: string): Promise<void> {
    await expect(this.page.getByRole('alert')).toHaveText(message);
  }
}`,
  },
  {
    id: "pw-str-page-object-use",
    title: "Using a page object from a test",
    level: 3,
    tags: ["structure", "page-object"],
    code: `// The test now reads as a description of the behaviour. Nothing here
// would change if the login form were rebuilt tomorrow.
test('a wrong password is rejected', async ({ page }) => {
  const login = new LoginPage(page);
  await login.goto();
  await login.signIn('ada@example.com', 'wrong');
  await login.expectError('Those details did not match.');
});`,
  },
];
