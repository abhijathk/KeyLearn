import { type Snippet } from "../types.ts";

/**
 * The handful of Playwright snippets that differ between the two languages.
 *
 * Only eight of the corpus's snippets contain TypeScript-only syntax; the
 * other hundred and thirty-nine are already valid JavaScript and are shared by
 * both sets rather than copied into each. These are the replacements, plus two
 * that only arise in JavaScript — the JSDoc annotations that give an editor
 * the same autocomplete a type annotation would.
 *
 * Written in CommonJS where the file would really be one — a Playwright config
 * in a JavaScript project is usually `module.exports`, not `export default`.
 */
export const playwrightJavascript: readonly Snippet[] = [
  {
    id: "pw-js-str-fixture",
    title: "A fixture that sets up and cleans up after itself",
    level: 4,
    tags: ["structure", "fixture"],
    code: `const { test: base, expect } = require('@playwright/test');

exports.test = base.extend({
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
    id: "pw-js-str-worker-fixture",
    title: "A fixture built once per worker, not per test",
    level: 5,
    tags: ["structure", "fixture"],
    code: `// Naming the database after the worker is what makes parallel runs safe:
// each worker owns its own and cannot see another's rows. Without the
// generic parameters TypeScript uses, the scope option carries the meaning.
exports.test = base.extend({
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
    id: "pw-js-str-page-object",
    title: "A page object that keeps selectors out of the tests",
    level: 4,
    tags: ["structure", "page-object"],
    code: `const { expect } = require('@playwright/test');

// Locators built once in the constructor, methods named for what a user
// does. When the markup changes, one file changes and no test does.
class LoginPage {
  constructor(page) {
    this.page = page;
    this.email = page.getByLabel('Email');
    this.password = page.getByLabel('Password');
    this.submit = page.getByRole('button', { name: 'Sign in' });
  }

  async goto() {
    await this.page.goto('/login');
  }

  async signIn(email, password) {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }

  async expectError(message) {
    await expect(this.page.getByRole('alert')).toHaveText(message);
  }
}

exports.LoginPage = LoginPage;`,
  },
  {
    id: "pw-js-jsdoc-page-object",
    title: "Give the editor the types anyway",
    level: 4,
    tags: ["structure", "page-object"],
    code: `// A JSDoc annotation costs one line and buys the same autocomplete and the
// same red squiggle a type annotation would, with no build step. In a
// JavaScript project this is the difference between guessing at the
// Playwright API and being shown it.
class LoginPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
  }

  /**
   * @param {string} email
   * @param {string} password
   * @returns {Promise<void>}
   */
  async signIn(email, password) {
    await this.page.getByLabel('Email').fill(email);
    await this.page.getByLabel('Password').fill(password);
    await this.page.getByRole('button', { name: 'Sign in' }).click();
  }
}`,
  },
  {
    id: "pw-js-jsdoc-config",
    title: "A typed config without TypeScript",
    level: 3,
    tags: ["config"],
    code: `// The one JSDoc annotation worth memorising: it turns the whole config
// object into a checked one, so a misspelled option is caught in the editor
// rather than ignored at run time.
const { defineConfig } = require('@playwright/test');

/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry' },
});`,
  },
  {
    id: "pw-js-net-console",
    title: "Fail a test on an unexpected console error",
    level: 4,
    tags: ["network", "console"],
    code: `// A page that logs errors is failing quietly; this makes it fail loudly.
const errors = [];
page.on('console', (message) => {
  if (message.type() === 'error') {
    errors.push(message.text());
  }
});

await page.goto('/dashboard');
expect(errors).toEqual([]);`,
  },
  {
    id: "pw-js-api-fixture",
    title: "That client as a fixture, disposed for you",
    level: 4,
    tags: ["api", "fixture"],
    code: `// The same context as a fixture: created once, disposed after the test,
// and impossible to forget.
exports.test = base.extend({
  api: async ({ playwright }, use) => {
    const context = await playwright.request.newContext({
      baseURL: process.env.API_URL,
      extraHTTPHeaders: { authorization: 'Bearer ' + process.env.API_TOKEN },
    });
    await use(context);
    await context.dispose();
  },
});`,
  },
  {
    id: "pw-js-api-cleanup",
    title: "Clean up what the test created, whatever happened",
    level: 4,
    tags: ["api", "hooks"],
    code: `let orderId = null;

test.afterEach(async ({ request }) => {
  // In afterEach rather than at the end of the test, so a failure halfway
  // through does not leave a row behind for the next run to trip over.
  if (orderId !== null) {
    await request.delete('/api/orders/' + orderId);
    orderId = null;
  }
});`,
  },
  {
    id: "pw-js-api-pagination",
    title: "Walk every page of a paginated endpoint",
    level: 4,
    tags: ["api", "pagination"],
    code: `// The Set at the end catches a paginator that returns the same page
// twice, which is the usual off-by-one in this code.
const seen = [];
let page = 1;

while (true) {
  const response = await request.get('/api/products', {
    params: { page, perPage: 50 },
  });
  const { items, hasMore } = await response.json();
  seen.push(...items.map((item) => item.sku));
  if (!hasMore) {
    break;
  }
  page += 1;
}

expect(new Set(seen).size).toBe(seen.length);`,
  },
  {
    id: "pw-js-api-basic-auth",
    title: "Basic authentication",
    level: 2,
    tags: ["api", "auth"],
    code: `// Reading the password from the environment keeps it out of the
// repository and out of the report when a test fails. TypeScript would
// write process.env.API_PASSWORD! here; in JavaScript the fallback both
// says what happens when it is unset and fails loudly if it is.
const api = await playwright.request.newContext({
  httpCredentials: {
    username: 'ada',
    password: process.env.API_PASSWORD ?? '',
  },
});`,
  },
  {
    id: "pw-js-cfg-auth-setup",
    title: "Sign in once and save the session",
    level: 4,
    tags: ["config", "auth"],
    code: `// Signing in once and saving the state means the login form is tested
// once rather than at the start of every test.
const { test: setup, expect } = require('@playwright/test');

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env.TEST_EMAIL ?? '');
  await page.getByLabel('Password').fill(process.env.TEST_PASSWORD ?? '');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();

  await page.context().storageState({ path: authFile });
});`,
  },
  {
    id: "pw-js-cfg-global-setup",
    title: "Run something once before the whole suite",
    level: 4,
    tags: ["config"],
    code: `// Global setup runs before the workers start, so it is the place for
// anything that must happen exactly once.
async function globalSetup() {
  await migrateTestDatabase();
}

module.exports = globalSetup;`,
  },
];

/**
 * The TypeScript-only snippets these replace.
 *
 * Kept beside the replacements rather than in the set, so the two lists cannot
 * drift apart — a snippet dropped here but not replaced would silently shrink
 * the JavaScript corpus instead of failing anything.
 */
export const TYPESCRIPT_ONLY: readonly string[] = [
  "pw-str-fixture",
  "pw-str-worker-fixture",
  "pw-str-page-object",
  "pw-net-console",
  "pw-api-fixture",
  "pw-api-cleanup",
  "pw-api-pagination",
  "pw-cfg-global-setup",
  "pw-api-basic-auth",
  "pw-cfg-auth-setup",
];
