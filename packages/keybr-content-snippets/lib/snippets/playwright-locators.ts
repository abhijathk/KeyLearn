import { type Snippet } from "../types.ts";

/**
 * Finding things on the page.
 *
 * Ordered the way the Playwright team recommends reaching for them: role and
 * label first because they survive a redesign and describe what a user sees,
 * CSS and XPath last because they bind a test to markup that will change. A
 * learner typing these in order is absorbing that preference without being
 * lectured about it.
 *
 * Every snippet carries a comment saying *why*, never what. "Set the email"
 * above a line that fills the email is noise; the reason one locator is
 * preferred over another is the thing worth reading twice.
 */
export const locators: readonly Snippet[] = [
  {
    id: "pw-loc-role-button",
    title: "Find a button by its accessible role and name",
    level: 1,
    tags: ["locator", "role"],
    code: `// Role and name are what a user perceives, so this survives a redesign
// that a CSS class would not.
await page.getByRole('button', { name: 'Sign in' }).click();`,
  },
  {
    id: "pw-loc-role-exact",
    title: "Match the accessible name exactly",
    level: 1,
    tags: ["locator", "role"],
    code: `// Without exact, 'Docs' would also match 'Docs and guides'.
await page.getByRole('link', { name: 'Docs', exact: true }).click();`,
  },
  {
    id: "pw-loc-label",
    title: "Find a form field by its label",
    level: 1,
    tags: ["locator", "form"],
    code: `// If this cannot find the field, the field has no label — which is an
// accessibility bug the test has just caught for free.
await page.getByLabel('Email address').fill('ada@example.com');`,
  },
  {
    id: "pw-loc-placeholder",
    title: "Find an input by its placeholder",
    level: 1,
    tags: ["locator", "form"],
    code: `// Second choice to getByLabel: a placeholder is a hint, not a label, and
// it disappears the moment anything is typed.
await page.getByPlaceholder('Search products').fill('keyboard');`,
  },
  {
    id: "pw-loc-text",
    title: "Find an element by the text it shows",
    level: 1,
    tags: ["locator", "text"],
    code: `// Matches on substring and normalised whitespace, so a stray newline in
// the markup will not break it.
await expect(page.getByText('Welcome back')).toBeVisible();`,
  },
  {
    id: "pw-loc-testid",
    title: "Find an element by its test id",
    level: 1,
    tags: ["locator", "testid"],
    code: `// For the cases with no role and no readable text. It never breaks, but
// it also tests nothing a user would notice.
await page.getByTestId('checkout-summary').scrollIntoViewIfNeeded();`,
  },
  {
    id: "pw-loc-title",
    title: "Find an element by its title attribute",
    level: 2,
    tags: ["locator"],
    code: `// Useful for icon-only controls, whose title is often their only name.
await expect(page.getByTitle('Close dialog')).toBeEnabled();`,
  },
  {
    id: "pw-loc-altext",
    title: "Find an image by its alternative text",
    level: 2,
    tags: ["locator"],
    code: `// An image with no alt text cannot be found this way, which is the point.
await expect(page.getByAltText('Product photo')).toBeVisible();`,
  },
  {
    id: "pw-loc-chain",
    title: "Scope a locator to a region of the page",
    level: 2,
    tags: ["locator", "scoping"],
    code: `// Scoping first means the footer's Pricing link cannot be picked up by
// mistake — and the test says which Pricing link it meant.
const nav = page.getByRole('navigation');
await nav.getByRole('link', { name: 'Pricing' }).click();`,
  },
  {
    id: "pw-loc-filter-text",
    title: "Narrow a list of matches by the text inside them",
    level: 3,
    tags: ["locator", "filter"],
    code: `// Finding the row by its content rather than its position keeps the test
// working when the table is sorted differently.
const row = page.getByRole('row').filter({ hasText: 'Invoice #1042' });
await row.getByRole('button', { name: 'Download' }).click();`,
  },
  {
    id: "pw-loc-filter-has",
    title: "Narrow matches by what they contain",
    level: 3,
    tags: ["locator", "filter"],
    code: `// hasText looks at text; has takes another locator, so you can filter on
// something with no words in it at all.
const card = page
  .getByRole('listitem')
  .filter({ has: page.getByRole('img', { name: 'Sold out' }) });
await expect(card).toHaveCount(2);`,
  },
  {
    id: "pw-loc-filter-hasnot",
    title: "Exclude matches by what they contain",
    level: 3,
    tags: ["locator", "filter"],
    code: `// Asserting "not zero" rather than an exact count keeps this passing as
// the catalogue changes, while still failing if everything sells out.
const available = page
  .getByRole('listitem')
  .filter({ hasNotText: 'Out of stock' });
await expect(available).not.toHaveCount(0);`,
  },
  {
    id: "pw-loc-nth",
    title: "Pick one match out of several",
    level: 2,
    tags: ["locator"],
    code: `// Position is the most brittle thing to depend on. Reach for filter or a
// scoped locator first, and use these only when order is the actual subject.
await page.getByRole('listitem').first().click();
await page.getByRole('listitem').nth(2).hover();
await page.getByRole('listitem').last().click();`,
  },
  {
    id: "pw-loc-or",
    title: "Accept either of two locators",
    level: 3,
    tags: ["locator"],
    code: `// For a page that legitimately renders one of two things, not as a way
// to paper over not knowing which one it renders.
const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog'));
await expect(dialog).toBeVisible();`,
  },
  {
    id: "pw-loc-and",
    title: "Require both conditions of a locator",
    level: 3,
    tags: ["locator"],
    code: `// When neither condition is specific enough on its own but the pair is.
const primary = page
  .getByRole('button')
  .and(page.getByTitle('Submit the form'));
await primary.click();`,
  },
  {
    id: "pw-loc-css",
    title: "Fall back to a CSS selector",
    level: 2,
    tags: ["locator", "css"],
    code: `// The last resort. This binds the test to markup that will be rewritten
// by someone who has no idea the test exists.
await expect(page.locator('css=.cart-badge')).toHaveText('3');`,
  },
  {
    id: "pw-loc-frame",
    title: "Reach into an iframe",
    level: 3,
    tags: ["locator", "frame"],
    code: `// Content inside a frame is invisible to an ordinary locator, which is
// why a payment field so often "cannot be found".
const checkout = page.frameLocator('#payment-frame');
await checkout.getByLabel('Card number').fill('4242424242424242');`,
  },
  {
    id: "pw-loc-shadow",
    title: "Cross a shadow root without doing anything special",
    level: 3,
    tags: ["locator"],
    code: `// Playwright pierces open shadow roots on its own, so a web component
// needs no different treatment from ordinary markup.
await page.locator('my-datepicker input').fill('2026-08-01');`,
  },
];
