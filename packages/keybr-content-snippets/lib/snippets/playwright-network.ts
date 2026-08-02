import { type Snippet } from "../types.ts";

/**
 * Controlling what the page gets back from the network.
 *
 * The point of most of these is speed and determinism rather than cleverness:
 * a test that stubs its third-party dependencies runs the same way on a laptop,
 * in CI, and on the day that dependency has an outage.
 */
export const network: readonly Snippet[] = [
  {
    id: "pw-net-wait-response",
    title: "Wait for the request the click causes",
    level: 2,
    tags: ["network"],
    code: `// Start waiting before the click, or the response may arrive before
// anything is listening for it.
const responsePromise = page.waitForResponse('**/api/search?*');
await page.getByRole('button', { name: 'Search' }).click();
const response = await responsePromise;
expect(response.status()).toBe(200);`,
  },
  {
    id: "pw-net-wait-predicate",
    title: "Wait for a response matching a condition",
    level: 3,
    tags: ["network"],
    code: `// A predicate when the URL alone is ambiguous — here the same path is
// both read and written.
const response = await page.waitForResponse(
  (r) => r.url().includes('/api/orders') && r.request().method() === 'POST',
);
expect(response.ok()).toBeTruthy();`,
  },
  {
    id: "pw-net-mock-json",
    title: "Answer a request with your own JSON",
    level: 2,
    tags: ["network", "mock"],
    code: `// Stubbing the dependency makes the test deterministic and fast, and it
// still passes on the day that service is down.
await page.route('**/api/profile', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ name: 'Ada Lovelace', plan: 'premium' }),
  });
});`,
  },
  {
    id: "pw-net-mock-error",
    title: "Make the server fail, on purpose",
    level: 2,
    tags: ["network", "mock"],
    code: `// The error path is the one nobody exercises by hand, which is why it is
// usually the one that is broken.
await page.route('**/api/orders', (route) =>
  route.fulfill({ status: 500, body: 'Internal Server Error' }),
);
await page.getByRole('button', { name: 'Place order' }).click();
await expect(page.getByRole('alert')).toContainText('Something went wrong');`,
  },
  {
    id: "pw-net-abort",
    title: "Cut off requests you do not want to make",
    level: 2,
    tags: ["network", "performance"],
    code: `// Images and analytics slow every test down and prove nothing.
await page.route('**/*.{png,jpg,jpeg,webp,gif}', (route) => route.abort());
await page.route('**/analytics.js', (route) => route.abort());`,
  },
  {
    id: "pw-net-modify-response",
    title: "Let the real request run, then change the answer",
    level: 4,
    tags: ["network", "mock"],
    code: `// Real response, one field changed — so the test stays honest about the
// shape the server actually returns.
await page.route('**/api/features', async (route) => {
  const response = await route.fetch();
  const body = await response.json();
  body.betaCheckout = true;
  await route.fulfill({ response, json: body });
});`,
  },
  {
    id: "pw-net-modify-request",
    title: "Add a header on the way out",
    level: 3,
    tags: ["network"],
    code: `// Tagging outbound calls with the run id makes a server log searchable
// when a test fails in CI and not on your machine.
await page.route('**/api/**', async (route) => {
  const headers = { ...route.request().headers(), 'x-test-run': runId };
  await route.continue({ headers });
});`,
  },
  {
    id: "pw-net-once",
    title: "Stub only the first call, then let the rest through",
    level: 4,
    tags: ["network", "mock"],
    code: `// times bounds the stub to the first call, so the retry that follows sees
// the real endpoint.
await page.route(
  '**/api/quote',
  (route) => route.fulfill({ json: { price: 0 } }),
  { times: 1 },
);`,
  },
  {
    id: "pw-net-har",
    title: "Replay a recorded session",
    level: 4,
    tags: ["network", "har"],
    code: `// update: false replays the recording. Left true it would silently
// overwrite the fixture with whatever happened today.
await page.routeFromHAR('tests/fixtures/checkout.har', {
  url: '**/api/**',
  update: false,
});`,
  },
  {
    id: "pw-net-request-fixture",
    title: "Call the API directly, without a browser",
    level: 3,
    tags: ["network", "api"],
    code: `// No browser is started for this, so it runs in a fraction of the time a
// UI test would take to prove the same thing.
test('the orders endpoint rejects an unknown token', async ({ request }) => {
  const response = await request.get('/api/orders', {
    headers: { authorization: 'Bearer not-a-real-token' },
  });
  expect(response.status()).toBe(401);
});`,
  },
  {
    id: "pw-net-post",
    title: "Set the world up over the API, then check it in the UI",
    level: 4,
    tags: ["network", "api"],
    code: `// Seeding over the API keeps the test about the list, not about the
// thirty seconds of clicking that would otherwise precede it.
test('a seeded order appears in the list', async ({ page, request }) => {
  const created = await request.post('/api/orders', {
    data: { sku: 'KB-01', quantity: 2 },
  });
  expect(created.ok()).toBeTruthy();
  const { id } = await created.json();

  await page.goto('/orders');
  await expect(page.getByRole('row', { name: new RegExp(id) })).toBeVisible();
});`,
  },
  {
    id: "pw-net-console",
    title: "Fail a test on an unexpected console error",
    level: 4,
    tags: ["network", "console"],
    code: `// A page that logs errors is failing quietly; this makes it fail loudly.
const errors: string[] = [];
page.on('console', (message) => {
  if (message.type() === 'error') {
    errors.push(message.text());
  }
});

await page.goto('/dashboard');
expect(errors).toEqual([]);`,
  },
];
