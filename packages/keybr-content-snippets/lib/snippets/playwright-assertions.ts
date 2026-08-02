import { type Snippet } from "../types.ts";

/**
 * Saying what should be true.
 *
 * Every `expect` on a locator retries until it passes or the timeout runs out,
 * which is the whole reason Playwright tests can be written without sleeps.
 * The difference between `expect(locator).toHaveText()` and reading the text
 * first and asserting on the string is the difference between a test that
 * waits and a test that races — and it is invisible until CI is flaky.
 */
export const assertions: readonly Snippet[] = [
  {
    id: "pw-exp-visible",
    title: "Assert something is on screen",
    level: 1,
    tags: ["assertion"],
    code: `// Retries until it passes, so no wait is needed after the navigation
// that produced this heading.
await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();`,
  },
  {
    id: "pw-exp-hidden",
    title: "Assert something has gone",
    level: 1,
    tags: ["assertion"],
    code: `// Passes for absent as well as hidden, which is what you usually mean.
await expect(page.getByRole('progressbar')).toBeHidden();`,
  },
  {
    id: "pw-exp-text",
    title: "Assert exact text",
    level: 1,
    tags: ["assertion"],
    code: `// Whitespace is normalised first, so indentation in the markup does not
// have to be matched.
await expect(page.getByTestId('total')).toHaveText('$149.99');`,
  },
  {
    id: "pw-exp-contain",
    title: "Assert text is contained",
    level: 1,
    tags: ["assertion"],
    code: `// Prefer this when the surrounding copy is not the thing under test.
await expect(page.getByRole('alert')).toContainText('saved');`,
  },
  {
    id: "pw-exp-regex",
    title: "Assert text against a pattern",
    level: 2,
    tags: ["assertion"],
    code: `// Asserts the shape of a generated id without pinning its value, which
// would change on every run.
await expect(page.getByTestId('order-id')).toHaveText(/^ORD-\\d{6}$/);`,
  },
  {
    id: "pw-exp-value",
    title: "Assert the value of a field",
    level: 1,
    tags: ["assertion", "form"],
    code: `// toHaveText reads the rendered text; an input has none, so its value is
// what has to be asserted.
await expect(page.getByLabel('Email')).toHaveValue('ada@example.com');`,
  },
  {
    id: "pw-exp-count",
    title: "Assert how many things matched",
    level: 1,
    tags: ["assertion"],
    code: `// Retries as the list loads, unlike reading .count() into a variable.
await expect(page.getByRole('listitem')).toHaveCount(12);`,
  },
  {
    id: "pw-exp-all-texts",
    title: "Assert a whole list at once, in order",
    level: 2,
    tags: ["assertion"],
    code: `// One assertion for contents, count and order — and one clear failure
// message instead of three vaguer ones.
await expect(page.getByRole('listitem')).toHaveText(['Bread', 'Butter', 'Jam']);`,
  },
  {
    id: "pw-exp-enabled",
    title: "Assert a control can be used",
    level: 1,
    tags: ["assertion", "form"],
    code: `// Worth asserting before clicking anything the form must validate first.
await expect(page.getByRole('button', { name: 'Pay now' })).toBeEnabled();`,
  },
  {
    id: "pw-exp-disabled",
    title: "Assert a control cannot be used yet",
    level: 1,
    tags: ["assertion", "form"],
    code: `// The guard against a checkout that takes payment on an invalid form.
await expect(page.getByRole('button', { name: 'Pay now' })).toBeDisabled();`,
  },
  {
    id: "pw-exp-checked",
    title: "Assert a checkbox state",
    level: 1,
    tags: ["assertion", "form"],
    code: `// Asserting the unticked one matters as much: a marketing box that
// defaults to on is a consent problem, not a styling one.
await expect(page.getByLabel('Remember me')).toBeChecked();
await expect(page.getByLabel('Send me offers')).not.toBeChecked();`,
  },
  {
    id: "pw-exp-attr",
    title: "Assert an attribute",
    level: 2,
    tags: ["assertion"],
    code: `// Checks where a link actually points, which clicking it would not.
await expect(page.getByRole('link', { name: 'Terms' })).toHaveAttribute(
  'href',
  '/legal/terms',
);`,
  },
  {
    id: "pw-exp-class",
    title: "Assert a class is applied",
    level: 2,
    tags: ["assertion"],
    code: `// A pattern, not a string: the exact class list changes whenever anyone
// adds a utility class.
await expect(page.getByTestId('row-7')).toHaveClass(/selected/);`,
  },
  {
    id: "pw-exp-css",
    title: "Assert a computed style",
    level: 3,
    tags: ["assertion"],
    code: `// Computed, so the value comes back as rgb() however it was written in
// the stylesheet.
await expect(page.getByRole('alert')).toHaveCSS(
  'background-color',
  'rgb(220, 38, 38)',
);`,
  },
  {
    id: "pw-exp-url",
    title: "Assert where we ended up",
    level: 1,
    tags: ["assertion", "navigation"],
    code: `// Waits for the navigation, so no waitForNavigation is needed before it.
await expect(page).toHaveURL(/\\/orders\\/\\d+$/);`,
  },
  {
    id: "pw-exp-title",
    title: "Assert the page title",
    level: 1,
    tags: ["assertion", "navigation"],
    code: `// Cheap to assert and the one thing a screen reader announces first.
await expect(page).toHaveTitle('Checkout — Acme');`,
  },
  {
    id: "pw-exp-focus",
    title: "Assert what has focus",
    level: 2,
    tags: ["assertion", "a11y"],
    code: `// Where focus lands after an error decides whether the form is usable by
// keyboard at all.
await expect(page.getByLabel('Card number')).toBeFocused();`,
  },
  {
    id: "pw-exp-empty",
    title: "Assert an element has no content",
    level: 2,
    tags: ["assertion"],
    code: `// Different from toBeHidden: this one is present and deliberately blank.
await expect(page.getByTestId('error-summary')).toBeEmpty();`,
  },
  {
    id: "pw-exp-timeout",
    title: "Give one assertion longer than the rest",
    level: 3,
    tags: ["assertion", "timeout"],
    code: `// Raise it here rather than in the config, so one slow report does not
// buy every other failure in the suite thirty seconds of waiting.
await expect(page.getByText('Report ready')).toBeVisible({
  timeout: 30_000,
});`,
  },
  {
    id: "pw-exp-soft",
    title: "Keep going after a failed check",
    level: 3,
    tags: ["assertion"],
    code: `// Soft assertions record the failure and let the test carry on, so one
// run reports every wrong figure instead of only the first.
await expect.soft(page.getByTestId('subtotal')).toHaveText('$120.00');
await expect.soft(page.getByTestId('shipping')).toHaveText('$9.99');
await expect.soft(page.getByTestId('total')).toHaveText('$129.99');`,
  },
  {
    id: "pw-exp-poll",
    title: "Retry a check that is not about the DOM",
    level: 4,
    tags: ["assertion", "polling"],
    code: `// The retrying of a locator assertion, applied to anything else — here an
// API that finishes some time after the click that started it.
await expect
  .poll(
    async () => {
      const response = await request.get('/api/jobs/42');
      return (await response.json()).status;
    },
    { timeout: 20_000 },
  )
  .toBe('complete');`,
  },
  {
    id: "pw-exp-screenshot",
    title: "Compare against a stored screenshot",
    level: 4,
    tags: ["assertion", "visual"],
    code: `// A small tolerance absorbs anti-aliasing differences between machines,
// which is the usual reason visual tests fail on someone else's laptop.
await expect(page.getByTestId('invoice')).toHaveScreenshot('invoice.png', {
  maxDiffPixelRatio: 0.01,
});`,
  },
];
