import { type Snippet } from "../types.ts";

/**
 * Setting a suite up: config, projects, authentication, CI.
 *
 * Mostly typed once per project and then never again, which is exactly why it
 * is worth practising — the shape of a config is the thing people copy badly
 * from a blog post and never revisit.
 *
 * Every one of these is a whole file or a whole statement, never a fragment of
 * an object. A snippet the compiler would reject is not something to be
 * teaching anyone, and the formatter gate cannot check what it cannot parse.
 */
export const config: readonly Snippet[] = [
  {
    id: "pw-cfg-minimal",
    title: "A config that covers most projects",
    level: 2,
    tags: ["config"],
    code: `// forbidOnly stops a stray test.only from silently reducing CI to one
// test; retries and workers differ because CI is slower and noisier.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});`,
  },
  {
    id: "pw-cfg-webserver",
    title: "Start the app before the tests, and reuse it locally",
    level: 3,
    tags: ["config"],
    code: `// reuseExistingServer keeps a local run from fighting the dev server you
// already have open, while CI always starts its own.
export default defineConfig({
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});`,
  },
  {
    id: "pw-cfg-mobile",
    title: "Run the same tests on a phone viewport",
    level: 2,
    tags: ["config", "devices"],
    code: `// Device descriptors set viewport, user agent and touch together, which
// is three ways a mobile bug hides from a desktop-sized viewport.
export default defineConfig({
  projects: [
    { name: 'Mobile Chrome', use: { ...devices['Pixel 7'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 15'] } },
  ],
});`,
  },
  {
    id: "pw-cfg-timeouts",
    title: "Separate the test timeout from the assertion timeout",
    level: 3,
    tags: ["config", "timeout"],
    code: `// The test timeout bounds the whole test; the expect timeout bounds one
// assertion. Confusing the two is why suites end up waiting minutes.
export default defineConfig({
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
});`,
  },
  {
    id: "pw-cfg-trace",
    title: "Keep the evidence only when something failed",
    level: 3,
    tags: ["config", "debug"],
    code: `// on-failure rather than always: a trace per passing test fills a disk
// quickly and nobody ever opens them.
export default defineConfig({
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});`,
  },
  {
    id: "pw-cfg-reporters",
    title: "Report for humans and for CI at the same time",
    level: 3,
    tags: ["config", "reporting"],
    code: `// list for the person watching, html for the person investigating, junit
// for the machine collecting.
export default defineConfig({
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'results/junit.xml' }],
  ],
});`,
  },
  {
    id: "pw-cfg-auth-setup",
    title: "Sign in once and save the session",
    level: 4,
    tags: ["config", "auth"],
    code: `// Signing in once and saving the state means the login form is tested
// once rather than at the start of every test.
import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env.TEST_EMAIL!);
  await page.getByLabel('Password').fill(process.env.TEST_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();

  await page.context().storageState({ path: authFile });
});`,
  },
  {
    id: "pw-cfg-auth-project",
    title: "Make every test depend on that sign-in",
    level: 4,
    tags: ["config", "auth"],
    code: `// dependencies makes the sign-in run first, so no test has to check
// whether it happened.
export default defineConfig({
  projects: [
    { name: 'setup', testMatch: /.*\\.setup\\.ts/ },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
});`,
  },
  {
    id: "pw-cfg-storage-per-role",
    title: "Give one test a different signed-in user",
    level: 4,
    tags: ["config", "auth"],
    code: `// test.use applies to this file only, so one suite can run as an admin
// without every other suite losing its ordinary user.
test.use({ storageState: 'playwright/.auth/admin.json' });

test('an admin can suspend an account', async ({ page }) => {
  await page.goto('/admin/users');
  await page.getByRole('button', { name: 'Suspend' }).first().click();
});`,
  },
  {
    id: "pw-cfg-locale-tz",
    title: "Pin locale, timezone and geolocation",
    level: 3,
    tags: ["config", "i18n"],
    code: `// Pinning these makes date and currency assertions stable; without them
// the suite passes in one timezone and fails in another.
export default defineConfig({
  use: {
    locale: 'en-AU',
    timezoneId: 'Australia/Sydney',
    geolocation: { latitude: -33.8688, longitude: 151.2093 },
    permissions: ['geolocation'],
  },
});`,
  },
  {
    id: "pw-cfg-colorscheme",
    title: "Test the dark theme deliberately",
    level: 2,
    tags: ["config", "theme"],
    code: `// Dark mode is where contrast bugs live, and nobody finds them by
// looking at the light theme all day.
test.use({ colorScheme: 'dark' });

test('the dashboard is readable in dark mode', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('main')).toHaveScreenshot('dashboard-dark.png');
});`,
  },
  {
    id: "pw-cfg-global-setup",
    title: "Run something once before the whole suite",
    level: 4,
    tags: ["config"],
    code: `// Global setup runs before the workers start, so it is the place for
// anything that must happen exactly once.
async function globalSetup(): Promise<void> {
  await migrateTestDatabase();
}

export default globalSetup;`,
  },
];
